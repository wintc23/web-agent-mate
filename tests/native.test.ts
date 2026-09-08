import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { codexRequest, runNative } from "../src/agent/native";
import { makeSession } from "../src/agent/sessions";
import { DEFAULT_CONFIG, type RunContext } from "../src/agent/protocol";
import { codexToolOutput, claudeToolOutput } from "../bridge/runtime/tool-output";

test("Codex and Claude document results retain downloadable JSON, including escaped long content", () => {
  const document = { filename: "report.md", content: "\n\"\\".repeat(13_000) };
  const text = JSON.stringify(document);
  assert.ok(text.length > 60_000);
  const codex = codexToolOutput({ type: "dynamicToolCall", status: "completed", success: true, contentItems: [{ type: "inputText", text }] });
  const claude = claudeToolOutput({ content: [{ type: "text", text }], is_error: false });
  assert.deepEqual(JSON.parse(codex.text), document); assert.deepEqual(JSON.parse(claude.text), document);
  assert.equal(codex.isError, false); assert.equal(claude.isError, false);
});
test("native failed tools and nonzero commands are not displayed as successful", () => {
  const failure = codexToolOutput({ type: "dynamicToolCall", status: "completed", success: false, contentItems: [{ type: "inputText", text: "Page unavailable" }] });
  assert.equal(failure.text, "Page unavailable"); assert.equal(failure.isError, true);
  assert.equal(codexToolOutput({ type: "commandExecution", status: "completed", exitCode: 2, aggregatedOutput: "command failed" }).isError, true);
  assert.equal(codexToolOutput({ type: "mcpToolCall", status: "failed", error: { message: "connection lost" } }).text, "connection lost");
  assert.equal(claudeToolOutput({ content: "Tool denied", is_error: true }).isError, true);
});
test("native screenshot display preserves text without saving the image's base64 in the transcript", () => {
  const codex = codexToolOutput({ type: "dynamicToolCall", contentItems: [{ type: "inputText", text: "Screenshot of the page" }, { type: "inputImage", imageUrl: "data:image/jpeg;base64,large-image" }] });
  const claude = claudeToolOutput({ content: [{ type: "text", text: "Screenshot of the page" }, { type: "image", source: { data: "large-image" } }] });
  assert.equal(codex.text, "Screenshot of the page"); assert.equal(claude.text, "Screenshot of the page");
});

const tick = () => new Promise(resolve => setImmediate(resolve));
function nativeFixture() {
  const messages: Array<(message: any) => void> = [], disconnects: Array<() => void> = [];
  const sent: any[] = [];
  const port = { postMessage: (message: any) => { sent.push(message); }, disconnect() {},
    onMessage: { addListener: (listener: any) => messages.push(listener) }, onDisconnect: { addListener: (listener: any) => disconnects.push(listener) } };
  const previous = globalThis.chrome;
  globalThis.chrome = { runtime: { connectNative: () => port }, tabs: {} } as unknown as typeof chrome;
  const controller = new AbortController();
  const context: RunContext = { signal: controller.signal, emit: async () => undefined, ask: async () => "allow" };
  const session = makeSession({ ...DEFAULT_CONFIG, location: "local", engine: "codex" });
  return { port, context, session, sent, message: (message: any) => messages.forEach(listener => listener(message)),
    disconnect: () => disconnects.forEach(listener => listener()), restore: () => { globalThis.chrome = previous; controller.abort(); } };
}
test("a host closing after done waits for queued transcript persistence before completing", async () => {
  const fixture = nativeFixture();
  let persisted = false, finished = false;
  let release!: () => void;
  fixture.context.emit = () => new Promise(resolve => { release = () => { persisted = true; resolve(); }; });
  try {
    const run = runNative(fixture.session, "hello", fixture.context).then(() => { finished = true; });
    fixture.message({ type: "event", event: { type: "text", id: "reply", delta: "saved" } });
    await tick(); fixture.message({ type: "done" }); fixture.disconnect();
    await tick(); assert.equal(finished, false); release(); await run;
    assert.equal(persisted, true); assert.equal(finished, true);
  } finally { fixture.restore(); }
});
test("late approval cannot navigate after the native host disconnects", async () => {
  const fixture = nativeFixture(); let approve!: (answer: string) => void; let navigations = 0;
  fixture.context.ask = () => new Promise(resolve => { approve = resolve; });
  (globalThis.chrome.tabs as any).create = async () => { navigations++; return { id: 1 }; };
  try {
    const run = runNative(fixture.session, "navigate", fixture.context);
    const rejected = assert.rejects(run, /BRIDGE_DISCONNECTED/);
    fixture.message({ type: "browser", id: "request", payload: { name: "browser_navigate", args: { url: "https://example.test/" }, id: "call" } });
    await tick(); fixture.disconnect(); await rejected;
    approve("allow"); await tick(); assert.equal(navigations, 0);
    assert.equal(fixture.sent.filter(frame => frame.params.type === "reply").length, 0);
  } finally { fixture.restore(); }
});

