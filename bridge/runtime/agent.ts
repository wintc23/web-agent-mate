import { createInterface } from "node:readline";
import { promises as fs } from "node:fs";
import { query, createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { toolSchema, validateToolArguments } from "../../src/agent/schema";
import { AGENT_INSTRUCTIONS, runBuiltin } from "../../src/agent/loop";
import { BROWSER_TOOLS } from "../../src/agent/browser-tools";
import { assertConfig, builtinStepLimit, aborted, type AgentConfig, type AgentEvent, type RunContext, type ToolOutput, type UserRequest, type WireMessage } from "../../src/agent/protocol";
import { LOCAL_TOOLS, localExecutor } from "./local-tools";
import { encodeRuntimeMessage, RuntimeDecoder } from "../../src/agent/transport";
import { claudeToolOutput } from "./tool-output";

import { runCodex, nativePrompt, type NativeStart as Start } from "./codex";
import type { NativeControl } from "../../src/agent/codex";
let control: NativeControl | undefined;
const controller = new AbortController();
const pending = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>();
const cleanups = new Set<() => void>();
let watchdog: ReturnType<typeof setTimeout> | undefined;
let runtimeTimeout = false;
let nativeOwnsDeadlines = false;
function activity() {
  clearTimeout(watchdog);
  if (!nativeOwnsDeadlines && !controller.signal.aborted && !pending.size) watchdog = setTimeout(() => {
    runtimeTimeout = true; stop();
    send({ type: "error", error: "NATIVE_AGENT_IDLE_TIMEOUT" });
    input.close(); process.stdin.destroy();
  }, 180_000);
}
function send(message: unknown) { for (const frame of encodeRuntimeMessage(message)) process.stdout.write(JSON.stringify(frame) + "\n"); }
function request(type: "ask" | "browser", payload: unknown): Promise<any> {
  aborted(controller.signal);
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); activity(); send({ type, id, payload }); });
}
const context: RunContext = {
  signal: controller.signal,
  emit: async (event: AgentEvent) => { send({ type: "event", event }); },
  ask: async (payload: UserRequest) => {
    await context.emit({ type: "phase", phase: "waiting" });
    try { return await request("ask", payload); }
    finally { if (!controller.signal.aborted) await context.emit({ type: "phase", phase: "thinking" }); }
  }
};
async function browser(name: string, args: Record<string, unknown>, id: string): Promise<ToolOutput> {
  validateToolArguments(BROWSER_TOOLS, name, args);
  await context.emit({ type: "phase", phase: "executing" });
  return request("browser", { name, args, id });
}
function stop() {
  clearTimeout(watchdog);
  controller.abort();
  for (const item of pending.values()) item.reject(new Error("RUN_CANCELLED"));
  pending.clear();
  for (const cleanup of cleanups) cleanup();
}


async function runClaude(start: Start) {
  const executable = process.env.WAM_CLAUDE_PATH;
  if (!executable) throw new Error("CLAUDE_NOT_INSTALLED");
  const mcp = createSdkMcpServer({ name: "webmate", version: "0.6.0", tools: BROWSER_TOOLS.map(definition => {
    return tool(definition.name, definition.description, toolSchema(definition).shape, async (args) => {
      const output = await browser(definition.name, args, crypto.randomUUID());
      return { content: [{ type: "text" as const, text: output.text }, ...(output.image ? [{ type: "image" as const, mimeType: "image/jpeg", data: output.image.split(",")[1] }] : [])], isError: output.isError };
    });
  }) });
  const input = async function* () {
    if (!start.modelsOnly) yield { type: "user" as const, message: { role: "user" as const, content: nativePrompt(start) }, parent_tool_use_id: null, session_id: start.nativeSessionId ?? "" };
    else await new Promise<void>(resolve => controller.signal.addEventListener("abort", () => resolve(), { once: true }));
  };
  const agent = query({ prompt: input(), options: {
    cwd: start.config.workspace, pathToClaudeCodeExecutable: executable,
    abortController: controller, ...(start.config.model ? { model: start.config.model } : {}),
    ...(start.nativeSessionId ? { resume: start.nativeSessionId } : {}),
    maxTurns: start.config.maxSteps, permissionMode: "default", includePartialMessages: true,
    systemPrompt: { type: "preset", preset: "claude_code", append: AGENT_INSTRUCTIONS },
    mcpServers: { webmate: mcp },
    canUseTool: async (name, args, options) => {
      if (name === "AskUserQuestion") {
        const answers: Record<string, string> = {};
        for (const q of (args.questions as any[]) ?? []) answers[q.question] = await context.ask({ id: crypto.randomUUID(), kind: "question", title: q.question, detail: "", options: q.options?.map((x: any) => x.label) });
        return { behavior: "allow", updatedInput: { ...args, answers } };
      }
      if (name.startsWith("mcp__webmate__")) return { behavior: "allow", updatedInput: args };
      const response = await context.ask({ id: options.toolUseID, kind: "approval", title: name, detail: JSON.stringify(args) });
      return response === "allow" ? { behavior: "allow", updatedInput: args } : { behavior: "deny", message: "User denied this operation; do not bypass." };
    }
  } });
  const cleanup = () => agent.close(); cleanups.add(cleanup);
  let textId = crypto.randomUUID();
  let hadDelta = false;
  let completed = false;
  try {
    if (start.modelsOnly) { const models = await agent.supportedModels(); send({ type: "models", models: models.map(m => ({ id: m.value, name: m.displayName })) }); return; }
    for await (const raw of agent) {
      activity();
      aborted(controller.signal);
      const message = raw as any;
      if ((message.type === "assistant" && ["authentication_failed", "oauth_org_not_allowed"].includes(message.error)) ||
          (message.type === "system" && message.subtype === "api_retry" && [401, 403].includes(message.error_status)) ||
          (message.type === "auth_status" && message.error)) throw new Error("CLAUDE_AUTH_REQUIRED: Run claude auth login in a terminal, then continue this conversation.");
      if (message.type === "system" && message.subtype === "api_retry") await context.emit({ type: "phase", phase: "retrying" });
      if (message.type === "system" && message.subtype === "status" && message.status === "compacting") await context.emit({ type: "phase", phase: "compacting" });
      if (message.session_id) await context.emit({ type: "session", id: message.session_id });
      if (message.type === "system" && message.subtype === "init") await context.emit({ type: "phase", phase: "thinking" });
      if (message.type === "stream_event") {
        if (message.event.type === "message_start") { textId = crypto.randomUUID(); hadDelta = false; }
        if (message.event.type === "content_block_delta" && message.event.delta.type === "text_delta") { hadDelta = true; await context.emit({ type: "text", id: textId, delta: message.event.delta.text }); }
      }
      if (message.type === "assistant") for (const block of message.message.content ?? []) {
        if (block.type === "text" && !hadDelta) await context.emit({ type: "text", id: textId, delta: block.text });
        if (block.type === "tool_use") { await context.emit({ type: "phase", phase: "executing" }); await context.emit({ type: "tool_start", id: block.id, name: block.name, args: block.input }); }
      }
      if (message.type === "user" && Array.isArray(message.message.content)) for (const block of message.message.content) if (block.type === "tool_result") {
        await context.emit({ type: "tool_end", id: block.tool_use_id, output: claudeToolOutput(block) });
        await context.emit({ type: "phase", phase: "thinking" });
      }
      if (message.type === "result") { if (message.is_error || message.subtype !== "success") throw new Error(message.errors?.join("\n") ?? message.subtype); completed = true; break; }
    }
    if (!completed) throw new Error("CLAUDE_TURN_INCOMPLETE");
  } finally { cleanup(); cleanups.delete(cleanup); }
}

