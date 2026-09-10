import { DEFAULT_CONFIG, assertConfig, configTransition, repairHistory, type AgentConfig, type AgentEvent, type Session, type WireMessage } from "./protocol";

const DB_NAME = "webagentmate-sessions-v1";
const changes = new Set<() => void>();
let channel: BroadcastChannel | undefined;
function notifyChanges() {
  for (const listener of changes) listener();
  channel?.postMessage("changed");
}
export const LEASE_MS = 45_000;
export function makeSession(config: AgentConfig = DEFAULT_CONFIG): Session {
  const now = Date.now();
  return { id: crypto.randomUUID(), title: "", createdAt: now, updatedAt: now, revision: 0, config: { ...config }, entries: [], history: [], draft: "" };
}
export function applyEvent(session: Session, event: AgentEvent): void {
  if (event.type === "phase") { if (session.activeRun) session.activeRun.phase = event.phase; return; }
  if (event.type === "checkpoint") { session.history = event.history; return; }
  if (event.type === "session") { session.nativeSessionId = event.id; session.nativeForkFromId = undefined; return; }
  if (event.type === "native_turn") { if (session.activeRun) session.activeRun.nativeTurnId = event.id; return; }
  if (event.type === "usage") { session.codexUsage = event.usage; return; }
  if (event.type === "steered") {
    session.queuedMessages = session.queuedMessages?.filter(item => item.id !== event.id);
    if (!session.entries.some(item => item.id === event.id)) session.entries.push({ id: event.id, kind: "user", text: event.text, status: "completed" });
    return;
  }
  if (event.type === "notice") { session.entries.push({ id: crypto.randomUUID(), kind: "notice", text: event.text, status: "completed" }); return; }
  let entry = session.entries.find(item => item.id === event.id);
  if (!entry) {
    entry = { id: event.id, kind: event.type === "text" ? "assistant" : "tool", text: "", status: "running" };
    session.entries.push(entry);
  }
  if (event.type === "text") entry.text += event.delta;
  if (event.type === "tool_delta") entry.text = (entry.text + event.delta).slice(-100_000);
  if (event.type === "detail") { entry.name = event.name; entry.text = (event.append ? entry.text + event.text : event.text).slice(-100_000); entry.status = event.status ?? "completed"; }
  if (event.type === "tool_start") { entry.name = event.name; entry.args = event.args; }
  if (event.type === "tool_end") { entry.text = event.output.text; entry.status = event.output.isError ? "failed" : "completed"; }
}
export function claimRun(session: Session, id: string, owner: string, now = Date.now()): void {
  if (session.activeRun && (session.activeRun.coordinated || now - session.activeRun.heartbeat < LEASE_MS)) throw new Error("SESSION_BUSY");
  for (const entry of session.entries) if (entry.status === "running") entry.status = "interrupted";
  session.activeRun = { id, owner, heartbeat: now };
}
export function checkRun(session: Session, id: string): void {
  if (session.activeRun?.id !== id) throw new Error("RUN_OWNERSHIP_LOST");
}
export function continuationHistory(session: Pick<Session, "config" | "history" | "entries">): WireMessage[] {
  if (session.config.engine === "builtin" && session.history.length) return repairHistory(structuredClone(session.history));
  return session.entries.filter(entry => ["user", "assistant"].includes(entry.kind) && entry.status === "completed")
    .map(entry => ({ role: entry.kind as "user" | "assistant", content: entry.text }));
}
export function matchesSession(session: Session, query: string): boolean {
  if (session.archived) return false;
  const searchable = [session.title, session.config.engine, session.config.model, session.config.workspace,
    ...session.entries.filter(entry => entry.kind === "user" || entry.kind === "assistant").map(entry => entry.text)].join("\n").toLocaleLowerCase();
  return query.trim().toLocaleLowerCase().split(/\s+/).every(word => searchable.includes(word));
}

// IndexedDB returns fresh objects even when nothing changed. Reuse snapshots so
// polling does not re-render the conversation or reset transient control state.
export function reconcileSessions(previous: Session[], incoming: Session[]): Session[] {
  const byId = new Map(previous.map(session => [session.id, session]));
  const next = incoming.map(session => {
    const existing = byId.get(session.id);
    if (!existing) return session;
    const unchanged = existing.revision !== undefined && session.revision !== undefined
      ? existing.revision === session.revision
      : JSON.stringify(existing) === JSON.stringify(session); // Legacy records gain a revision on their next write.
    return unchanged ? existing : session;
  });
  return next.length === previous.length && next.every((session, index) => session === previous[index]) ? previous : next;
}

