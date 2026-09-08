import type { AgentConfig, Entry, Session } from "./protocol";

export interface EngineModel {
  id: string; name: string; isDefault?: boolean;
  supportedReasoningEfforts?: Array<{ reasoningEffort: string; description: string }>;
  defaultReasoningEffort?: string;
  serviceTiers?: Array<{ id: string; name?: string; description?: string }>;
}
export interface CodexSkill { name: string; path: string; description: string; enabled: boolean; scope: string }
export interface CodexThread { id: string; name?: string; preview: string; cwd: string; model?: string; reasoningEffort?: string; createdAt: number; updatedAt: number; turns?: Array<{ id: string; items: any[] }> }
export interface CodexMcp { name: string; authStatus: string; runtimeStatus?: string; tools: Record<string, unknown>; resources: unknown[] }
export interface CodexRequest { method: string; params: Record<string, unknown> }
export type NativeControl = (id: string, text: string) => Promise<void>;

// Inherit Codex config/AGENTS.md/Skills/MCP and developer instructions. Only
// override options the user explicitly selected in this conversation.
export function codexThreadSettings(config: AgentConfig): Record<string, unknown> {
  const c = config.codex;
  return { cwd: config.workspace, ...(config.model ? { model: config.model } : {}),
    ...(c?.sandbox ? { sandbox: c.sandbox } : {}), ...(c?.approvalPolicy ? { approvalPolicy: c.approvalPolicy } : {}),
    ...(c?.serviceTier ? { serviceTier: c.serviceTier } : {}) };
}
export function codexTurnSettings(config: AgentConfig, model: string, effort?: string): Record<string, unknown> {
  const c = config.codex;
  return { ...(c?.effort ? { effort: c.effort } : {}),
    ...(c?.mode ? { collaborationMode: { mode: c.mode, settings: { model, reasoning_effort: c.effort ?? effort ?? null, developer_instructions: null } } } : {}) };
}
export function codexInput(text: string, skills: CodexSkill[] = []): unknown[] {
  // The model still receives the exact text; explicit skill inputs make
  // duplicate names/path resolution reliable for the Codex harness.
  const names = new Set([...text.matchAll(/(?:^|\s)\$([\w:.-]+)/g)].map(match => match[1]));
  const chosen = skills.filter(skill => skill.enabled && names.has(skill.name));
  return [{ type: "text", text, text_elements: [] }, ...chosen.map(skill => ({ type: "skill", name: skill.name, path: skill.path }))];
}
export function codexThreadSeed(thread: CodexThread, config: AgentConfig): Partial<Session> {
  const entries: Entry[] = [];
  for (const turn of thread.turns ?? []) for (const item of turn.items ?? []) {
    if (item.type === "userMessage") entries.push({ id: item.id, kind: "user", text: (item.content ?? []).map((c: any) => c.text ?? (c.type === "skill" ? `$${c.name}` : `[${c.type}]`)).join("\n"), status: "completed" });
    else if (item.type === "agentMessage") entries.push({ id: item.id, kind: "assistant", text: item.text ?? "", status: "completed" });
    else if (item.type === "reasoning") continue;
    else entries.push({ id: item.id, kind: "tool", name: item.tool ?? item.type, text: JSON.stringify(item, null, 2).slice(0, 100_000), status: item.status === "failed" ? "failed" : "completed" });
  }
  return { title: (thread.name || thread.preview || "Codex").slice(0, 120), config: { ...config, location: "local", engine: "codex", workspace: thread.cwd, model: thread.model ?? config.model, codex: { ...config.codex, effort: thread.reasoningEffort ?? config.codex?.effort } },
    entries, nativeForkFromId: thread.id, history: [], draft: "" };
}

export function safeExternalUrl(value: string): string | undefined {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}

// Standard MCP elicitation uses a flat object of primitive fields. Reject
// unsupported/invalid forms instead of silently granting guessed values.
export function validateElicitation(schema: Record<string, any>, value: unknown): Record<string, unknown> {
  if (schema.type !== "object" || !schema.properties || !value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a form object");
  const data = value as Record<string, unknown>, result: Record<string, unknown> = Object.create(null);
  for (const key of schema.required ?? []) if (data[key] === undefined || data[key] === "") throw new Error(`${key}: required`);
  const primitive = (s: any, v: any, key: string) => {
    if (s?.anyOf) { if (typeof v !== "string" || !s.anyOf.some((option: any) => option.const === v)) throw new Error(`${key}: invalid selection`); return; }
    if (s.type === "string") {
      if (typeof v !== "string" || v.length < (s.minLength ?? 0) || v.length > (s.maxLength ?? 100_000)) throw new Error(`${key}: invalid text`);
      if (s.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new Error(`${key}: invalid email`);
      if (s.format === "uri" && !URL.canParse(v)) throw new Error(`${key}: invalid URL`);
      if (s.format === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v)))) throw new Error(`${key}: invalid date`);
      if (s.format === "date" && new Date(v).toISOString().slice(0, 10) !== v) throw new Error(`${key}: invalid date`);
      if (s.format === "date-time" && Number.isNaN(Date.parse(v))) throw new Error(`${key}: invalid date-time`);
    } else if (["number", "integer"].includes(s.type)) {
      if (typeof v !== "number" || !Number.isFinite(v) || (s.type === "integer" && !Number.isInteger(v)) || v < (s.minimum ?? -Infinity) || v > (s.maximum ?? Infinity)) throw new Error(`${key}: invalid number`);
    } else if (s.type === "boolean") { if (typeof v !== "boolean") throw new Error(`${key}: invalid boolean`); }
    else throw new Error(`${key}: unsupported form field`);
    if (s.enum && !s.enum.includes(v)) throw new Error(`${key}: invalid selection`);
    if (s.oneOf && !s.oneOf.some((option: any) => option.const === v)) throw new Error(`${key}: invalid selection`);
  };
  for (const [key, s] of Object.entries<any>(schema.properties)) {
    const v = data[key]; if (v === undefined) continue;
    if (s.type === "array") {
      if (!Array.isArray(v) || v.length < (s.minItems ?? 0) || v.length > (s.maxItems ?? 1000) || (s.uniqueItems && new Set(v).size !== v.length)) throw new Error(`${key}: invalid list`);
      for (const item of v) primitive(s.items, item, key);
    } else primitive(s, v, key);
    result[key] = v;
  }
  for (const key of Object.keys(data)) if (!Object.hasOwn(schema.properties, key)) throw new Error(`${key}: unknown field`);
  return result;
}