async function run(start: Start) {
  activity();
  await context.emit({ type: "phase", phase: "connecting" });
  assertConfig(start.config);
  if (start.config.location !== "local") throw new Error("LOCAL_RUNTIME_ONLY");
  start.config.workspace = await fs.realpath(start.config.workspace || process.env.WAM_WORKSPACE || process.cwd());
  if (start.config.engine === "codex") {
    // Codex owns its model retries and long-running commands. Keep bounded RPC
    // startup deadlines, but do not kill a valid native turn for being quiet.
    nativeOwnsDeadlines = true; clearTimeout(watchdog);
    return runCodex(start, { context, browser, activity: () => undefined, send, cleanups, setControl: value => { control = value; } });
  }
  if (start.config.engine === "claude") return runClaude(start);
  if (!start.apiKey) throw new Error("ORCA_NOT_CONNECTED");
  nativeOwnsDeadlines = true; clearTimeout(watchdog); // Built-in requests own their deadlines, including after tool replies.
  const local = localExecutor(start.config.workspace, context);
  cleanups.add(local.close);
  try {
    await runBuiltin({ apiKey: start.apiKey, model: start.config.model, prompt: start.prompt, history: start.history, maxSteps: builtinStepLimit(start.config), contextLength: start.config.contextLength, supportsVision: start.config.supportsVision, supportsTools: start.config.supportsTools,
      context, tools: [...BROWSER_TOOLS, ...LOCAL_TOOLS], execute: (name, args, id) => LOCAL_TOOLS.some(t => t.name === name) ? local.execute(name, args, id) : browser(name, args, id) });
  } finally { local.close(); cleanups.delete(local.close); }
}
let started = false;
const decoder = new RuntimeDecoder(Date.now, error => { send({ type: "error", error: error.message }); stop(); input.close(); process.stdin.destroy(); });
const input = createInterface({ input: process.stdin });
input.on("line", line => {
  try {
    const message = decoder.push(JSON.parse(line)) as any;
    if (!message) return;
    if (message.type === "reply") {
      const waiter = pending.get(message.id); pending.delete(message.id);
      activity();
      if (waiter) message.error ? waiter.reject(new Error(message.error)) : waiter.resolve(message.value);
    } else if (message.type === "control") {
      void (async () => {
        try {
          if (!control || typeof message.id !== "string" || typeof message.text !== "string" || !message.text.trim() || message.text.length > 50_000) throw new Error("CODEX_TURN_NOT_ACTIVE");
          await control(message.id, message.text);
          send({ type: "control_reply", id: message.id });
        } catch (error) { send({ type: "control_reply", id: message.id, error: String(error) }); }
      })();
    } else if (message.type === "cancel") stop();
    else if (message.type === "start" && !started) {
      started = true;
      void (async () => {
        try { await run(message.payload); send({ type: "done" }); }
        catch (error) { if (!runtimeTimeout) send({ type: controller.signal.aborted ? "cancelled" : "error", error: error instanceof Error ? error.message : String(error) }); }
        finally { stop(); input.close(); process.exitCode = 0; process.stdin.destroy(); }
      })();
    }
  } catch { send({ type: "error", error: "INVALID_RUNTIME_MESSAGE" }); stop(); }
});
input.on("close", () => {
  try { decoder.finish(); } catch (error) { send({ type: "error", error: (error as Error).message }); }
  stop();
});
process.on("SIGTERM", () => { stop(); input.close(); process.stdin.destroy(); process.exitCode = 0; });
