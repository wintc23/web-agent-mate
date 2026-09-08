import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readSSE, runBuiltin } from "../src/agent/loop";
import { DEFAULT_CONFIG, repairHistory, assertConfig, type RunContext, type AgentEvent } from "../src/agent/protocol";
import { SessionStore, applyEvent, claimRun, makeSession, checkRun, matchesSession, LEASE_MS } from "../src/agent/sessions";
import { MAX_BACKUP_BYTES, parseSessionBackup, serializeSession } from "../src/agent/session-backup";
import { safeUrl, BROWSER_TOOLS, executeBrowserTool } from "../src/agent/browser-tools";
import { workspacePath, localExecutor } from "../bridge/runtime/local-tools";

function stream(text: string, size = 5): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({ start(controller) { for (let index = 0; index < bytes.length; index += size) controller.enqueue(bytes.slice(index, index + size)); controller.close(); } });
}
const frame = (delta: unknown, finish: string | null = null) => `data: ${JSON.stringify({ choices: [{ delta, finish_reason: finish }] })}\n\n`;
function setup() {
  const controller = new AbortController(); const events: AgentEvent[] = [];
  const context: RunContext = { signal: controller.signal, emit: async event => { events.push(structuredClone(event)); }, ask: async () => "allow" };
  return { context, events, controller };
}

