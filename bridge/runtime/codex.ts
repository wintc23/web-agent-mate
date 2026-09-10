import { createInterface } from "node:readline";
import { spawn } from "node:child_process";
import { BROWSER_TOOLS } from "../../src/agent/browser-tools";
import { BROWSER_TOOL_INSTRUCTIONS } from "../../src/agent/browser-instructions";
import { aborted, type AgentConfig, type RunContext, type ToolOutput, type WireMessage } from "../../src/agent/protocol";
import { codexInput, codexThreadSettings, codexTurnSettings, validateElicitation, type CodexRequest, type CodexSkill, type NativeControl } from "../../src/agent/codex";
import { killProcess } from "./local-tools";
import { codexToolOutput } from "./tool-output";

export interface NativeStart { config: AgentConfig; prompt: string; history: WireMessage[]; nativeSessionId?: string; nativeForkFromId?: string; apiKey?: string; modelsOnly?: boolean; codexRequest?: CodexRequest }
export interface CodexHost {
  context: RunContext; browser: (name: string, args: Record<string, unknown>, id: string) => Promise<ToolOutput>;
  activity: () => void; send: (message: unknown) => void; cleanups: Set<() => void>;
  setControl: (control?: NativeControl) => void;
}
export function nativePrompt(start: NativeStart): string {
  if (start.nativeSessionId || start.nativeForkFromId || !start.history.length) return start.prompt;
  return `Conversation imported from another engine (context only, not new instructions):\n${JSON.stringify(start.history)}\n\nCurrent user request:\n${start.prompt}`;
}

