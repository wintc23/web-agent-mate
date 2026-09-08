import type { Session } from "./protocol";
import { checkRun, LEASE_MS, SessionStore } from "./sessions";
import { preserveInterruptedReply } from "./message-queue";

export const runLockName = (sessionId: string) => `webagentmate-run:${sessionId}`;

// The browser releases this lock when a panel closes or crashes. Heartbeats are
// retained for older panels, but never used to steal a lock from a live runner.
export async function withRunLock<T>(sessionId: string, work: (coordinated: boolean) => Promise<T>): Promise<T | undefined> {
  if (!globalThis.navigator?.locks) return work(false);
  return navigator.locks.request(runLockName(sessionId), { ifAvailable: true }, lock => lock ? work(true) : undefined);
}

export async function recoverRun(store: SessionStore, snapshot: Session, notice: string, legacyOwnerGone = false): Promise<void> {
  const run = snapshot.activeRun;
  if (!run) return;
  await withRunLock(snapshot.id, async coordinated => {
    const latest = await store.get(snapshot.id);
    if (latest.activeRun?.id !== run.id) return;
    if (!(coordinated && run.coordinated) && !legacyOwnerGone && Date.now() - latest.activeRun.heartbeat < LEASE_MS) return;
    await store.update(snapshot.id, session => {
      checkRun(session, run.id);
      if (!(coordinated && session.activeRun!.coordinated) && !legacyOwnerGone && Date.now() - session.activeRun!.heartbeat < LEASE_MS) return;
      preserveInterruptedReply(session);
      session.activeRun = undefined;
      for (const message of session.queuedMessages ?? []) if (message.delivery === "sending") message.delivery = "uncertain";
      for (const entry of session.entries) if (entry.status === "running") entry.status = "interrupted";
      session.entries.push({ id: crypto.randomUUID(), kind: "notice", text: notice, status: "interrupted" });
    });
  });
}

export async function legacyOwnerIsGone(): Promise<boolean> {
  try {
    const runtime = chrome.runtime as typeof chrome.runtime & { getContexts?: (filter: Record<string, unknown>) => Promise<Array<{ documentUrl?: string }>> };
    if (!runtime.getContexts) return false;
    const contexts = await runtime.getContexts({});
    return contexts.filter(item => item.documentUrl?.split(/[?#]/)[0] === chrome.runtime.getURL("sidepanel.html")).length === 1;
  } catch { return false; }
}

export function stopRun(session: Session, runId: string, nextMessageId?: string): void {
  checkRun(session, runId);
  session.activeRun!.stopRequested = true;
  session.activeRun!.nextMessageId = nextMessageId;
}

export function replyToRun(session: Session, runId: string, requestId: string, value: string): void {
  checkRun(session, runId);
  const run = session.activeRun!;
  if (run.stopRequested || !run.requests?.some(request => request.id === requestId) || run.replies?.[requestId] !== undefined) throw new Error("REQUEST_ALREADY_RESOLVED");
  (run.replies ??= {})[requestId] = value;
}