test("steer acknowledgment waits for persistence and rejects pending controls on disconnect", async () => {
  const fixture = nativeFixture(); let steer: import("../src/agent/codex").NativeControl | undefined;
  try {
    const run = runNative(fixture.session, "start", fixture.context, undefined, false, { onControl: value => { steer = value; } });
    const failed = assert.rejects(run, /BRIDGE_DISCONNECTED/);
    fixture.message({ type: "event", event: { type: "native_turn", id: "turn" } }); await tick();
    let release!: () => void, confirmed = false;
    fixture.context.emit = () => new Promise(resolve => { release = resolve; });
    const delivery = steer!("message", "followup").then(() => { confirmed = true; });
    fixture.message({ type: "event", event: { type: "steered", id: "message", text: "followup" } });
    fixture.message({ type: "control_reply", id: "message" });
    await tick(); assert.equal(confirmed, false); release(); await delivery;
    assert.equal(confirmed, true);
    const pending = assert.rejects(steer!("late", "not acknowledged"), /BRIDGE_DISCONNECTED/);
    fixture.disconnect(); await failed; await pending; assert.equal(steer, undefined);
  } finally { fixture.restore(); }
});

test("new Codex management requests fail harmlessly against an old bridge runtime", async () => {
  const fixture = nativeFixture();
  try {
    const query = codexRequest(fixture.session.config, { method: "skills/list", params: {} }, fixture.context);
    const failure = assert.rejects(query, /CODEX_OPERATION_UNAVAILABLE/);
    assert.equal(fixture.sent[0].params.payload.modelsOnly, true);
    fixture.message({ type: "models", models: [{ id: "model", name: "Model" }] });
    fixture.message({ type: "done" }); await failure;
  } finally { fixture.restore(); }
});

test("runtime cleanup waits for background descendants that ignore graceful termination", { skip: process.platform === "win32" }, async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "wam-descendants-"));
  let descendant: number | undefined;
  try {
    await fs.writeFile(path.join(workspace, "stubborn.cjs"), "require('node:fs').writeFileSync('child.pid',String(process.pid));process.on('SIGTERM',()=>{});setInterval(()=>{},1000);");
    const node = `'${process.execPath.replace(/'/g, "'\\''")}'`;
    const helper = spawn(process.execPath, [path.resolve(".test-output/process-cleanup.cjs"), workspace, `${node} stubborn.cjs > /dev/null 2>&1 &`], { stdio: ["ignore", "ignore", "pipe"] });
    let errors = ""; helper.stderr.on("data", data => { errors += data; });
    const exit = await new Promise<number | null>((resolve, reject) => {
      const timeout = setTimeout(() => { helper.kill("SIGKILL"); reject(new Error("Cleanup did not finish")); }, 6000);
      helper.once("exit", code => { clearTimeout(timeout); resolve(code); }); helper.once("error", reject);
    });
    assert.equal(exit, 0, errors);
    descendant = Number(await fs.readFile(path.join(workspace, "child.pid"), "utf8"));
    assert.ok(Number.isInteger(descendant) && descendant > 1);
    let alive = true;
    for (let attempt = 0; attempt < 30; attempt++) {
      try { process.kill(descendant, 0); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") { alive = false; break; } throw error; }
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    assert.equal(alive, false, "An owned background process survived after the runtime exited");
  } finally {
    if (!descendant) descendant = Number(await fs.readFile(path.join(workspace, "child.pid"), "utf8").catch(() => "0"));
    if (Number.isInteger(descendant) && descendant > 1) { try { process.kill(descendant, "SIGKILL"); } catch { /* already gone */ } }
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