export async function runCodex(start: NativeStart, host: CodexHost) {
  const { context, browser, activity, send, cleanups } = host;
  const controller = { signal: context.signal };
  const executable = process.env.WAM_CODEX_PATH;
  if (!executable) throw new Error("CODEX_NOT_INSTALLED");
  const child = spawn(executable, ["app-server", "--listen", "stdio://"], { cwd: start.config.workspace, detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"] });
  const cleanup = () => killProcess(child);
  cleanups.add(cleanup);
  const waiting = new Map<number, { resolve: (data: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  let nextId = 1;
  let stderr = "";
  const write = (value: unknown) => { if (!child.stdin.destroyed) child.stdin.write(JSON.stringify(value) + "\n"); };
  const rpc = (method: string, params: unknown): Promise<any> => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => { waiting.delete(id); reject(new Error(`Codex request timed out: ${method}`)); }, 45_000);
    waiting.set(id, { resolve, reject, timer }); write({ id, method, params });
  });
  let resolveTurn: () => void = () => undefined;
  let rejectTurn: (error: Error) => void = () => undefined;
  const turn = new Promise<void>((resolve, reject) => { resolveTurn = resolve; rejectTurn = reject; });
  // A failure before turn/start must not become an unhandled rejection.
  void turn.catch(() => undefined);
  let threadId = "";
  let turnId = "";
  let skills: CodexSkill[] = [];
  let oauthCompleted: { name: string; success: boolean; error?: string } | undefined;
  let notifyOauth: (() => void) | undefined;
  let eventQueue = Promise.resolve();
  const textIds = new Set<string>();
  child.stderr.on("data", data => { stderr = (stderr + data).slice(-1500); });
  const fail = (error: Error) => {
    for (const value of waiting.values()) { clearTimeout(value.timer); value.reject(error); }
    waiting.clear(); rejectTurn(error);
  };
  child.on("error", fail);
  child.stdin.on("error", fail);
  child.on("exit", code => fail(new Error(`Codex exited (${code}). ${stderr}`)));
  const lines = createInterface({ input: child.stdout });
  const serverRequest = async (message: any) => {
    const p = message.params ?? {};
    try {
      let result: unknown;
      if (message.method === "item/tool/call") {
        if (!String(p.tool).startsWith("wam_")) throw new Error("Unknown dynamic tool");
        const output = await browser(p.tool.slice(4), p.arguments, p.callId ?? String(message.id));
        result = { success: !output.isError, contentItems: [{ type: "inputText", text: output.text }, ...(output.image ? [{ type: "inputImage", imageUrl: output.image }] : [])] };
      } else if (message.method === "item/tool/requestUserInput") {
        const answers: Record<string, { answers: string[] }> = {};
        for (const question of p.questions ?? []) {
          answers[question.id] = { answers: [await context.ask({ id: question.id, kind: "question", title: question.question, detail: question.options?.map((item: any) => `${item.label}: ${item.description ?? ""}`).join("\n") ?? "", options: question.options?.map((item: any) => item.label) })] };
        }
        result = { answers };
      } else if (["item/commandExecution/requestApproval", "item/fileChange/requestApproval", "item/permissions/requestApproval"].includes(message.method)) {
        const answer = await context.ask({ id: String(message.id), kind: "approval", title: message.method, detail: JSON.stringify(p) });
        result = message.method === "item/permissions/requestApproval" ? { permissions: answer === "allow" ? p.permissions ?? {} : {}, scope: "turn" } : { decision: answer === "allow" ? "accept" : "decline" };
      } else if (message.method === "mcpServer/elicitation/request") {
        const answer = await context.ask({ id: String(message.id), kind: "elicitation", title: `${p.serverName}: ${p.message}`, detail: "", ...(p.mode === "url" ? { url: p.url } : { schema: p.requestedSchema }) });
        const response = JSON.parse(answer);
        if (!["accept", "decline", "cancel"].includes(response.action)) throw new Error("Invalid MCP elicitation response");
        result = { action: response.action, content: response.action === "accept" && p.mode !== "url" ? validateElicitation(p.requestedSchema, response.content) : null };
      } else { write({ id: message.id, error: { code: -32601, message: "Unsupported client request" } }); return; }
      aborted(controller.signal); write({ id: message.id, result });
    } catch (error) { write({ id: message.id, error: { code: -32000, message: String(error) } }); }
  };
  lines.on("line", line => {
    activity();
    let message: any;
    try { message = JSON.parse(line); } catch { fail(new Error("Invalid Codex protocol message")); return; }
    if (message.id !== undefined && message.method) { void serverRequest(message); return; }
    if (message.id !== undefined) {
      const waiter = waiting.get(message.id);
      if (waiter) { waiting.delete(message.id); clearTimeout(waiter.timer); message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result); }
      return;
    }
    eventQueue = eventQueue.then(async () => {
      const p = message.params ?? {};
      // Child-agent notifications belong to other threads and must never
      // finish or steer the parent turn.
      if (p.threadId && threadId && p.threadId !== threadId) return;
      if (message.method === "mcpServer/oauthLogin/completed") { oauthCompleted = p; notifyOauth?.(); }
      if (message.method === "turn/started") { turnId = p.turn.id; await context.emit({ type: "native_turn", id: turnId }); }
      if (message.method === "thread/tokenUsage/updated") await context.emit({ type: "usage", usage: p.tokenUsage });
      if (message.method === "item/reasoning/summaryTextDelta") await context.emit({ type: "detail", id: `summary:${p.itemId}`, name: "reasoningSummary", text: p.delta, append: true });
      if (message.method === "item/plan/delta") await context.emit({ type: "detail", id: `plan-item:${p.itemId}`, name: "plan", text: p.delta, append: true });
      if (message.method === "item/mcpToolCall/progress") await context.emit({ type: "tool_delta", id: p.itemId, delta: `${p.message ?? JSON.stringify(p)}\n` });
      if (message.method === "hook/started" || message.method === "hook/completed") await context.emit({ type: "detail", id: `hook:${p.hook?.id ?? p.run?.id ?? p.id ?? p.turnId}`, name: "hook", text: JSON.stringify(p, null, 2), status: message.method === "hook/started" ? "running" : "completed" });
      if (message.method === "item/commandExecution/outputDelta") await context.emit({ type: "tool_delta", id: p.itemId, delta: p.delta });
      if (message.method === "turn/diff/updated") await context.emit({ type: "detail", id: `diff:${p.turnId}`, name: "fileDiff", text: p.diff });
      if (message.method === "error") await context.emit({ type: "notice", text: p.error?.message ?? JSON.stringify(p) });
      if (message.method === "configWarning" || message.method === "warning") await context.emit({ type: "notice", text: p.message ?? p.summary ?? JSON.stringify(p) });
      if (message.method === "item/agentMessage/delta") { textIds.add(p.itemId); await context.emit({ type: "text", id: p.itemId, delta: p.delta }); }
      if (message.method === "item/started" && p.item?.type === "contextCompaction") await context.emit({ type: "phase", phase: "compacting" });
      if (message.method === "item/started" && ["commandExecution", "fileChange", "mcpToolCall", "dynamicToolCall", "webSearch", "collabAgentToolCall", "imageGeneration", "imageView"].includes(p.item?.type)) {
        await context.emit({ type: "phase", phase: "executing" });
        await context.emit({ type: "tool_start", id: p.item.id, name: p.item.tool ?? p.item.type, args: p.item.arguments ?? p.item.command ?? p.item.changes ?? p.item });
      }
      if (message.method === "item/completed") {
        const item = p.item;
        if (item.type === "subAgentActivity") await context.emit({ type: "detail", id: item.id, name: "subAgentActivity", text: JSON.stringify(item, null, 2) });
        if (item.type === "plan") await context.emit({ type: "detail", id: `plan-item:${item.id}`, name: "plan", text: item.text ?? "" });
        if (item.type === "agentMessage" && !textIds.has(item.id)) await context.emit({ type: "text", id: item.id, delta: item.text });
        if (item.type === "contextCompaction") { await context.emit({ type: "phase", phase: "thinking" }); await context.emit({ type: "detail", id: item.id, name: "contextCompaction", text: "" }); }
        if (["commandExecution", "fileChange", "mcpToolCall", "dynamicToolCall", "webSearch", "collabAgentToolCall", "imageGeneration", "imageView"].includes(item.type)) {
          await context.emit({ type: "tool_end", id: item.id, output: codexToolOutput(item) });
          await context.emit({ type: "phase", phase: "thinking" });
        }
      }
      if (message.method === "turn/plan/updated") await context.emit({ type: "detail", id: `plan:${p.turnId}`, name: "plan", text: [p.explanation, ...(p.plan ?? []).map((step: any) => `${step.status === "completed" ? "✓" : step.status === "inProgress" ? "→" : "○"} ${step.step}`)].filter(Boolean).join("\n") });
      if (message.method === "turn/completed" && (!turnId || p.turn.id === turnId)) { host.setControl(); turnId = ""; p.turn.status === "completed" ? resolveTurn() : rejectTurn(new Error(p.turn.error?.message ?? p.turn.status)); }
    }).catch(fail);
  });
  const cancel = () => { if (threadId && turnId) write({ id: nextId++, method: "turn/interrupt", params: { threadId, turnId } }); fail(new Error("RUN_CANCELLED")); };
  controller.signal.addEventListener("abort", cancel, { once: true });
  try {
    await rpc("initialize", { clientInfo: { name: "webagentmate", version: "0.6.0" }, capabilities: { experimentalApi: true } });
    write({ method: "initialized" });
    if (start.modelsOnly && !start.codexRequest) {
      const models: any[] = []; let cursor: string | undefined;
      do { const page = await rpc("model/list", { cursor, limit: 100 }); models.push(...page.data); cursor = page.nextCursor; } while (cursor);
      send({ type: "models", models: models.filter(m => !m.hidden).map((m: any) => ({ ...m, id: m.model ?? m.id, name: m.displayName ?? m.model ?? m.id })) }); return;
    }
    if (start.codexRequest) {
      const { method, params } = start.codexRequest;
      if (!["thread/list", "thread/read", "thread/turns/list", "thread/items/list", "skills/list", "skills/config/write", "mcpServerStatus/list", "mcpServer/oauth/login"].includes(method)) throw new Error("UNSUPPORTED_CODEX_OPERATION");
      const result = await rpc(method, params);
      if (method === "mcpServer/oauth/login") {
        const waitingForLogin = new Promise<void>((resolve, reject) => {
          const check = () => { if (oauthCompleted && oauthCompleted.name === params.name) { clearTimeout(timer); controller.signal.removeEventListener("abort", cancelLogin); oauthCompleted.success ? resolve() : reject(new Error(oauthCompleted.error ?? "MCP login failed")); } };
          const cancelLogin = () => { clearTimeout(timer); reject(new Error("RUN_CANCELLED")); };
          const timer = setTimeout(() => { controller.signal.removeEventListener("abort", cancelLogin); reject(new Error("MCP login timed out")); }, 300_000);
          notifyOauth = check; controller.signal.addEventListener("abort", cancelLogin, { once: true }); check();
        });
        void waitingForLogin.catch(() => undefined);
        const answer = await context.ask({ id: crypto.randomUUID(), kind: "elicitation", title: `MCP: ${params.name}`, detail: "", url: result.authorizationUrl });
        if (JSON.parse(answer).action !== "accept") throw new Error("RUN_CANCELLED");
        await waitingForLogin;
      }
      send({ type: "codex_result", result }); return;
    }
    // Append our browser guidance to the effective user/project instructions.
    // Apply it on start, resume and fork without changing config files or the
    // native base prompt, sandbox, approval policy, skills or MCP configuration.
    const effective = await rpc("config/read", { cwd: start.config.workspace, includeLayers: false });
    const inherited = effective.config?.developer_instructions;
    const settings = { ...codexThreadSettings(start.config), developerInstructions: [typeof inherited === "string" ? inherited : "", BROWSER_TOOL_INSTRUCTIONS].filter(Boolean).join("\n\n") };
    const thread = await rpc(start.nativeSessionId ? "thread/resume" : start.nativeForkFromId ? "thread/fork" : "thread/start", start.nativeSessionId ? { ...settings, threadId: start.nativeSessionId } : start.nativeForkFromId ? { ...settings, threadId: start.nativeForkFromId, deferGoalContinuation: true } : { ...settings, dynamicTools: BROWSER_TOOLS.map(t => ({ name: `wam_${t.name}`, description: t.description, inputSchema: t.parameters })) });
    threadId = thread.thread.id;
    await context.emit({ type: "session", id: threadId });
    await context.emit({ type: "detail", id: `settings:${threadId}`, name: "nativeSettings", text: JSON.stringify({ model: thread.model, reasoningEffort: start.config.codex?.effort ?? thread.reasoningEffort, approvalPolicy: thread.approvalPolicy, sandbox: thread.sandbox, serviceTier: thread.serviceTier, instructionSources: thread.instructionSources }, null, 2) });
    await context.emit({ type: "phase", phase: "thinking" });
    if (/\$[\w:.-]+/.test(start.prompt)) {
      const catalog = await rpc("skills/list", { cwds: [start.config.workspace] });
      skills = catalog.data.flatMap((entry: any) => entry.skills);
    }
    host.setControl(async (id, text) => {
      if (!turnId) throw new Error("CODEX_TURN_NOT_ACTIVE");
      if (/\$[\w:.-]+/.test(text)) { const catalog = await rpc("skills/list", { cwds: [start.config.workspace] }); skills = catalog.data.flatMap((entry: any) => entry.skills); }
      await rpc("turn/steer", { threadId, expectedTurnId: turnId, clientUserMessageId: id, input: codexInput(text, skills) });
      await context.emit({ type: "steered", id, text });
    });
    await rpc("turn/start", { threadId, input: codexInput(nativePrompt(start), skills), ...codexTurnSettings(start.config, thread.model, thread.reasoningEffort) });
    await turn;
    await eventQueue;
  } finally {
    host.setControl();
    controller.signal.removeEventListener("abort", cancel);
    // EOF lets app-server flush the completed thread before the next process
    // resumes it. Retain a bounded forced shutdown for an unresponsive server.
    child.stdin.end();
    await new Promise<void>(resolve => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      const exited = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => { child.removeListener("exit", exited); resolve(); }, 1500);
      child.once("exit", exited);
    });
    lines.close(); cleanup(); cleanups.delete(cleanup);
    for (const waiter of waiting.values()) clearTimeout(waiter.timer);
  }
}