// Each mutation is a single IndexedDB read/write transaction. No read/modify/write
// races between side panels, and a stale window cannot recreate a deleted session.
export class SessionStore {
  private db?: Promise<IDBDatabase>;
  subscribe(listener: () => void): () => void {
    if (!channel && typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(DB_NAME);
      channel.onmessage = () => { for (const notify of changes) notify(); };
    }
    changes.add(listener);
    return () => { changes.delete(listener); if (!changes.size) { channel?.close(); channel = undefined; } };
  }
  private open(): Promise<IDBDatabase> {
    return this.db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("sessions", { keyPath: "id" });
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); this.db = undefined; };
        // Loading preserves the selected environment and never starts work.
        resolve(db);
      };
      request.onerror = () => reject(request.error);
    });
  }
  async list(): Promise<Session[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db.transaction("sessions").objectStore("sessions").getAll();
      request.onsuccess = () => resolve((request.result as Session[]).sort((a, b) => b.updatedAt - a.updatedAt));
      request.onerror = () => reject(request.error);
    });
  }
  async create(config?: AgentConfig, seed?: Partial<Session>): Promise<Session> {
    const session = { ...makeSession(config), ...seed, revision: 0 };
    assertConfig(session.config);
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("sessions", "readwrite");
      tx.objectStore("sessions").add(session);
      tx.oncomplete = () => { notifyChanges(); resolve(session); };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  async get(id: string): Promise<Session> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db.transaction("sessions").objectStore("sessions").get(id);
      request.onsuccess = () => request.result && !request.result.archived ? resolve(request.result) : reject(new Error("SESSION_NOT_FOUND"));
      request.onerror = () => reject(request.error);
    });
  }
  async fork(id: string, config?: AgentConfig): Promise<Session> {
    const source = await this.get(id);
    if (source.activeRun && (source.activeRun.coordinated || Date.now() - source.activeRun.heartbeat < LEASE_MS)) throw new Error("SESSION_BUSY");
    const nextConfig = configTransition(source.config, config ?? source.config);
    const sameEnvironment = source.config.engine === nextConfig.engine && source.config.location === nextConfig.location && source.config.workspace === nextConfig.workspace;
    const codexSource = source.config.engine === "codex" && nextConfig.engine === "codex" && nextConfig.location === "local" ? source.nativeSessionId ?? source.nativeForkFromId : undefined;
    const entries = structuredClone(source.entries).map(entry => ({ ...entry, status: entry.status === "running" ? "interrupted" as const : entry.status }));
    return this.create(nextConfig, {
      title: source.title, entries, draft: source.draft, parentSessionId: source.id,
      ...(codexSource ? { nativeForkFromId: codexSource } : {}),
      history: continuationHistory({ ...source, history: sameEnvironment ? source.history : [] })
    });
  }
  async update(id: string, mutate: (session: Session) => void, touch = true): Promise<Session> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("sessions", "readwrite");
      const store = tx.objectStore("sessions");
      const request = store.get(id);
      let result: Session;
      let failure: unknown;
      request.onsuccess = () => {
        try {
          if (!request.result || request.result.archived) throw new Error("SESSION_NOT_FOUND");
          result = request.result;
          const revision = result.revision ?? 0;
          const previousConfig = { ...result.config };
          mutate(result);
          result.config = configTransition(previousConfig, result.config);
          if (touch) result.updatedAt = Date.now();
          // Drafts, heartbeats and approvals also change state without touching updatedAt.
          result.revision = revision + 1;
          store.put(result);
        } catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => { notifyChanges(); resolve(result); };
      tx.onerror = () => reject(failure ?? tx.error);
      tx.onabort = () => reject(failure ?? tx.error);
    });
  }
  async delete(id: string): Promise<void> {
    // Tombstone first, so an active run cannot be erased under another window.
    await this.update(id, session => {
      if (session.activeRun && (session.activeRun.coordinated || Date.now() - session.activeRun.heartbeat < LEASE_MS)) throw new Error("SESSION_BUSY");
      session.archived = true;
      session.entries = []; session.history = []; session.queuedMessages = []; session.draft = ""; session.title = "";
      session.nativeSessionId = undefined; session.activeRun = undefined;
    });
  }
}
