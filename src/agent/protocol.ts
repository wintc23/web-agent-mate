import type { ProviderIssue } from "./provider-error";
export type Engine = "builtin" | "codex" | "claude";
export type PermissionMode = "ask" | "auto";
export interface CodexSettings {
  effort?: string;
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  approvalPolicy?: "untrusted" | "on-request" | "never";
  mode?: "default" | "plan";
  serviceTier?: string;
}
export interface AgentConfig {
  // "remote" is accepted only as a legacy storage/import value, never for execution.
  location: "remote" | "local";
  engine: Engine;
  model: string;
  workspace: string;
  maxSteps: number;
  // Built-in budgets are opt-in. Older sessions' maxSteps must not impose a limit.
  limitToolCalls?: boolean;
  contextLength?: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
  permissionMode?: PermissionMode;
  codex?: CodexSettings;
}
export const DEFAULT_CONFIG: AgentConfig = { location: "local", engine: "builtin", model: "orcarouter/free", workspace: "", maxSteps: 24, limitToolCalls: false, permissionMode: "ask" };
export function localConfig(config: AgentConfig): AgentConfig {
  // Preserve model, history and optional budgets. New file/command capabilities
  // require fresh approval instead of inheriting browser-only automatic approval.
  return config.location === "remote" && config.engine === "builtin" ? { ...config, location: "local", permissionMode: "ask" } : config;
}
export function builtinStepLimit(config: AgentConfig): number | undefined {
  return config.limitToolCalls === true ? config.maxSteps : undefined;
}
export interface QueuedMessage { id: string; text: string; createdAt: number; delivery?: "steer" | "sending" | "uncertain" }
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
export interface ToolCall { id: string; type: "function"; function: { name: string; arguments: string } }
export interface WireMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null | Array<Record<string, unknown>>;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}
export interface ToolOutput { text: string; image?: string; isError?: boolean }
export interface Entry {
  id: string;
  kind: "user" | "assistant" | "tool" | "notice";
  text: string;
  name?: string;
  args?: unknown;
  providerIssue?: ProviderIssue;
  status: "running" | "completed" | "failed" | "interrupted";
}
export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  config: AgentConfig;
  entries: Entry[];
  history: WireMessage[];
  draft: string;
  queuedMessages?: QueuedMessage[];
  nativeSessionId?: string;
  nativeForkFromId?: string;
  codexUsage?: { total: { totalTokens: number; inputTokens: number; outputTokens: number; cachedInputTokens: number }; last: { totalTokens: number }; modelContextWindow?: number | null };
  parentSessionId?: string;
  activeRun?: { id: string; owner: string; heartbeat: number; phase?: RunPhase; coordinated?: boolean; stopRequested?: boolean; nextMessageId?: string; nativeTurnId?: string; requests?: UserRequest[]; replies?: Record<string, string> };
  archived?: boolean;
}
export type RunPhase = "connecting" | "thinking" | "executing" | "waiting" | "compacting" | "retrying";
export type AgentEvent =
  | { type: "phase"; phase: RunPhase }
  | { type: "text"; id: string; delta: string }
  | { type: "tool_start"; id: string; name: string; args: unknown }
  | { type: "tool_end"; id: string; output: ToolOutput }
  | { type: "checkpoint"; history: WireMessage[] }
  | { type: "session"; id: string }
  | { type: "native_turn"; id: string }
  | { type: "steered"; id: string; text: string }
  | { type: "usage"; usage: NonNullable<Session["codexUsage"]> }
  | { type: "detail"; id: string; name: string; text: string; append?: boolean; status?: Entry["status"] }
  | { type: "tool_delta"; id: string; delta: string }
  | { type: "notice"; text: string };
export interface UserRequest { id: string; kind: "approval" | "question" | "elicitation"; title: string; detail: string; options?: string[]; schema?: Record<string, any>; url?: string }
export interface RunContext {
  signal: AbortSignal;
  emit: (event: AgentEvent) => Promise<void>;
  ask: (request: UserRequest) => Promise<string>;
}
export function assertConfig(config: AgentConfig): void {
  if (!config || !["local", "remote"].includes(config.location) || !["builtin", "codex", "claude"].includes(config.engine)) throw new Error("INVALID_CONFIG");
  if (config.location !== "local") throw new Error("LOCAL_ENGINE_REQUIRES_BRIDGE");
  if (!Number.isInteger(config.maxSteps) || config.maxSteps < 1 || config.maxSteps > 100) throw new Error("INVALID_STEP_LIMIT");
  if (config.limitToolCalls !== undefined && typeof config.limitToolCalls !== "boolean") throw new Error("INVALID_STEP_LIMIT");
  if (config.permissionMode !== undefined && !["ask", "auto"].includes(config.permissionMode)) throw new Error("INVALID_PERMISSION_MODE");
  if (config.codex !== undefined) {
    const c = config.codex;
    if (!c || typeof c !== "object" || Array.isArray(c) ||
      (c.sandbox !== undefined && !["read-only", "workspace-write", "danger-full-access"].includes(c.sandbox)) ||
      (c.approvalPolicy !== undefined && !["untrusted", "on-request", "never"].includes(c.approvalPolicy)) ||
      (c.mode !== undefined && !["default", "plan"].includes(c.mode)) ||
      [c.effort, c.serviceTier].some(value => value !== undefined && (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)))) throw new Error("INVALID_CODEX_SETTINGS");
  }
}
export function aborted(signal: AbortSignal): void { if (signal.aborted) throw new Error("RUN_CANCELLED"); }

// Never replay tool calls whose result was lost on disconnect/crash.
export function repairHistory(history: WireMessage[]): WireMessage[] {
  const repaired: WireMessage[] = [];
  let pending: string[] = [];
  const close = () => {
    for (const id of pending) repaired.push({ role: "tool", tool_call_id: id, content: "Interrupted: outcome unknown. Inspect current state before attempting another action; do not assume success or retry a side effect automatically." });
    pending = [];
  };
  for (const message of history) {
    if (message.role !== "tool") close();
    if (message.role === "tool") {
      if (!pending.includes(message.tool_call_id ?? "")) continue;
      pending = pending.filter(id => id !== message.tool_call_id);
    }
    repaired.push(message);
    if (message.tool_calls) pending = message.tool_calls.map(call => call.id);
  }
  close();
  return repaired;
}