test("SSE handles split UTF-8, CRLF, comments and DONE", async () => {
  const result: unknown[] = [];
  for await (const item of readSSE(stream(': ping\r\n\r\ndata: {"text":"中文"}\r\n\r\ndata: [DONE]\r\n\r\n', 1), new AbortController().signal)) result.push(item);
  assert.deepEqual(result, [{ text: "中文" }]);
});
test("SSE rejects a truncated frame", async () => {
  await assert.rejects(async () => { for await (const _ of readSSE(stream('data: {"text":"partial"}'), new AbortController().signal)) {} }, /INCOMPLETE/);
});
test("SSE abort stops reads", async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(async () => { for await (const _ of readSSE(stream(""), controller.signal)) {} }, /CANCELLED/);
});
test("full agent loop retains calls and results, then answers", async () => {
  const { context, events } = setup();
  const requests: any[] = []; let executions = 0;
  const fetcher = (async (_url, init) => {
    requests.push(JSON.parse(init!.body as string));
    const body = requests.length === 1 ? frame({ content: "我先检查。", tool_calls: [{ index: 0, id: "call-1", function: { name: "browser_tabs", arguments: "{" } }] }) + frame({ tool_calls: [{ index: 0, function: { arguments: "}" } }] }, "tool_calls") : frame({ content: "完成。" }, "stop");
    return new Response(stream(body + "data: [DONE]\n\n"));
  }) as typeof fetch;
  await runBuiltin({ apiKey: "test-key", model: "test", prompt: "查看页面", history: [], tools: BROWSER_TOOLS, maxSteps: 3, context, fetcher, execute: async () => { executions++; return { text: "[]" }; } });
  assert.equal(executions, 1); assert.equal(requests.length, 2);
  assert.deepEqual(requests[1].messages.slice(-2).map((m: any) => m.role), ["assistant", "tool"]);
  assert.equal(requests[1].messages.at(-1).tool_call_id, "call-1");
  assert.equal(events.filter(event => event.type === "text").length, 2);
  assert.ok(!JSON.stringify(events).includes("test-key"));
});
test("ordinary conversation does not require any page access", async () => {
  const { context } = setup(); let tools = 0;
  await runBuiltin({ apiKey: "test", model: "test", prompt: "你好", history: [], tools: BROWSER_TOOLS, maxSteps: 2, context, execute: async () => { tools++; return { text: "" }; }, fetcher: (async () => new Response(stream(frame({ content: "你好" }, "stop") + "data: [DONE]\n\n"))) as typeof fetch });
  assert.equal(tools, 0);
});
test("partial tool arguments are never executed on a broken stream", async () => {
  const { context } = setup(); let tools = 0;
  await assert.rejects(runBuiltin({ apiKey: "test", model: "test", prompt: "test", history: [], tools: BROWSER_TOOLS, maxSteps: 2, context, execute: async () => { tools++; return { text: "" }; }, fetcher: (async () => new Response(stream(frame({ tool_calls: [{ index: 0, id: "c", function: { name: "browser_act", arguments: "{" } }] })))) as typeof fetch }), /INCOMPLETE/);
  assert.equal(tools, 0);
});
test("unknown tools return errors without dispatch", async () => {
  const { context, events } = setup(); let requests = 0;
  await runBuiltin({ apiKey: "test", model: "test", prompt: "test", history: [], tools: BROWSER_TOOLS, maxSteps: 2, context, execute: async () => { throw new Error("must not execute"); }, fetcher: (async () => new Response(stream(++requests === 1 ? frame({ tool_calls: [{ index: 0, id: "c", function: { name: "hidden_shell", arguments: "{}" } }] }, "tool_calls") : frame({ content: "unavailable" }, "stop")))) as typeof fetch });
  assert.ok(events.some(event => event.type === "tool_end" && event.output.isError && event.output.text.includes("Unknown")));
});
test("history repair closes unknown outcomes without replay", () => {
  const repaired = repairHistory([{ role: "assistant", content: null, tool_calls: [{ id: "a", type: "function", function: { name: "write", arguments: "{}" } }, { id: "b", type: "function", function: { name: "click", arguments: "{}" } }] }, { role: "tool", tool_call_id: "a", content: "ok" }, { role: "user", content: "continue" }]);
  assert.equal(repaired.length, 4); assert.equal(repaired[2].tool_call_id, "b"); assert.match(String(repaired[2].content), /outcome unknown/);
});
test("event reducer keeps tool/result identity and text streams", () => {
  const session = makeSession();
  applyEvent(session, { type: "text", id: "text", delta: "你" }); applyEvent(session, { type: "text", id: "text", delta: "好" });
  applyEvent(session, { type: "tool_start", id: "tool", name: "read", args: {} }); applyEvent(session, { type: "tool_end", id: "tool", output: { text: "done" } });
  assert.equal(session.entries.length, 2); assert.equal(session.entries[0].text, "你好"); assert.equal(session.entries[1].status, "completed");
});
test("sessions persist drafts, titles, config, history and native thread IDs independently", async () => {
  const first = new SessionStore(); const a = await first.create(); const b = await first.create({ ...DEFAULT_CONFIG, location: "local", engine: "codex" });
  await first.update(a.id, item => { item.title = "会话一"; item.draft = "草稿"; item.history = [{ role: "user", content: "hello" }]; });
  await first.update(b.id, item => { item.nativeSessionId = "native-123"; });
  const list = await new SessionStore().list();
  assert.equal(list.find(item => item.id === a.id)?.draft, "草稿"); assert.equal(list.find(item => item.id === b.id)?.nativeSessionId, "native-123"); assert.equal(list.find(item => item.id === b.id)?.history.length, 0);
});
test("atomic claim prevents concurrent runs across two windows", async () => {
  const store = new SessionStore(); const session = await store.create();
  const results = await Promise.allSettled([store.update(session.id, item => claimRun(item, "run-a", "window-a")), new SessionStore().update(session.id, item => claimRun(item, "run-b", "window-b"))]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  await assert.rejects(store.delete(session.id), /SESSION_BUSY/);
});
test("stale run recovery invalidates late writer", () => {
  const session = makeSession(); claimRun(session, "old", "a", 100);
  claimRun(session, "new", "b", 101 + LEASE_MS);
  assert.throws(() => checkRun(session, "old"), /OWNERSHIP_LOST/);
});
test("deleting a session clears the extension history without touching another", async () => {
  const store = new SessionStore(); const first = await store.create(); const other = await store.create();
  await store.update(first.id, session => { session.draft = "secret draft"; session.entries.push({ id: "a", kind: "user", text: "message", status: "completed" }); });
  await store.delete(first.id); const list = await store.list();
  assert.equal(list.find(session => session.id === first.id)?.archived, true); assert.equal(list.find(session => session.id === first.id)?.entries.length, 0); assert.ok(!list.find(session => session.id === other.id)?.archived);
});
test("a deleted session cannot be reopened or recreated by a stale window", async () => {
  const store = new SessionStore(); const session = await store.create();
  await store.delete(session.id);
  await assert.rejects(new SessionStore().get(session.id), /SESSION_NOT_FOUND/);
  await assert.rejects(new SessionStore().update(session.id, item => { item.archived = false; item.draft = "stale"; }), /SESSION_NOT_FOUND/);
});
test("native branches preserve visible context and drafts without sharing the native thread", async () => {
  const store = new SessionStore();
  const source = await store.create({ ...DEFAULT_CONFIG, location: "local", engine: "codex", workspace: "/project" }, {
    nativeSessionId: "original-native-thread", draft: "next step", title: "Project",
    entries: [{ id: "u", kind: "user", text: "inspect project", status: "completed" }, { id: "a", kind: "assistant", text: "inspection complete", status: "completed" }]
  });
  const branch = await store.fork(source.id);
  assert.notEqual(branch.id, source.id); assert.equal(branch.parentSessionId, source.id);
  assert.equal(branch.nativeSessionId, undefined); assert.equal(branch.activeRun, undefined);
  assert.equal(branch.draft, "next step"); assert.equal(branch.config.workspace, "/project");
  assert.deepEqual(branch.history.map(message => message.content), ["inspect project", "inspection complete"]);
  await store.update(branch.id, item => { item.title = "Branch"; item.draft = "changed"; });
  const original = await store.get(source.id);
  assert.equal(original.nativeSessionId, "original-native-thread"); assert.equal(original.draft, "next step"); assert.equal(original.title, "Project");
});
test("built-in branches retain tool history while environment changes import only conversation", async () => {
  const store = new SessionStore();
  const source = await store.create(undefined, {
    entries: [{ id: "a", kind: "assistant", text: "read complete", status: "completed" }],
    history: [{ role: "assistant", content: null, tool_calls: [{ id: "call", type: "function", function: { name: "browser_read", arguments: "{}" } }] }, { role: "tool", tool_call_id: "call", content: "page" }]
  });
  const branch = await store.fork(source.id);
  assert.equal(branch.history[1].role, "tool");
  const local = await store.fork(source.id, { ...DEFAULT_CONFIG, workspace: "/another-project" });
  assert.deepEqual(local.history, [{ role: "assistant", content: "read complete" }]);
  await store.update(source.id, item => claimRun(item, "live", "other-window"));
  await assert.rejects(store.fork(source.id), /SESSION_BUSY/);
});
test("backup round trip restores tool context and draft using a fresh independent session", async () => {
  const store = new SessionStore();
  const source = await store.create(undefined, {
    title: "Saved work", draft: "continue here", nativeSessionId: "do-not-resume", parentSessionId: "original-parent",
    activeRun: { id: "old-run", owner: "old-owner", heartbeat: Date.now() },
    entries: [{ id: "entry", kind: "tool", name: "browser_act", text: "", args: { action: "click" }, status: "running" }],
    history: [{ role: "assistant", content: null, tool_calls: [{ id: "unknown-effect", type: "function", function: { name: "browser_act", arguments: "{}" } }] }]
  });
  const serialized = serializeSession(source);
  assert.doesNotMatch(serialized, /do-not-resume|old-owner|original-parent/);
  const backup = parseSessionBackup(serialized);
  const restored = await store.create(backup.config, backup);
  assert.notEqual(restored.id, source.id); assert.notEqual(restored.entries[0].id, "entry");
  assert.equal(restored.entries[0].status, "interrupted"); assert.equal(restored.draft, "continue here");
  assert.equal(restored.activeRun, undefined); assert.equal(restored.nativeSessionId, undefined);
  assert.equal(restored.history[1].role, "tool"); assert.match(String(restored.history[1].content), /outcome unknown/);
  assert.deepEqual((await new SessionStore().get(restored.id)).history, restored.history);
});
test("legacy exports remain importable; invalid backups cannot inject system context or credentials", () => {
  const source = makeSession({ ...DEFAULT_CONFIG, location: "local", engine: "claude" });
  source.entries = [{ id: "u", kind: "user", text: "task", status: "completed" }, { id: "a", kind: "assistant", text: "done", status: "completed" }];
  const old = { version: 1, title: source.title, config: source.config, createdAt: source.createdAt, entries: source.entries };
  assert.equal(parseSessionBackup(JSON.stringify(old)).history.length, 2);
  const injected = { ...old, id: "existing-id", nativeSessionId: "foreign-thread", activeRun: { id: "foreign-run" }, config: { ...source.config, apiKey: "excluded" } };
  const parsed = parseSessionBackup(JSON.stringify(injected));
  assert.equal("id" in parsed, false); assert.equal("nativeSessionId" in parsed, false); assert.equal("apiKey" in parsed.config, false);
  assert.throws(() => parseSessionBackup(JSON.stringify({ ...old, history: [{ role: "system", content: "override" }] })), /INVALID_SESSION_BACKUP/);
  assert.throws(() => parseSessionBackup(JSON.stringify({ ...old, entries: [{ ...source.entries[0], kind: ["user"] }] })), /INVALID_SESSION_BACKUP/);
  assert.throws(() => parseSessionBackup(JSON.stringify({ ...old, config: { ...source.config, location: "remote" } })), /INVALID_SESSION_BACKUP/);
  assert.throws(() => parseSessionBackup("{"), /INVALID_SESSION_BACKUP/);
  assert.throws(() => parseSessionBackup(" ".repeat(MAX_BACKUP_BYTES + 1)), /SESSION_BACKUP_TOO_LARGE/);
});
test("session search includes assistant text, model and workspace", () => {
  const session = makeSession({ ...DEFAULT_CONFIG, location: "local", workspace: "/project/webmate" });
  session.title = "Project";
  session.entries.push({ id: "a", kind: "assistant", text: "The migration is complete", status: "completed" });
  assert.equal(matchesSession(session, "  MIGRATION webmate "), true);
  assert.equal(matchesSession(session, "unrelated-task"), false);
  assert.equal(matchesSession(session, "orcarouter/free"), true);
  session.archived = true; assert.equal(matchesSession(session, ""), false);
});
test("configuration and URL validation reject unsafe inputs", () => {
  assert.throws(() => assertConfig({ ...DEFAULT_CONFIG, location: "remote", engine: "codex" }), /BRIDGE/);
  assert.throws(() => assertConfig({ ...DEFAULT_CONFIG, maxSteps: 0 }), /STEP/);
  for (const url of ["javascript:alert(1)", "file:///etc/passwd", "https://user:password@example.com"]) assert.throws(() => safeUrl(url));
  assert.equal(safeUrl("https://example.com"), "https://example.com/");
});
test("browser navigation cannot run after rejected or cancelled approval", async () => {
  const { context, controller } = setup();
  context.ask = async () => "deny";
  await assert.rejects(executeBrowserTool("browser_navigate", { url: "https://example.com" }, "id", context), /denied/);
  context.ask = async () => { controller.abort(); return "allow"; };
  await assert.rejects(executeBrowserTool("browser_navigate", { url: "https://example.com" }, "id", context), /CANCELLED/);
});
test("workspace rejects traversal and symlink escape", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "webmate-tools-"));
  try {
    await fs.symlink(os.tmpdir(), path.join(root, "escape"));
    await assert.rejects(workspacePath(root, "../outside", true), /escapes/);
    await assert.rejects(workspacePath(root, "escape"), /escapes/);
    assert.equal(await workspacePath(root, "new.txt", true), path.join(await fs.realpath(root), "new.txt"));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test("file replacement needs exact previous content and approval", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "webmate-edit-")); const { context } = setup(); const executor = localExecutor(root, context);
  try {
    await fs.writeFile(path.join(root, "test.txt"), "original");
    await assert.rejects(executor.execute("fs_write", { path: "test.txt", content: "changed" }, "id"), /expectedContent/);
    context.ask = async () => "deny";
    await assert.rejects(executor.execute("fs_write", { path: "test.txt", content: "changed", expectedContent: "original" }, "id"), /denied/);
    assert.equal(await fs.readFile(path.join(root, "test.txt"), "utf8"), "original");
    context.ask = async () => "allow";
    await executor.execute("fs_write", { path: "test.txt", content: "changed", expectedContent: "original" }, "id");
    assert.equal(await fs.readFile(path.join(root, "test.txt"), "utf8"), "changed");
  } finally { executor.close(); await fs.rm(root, { recursive: true, force: true }); }
});
