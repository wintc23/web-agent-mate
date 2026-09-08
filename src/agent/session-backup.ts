import { assertConfig, localConfig, repairHistory, type AgentConfig, type Entry, type Session, type WireMessage } from "./protocol";
import { continuationHistory } from "./sessions";
import { validateProviderIssue } from "./provider-error";

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const invalid = (): never => { throw new Error("INVALID_SESSION_BACKUP"); };
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function string(value: unknown, max = MAX_BACKUP_BYTES): string {
  if (typeof value !== "string" || value.length > max) return invalid();
  return value;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > 20_000) return invalid();
  return value;
}
function configFrom(value: unknown): AgentConfig {
  const data = record(value);
  const config = { location: data.location, engine: data.engine, model: string(data.model, 500), workspace: string(data.workspace, 4096), maxSteps: data.maxSteps } as AgentConfig;
  if (data.limitToolCalls !== undefined) config.limitToolCalls = data.limitToolCalls as boolean;
  if (data.permissionMode !== undefined) config.permissionMode = data.permissionMode as AgentConfig["permissionMode"];
  if (data.codex !== undefined) {
    const c = record(data.codex);
    config.codex = Object.fromEntries(["effort", "sandbox", "approvalPolicy", "mode", "serviceTier"].filter(key => c[key] !== undefined).map(key => [key, c[key]]));
  }
  const migrated = localConfig(config);
  // Validate the original approval value before migration resets browser-only auto approval.
  try { assertConfig({ ...migrated, permissionMode: config.permissionMode }); } catch { return invalid(); }
  return migrated;
}
function entryFrom(value: unknown): Entry {
  const data = record(value);
  if (!["user", "assistant", "tool", "notice"].includes(data.kind as string) || !["running", "completed", "failed", "interrupted"].includes(data.status as string)) return invalid();
  return {
    id: crypto.randomUUID(), kind: data.kind as Entry["kind"], text: string(data.text),
    status: data.status === "running" ? "interrupted" : data.status as Entry["status"],
    ...(data.name === undefined ? {} : { name: string(data.name, 500) }),
    ...(data.args === undefined ? {} : { args: data.args }),
    ...(data.kind === "notice" && validateProviderIssue(data.providerIssue) ? { providerIssue: validateProviderIssue(data.providerIssue) } : {})
  };
}
function messageFrom(value: unknown): WireMessage {
  const data = record(value);
  if (!["user", "assistant", "tool"].includes(data.role as string)) return invalid();
  let content: WireMessage["content"];
  if (data.content === null || typeof data.content === "string") content = data.content;
  else content = list(data.content).map(value => {
    const part = record(value);
    if (part.type === "text") return { type: "text", text: string(part.text) };
    if (part.type === "image_url") {
      const url = string(record(part.image_url).url);
      if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(url)) return invalid();
      return { type: "image_url", image_url: { url } };
    }
    return invalid();
  });
  const message: WireMessage = { role: data.role as WireMessage["role"], content };
  if (data.tool_calls !== undefined) {
    if (data.role !== "assistant") return invalid();
    message.tool_calls = list(data.tool_calls).map(value => {
      const call = record(value), fn = record(call.function);
      if (call.type !== "function") return invalid();
      return { id: string(call.id, 500), type: "function", function: { name: string(fn.name, 500), arguments: string(fn.arguments) } };
    });
    if (message.tool_calls.some(call => !call.id || !call.function.name) || new Set(message.tool_calls.map(call => call.id)).size !== message.tool_calls.length) return invalid();
  }
  if (data.role === "tool") message.tool_call_id = string(data.tool_call_id, 500);
  return message;
}

// Export only conversation data. Provider settings, native thread IDs and run ownership
// are intentionally absent; imported conversations always start an independent session.
export function serializeSession(session: Session): string {
  const text = JSON.stringify({ format: "webagentmate-conversation", version: 1, title: session.title,
    config: configFrom(session.config), createdAt: session.createdAt, entries: session.entries,
    history: continuationHistory(session), draft: session.draft }, null, 2);
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error("SESSION_BACKUP_TOO_LARGE");
  return text;
}
export function parseSessionBackup(text: string): Pick<Session, "title" | "config" | "createdAt" | "entries" | "history" | "draft"> {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error("SESSION_BACKUP_TOO_LARGE");
  let data: Record<string, unknown>;
  try { data = record(JSON.parse(text)); } catch { return invalid(); }
  // Accept the earlier transcript-only v1 exports as well as complete backups.
  if (data.version !== 1 || (data.format !== undefined && data.format !== "webagentmate-conversation")) return invalid();
  const config = configFrom(data.config);
  const entries = list(data.entries).map(entryFrom);
  const title = string(data.title, 500);
  const draft = data.draft === undefined ? "" : string(data.draft, 50_000);
  if (typeof data.createdAt !== "number" || !Number.isFinite(data.createdAt) || data.createdAt < 0 || data.createdAt > 8.64e15) return invalid();
  const history = data.history === undefined ? continuationHistory({ config, entries, history: [] }) : repairHistory(list(data.history).map(messageFrom));
  return { title, config, createdAt: data.createdAt, entries, history, draft };
}
