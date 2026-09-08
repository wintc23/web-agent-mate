import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { complete, runBuiltin } from "../src/agent/loop";
import { compactHistory } from "../src/agent/context";
import { RuntimeDecoder, encodeRuntimeMessage, MAX_RUNTIME_BYTES } from "../src/agent/transport";
import { validateToolArguments, toolSchema } from "../src/agent/schema";
import { BROWSER_TOOLS } from "../src/agent/browser-tools";
import { localExecutor } from "../bridge/runtime/local-tools";
import type { AgentEvent, RunContext, WireMessage } from "../src/agent/protocol";

function setup() {
  const controller = new AbortController(); const events: AgentEvent[] = [];
  const context: RunContext = { signal: controller.signal, emit: async event => { events.push(event); }, ask: async () => "allow" };
  return { controller, events, context };
}
const chunk = (text: string, finish: string | null = "stop") => `data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: finish }] })}\n\n`;
const stream = (data: string) => new Response(data + "data: [DONE]\n\n");
const defaults = { apiKey: "test-key", model: "test", tools: BROWSER_TOOLS, history: [], timeouts: { connect: 25, idle: 25, total: 200, retryDelay: 1 } };

test("large native messages round-trip Unicode, quotes, control characters and image data below Chrome's cap", () => {
  const message = { type: "start", history: "中文😀\"\n\u0000".repeat(120_000), image: "data:image/jpeg;base64," + "a".repeat(1_100_000) };
  const frames = encodeRuntimeMessage(message); assert.ok(frames.length > 1);
  const decoder = new RuntimeDecoder(); let decoded;
  for (const frame of frames) { assert.ok(Buffer.byteLength(JSON.stringify(frame)) < 1_048_576); decoded = decoder.push(JSON.parse(JSON.stringify(frame))); }
  decoder.finish(); assert.deepEqual(decoded, message);
});
test("native framing rejects excess size, out-of-order, interleaved and incomplete transfers", () => {
  assert.throws(() => encodeRuntimeMessage({ data: "x".repeat(MAX_RUNTIME_BYTES) }), /TOO_LARGE/);
  const frames = encodeRuntimeMessage({ history: "x".repeat(600_000) });
  assert.throws(() => new RuntimeDecoder().push(frames[1]), /OUT_OF_ORDER/);
  const decoder = new RuntimeDecoder(); decoder.push(frames[0]);
  assert.throws(() => decoder.push({ type: "done" }), /INCOMPLETE/);
  decoder.push(frames[0]); assert.throws(() => decoder.finish(), /INCOMPLETE/);
});
test("missing native fragments time out even when no more messages arrive", async () => {
  let failure = "";
  const decoder = new RuntimeDecoder(Date.now, error => { failure = error.message; }, 10);
  decoder.push(encodeRuntimeMessage({ history: "x".repeat(600_000) })[0]);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(failure, "RUNTIME_CHUNK_TIMEOUT"); decoder.finish();
});
test("provider connect and stalled-stream timeouts terminate without retrying", async () => {
  const { context } = setup(); let requests = 0;
  await assert.rejects(complete({ ...defaults, context, fetcher: (async (_url, init) => {
    requests++; return await new Promise((_resolve, reject) => init!.signal!.addEventListener("abort", () => reject(new Error("aborted"))));
  }) as typeof fetch }), /CONNECT_TIMEOUT/);
  assert.equal(requests, 1);
  let cancelled = false;
  await assert.rejects(complete({ ...defaults, context, fetcher: (async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }))) as typeof fetch }), /STREAM_TIMEOUT/);
  assert.equal(cancelled, true);
});
test("transient pre-output failure retries once, but never a partial stream or auth failure", async () => {
  const { context } = setup(); let requests = 0;
  const answer = await complete({ ...defaults, context, fetcher: (async () => ++requests === 1 ? new Response("busy", { status: 503 }) : stream(chunk("ready"))) as typeof fetch });
  assert.equal(answer.content, "ready"); assert.equal(requests, 2);
  requests = 0;
  await assert.rejects(complete({ ...defaults, context, fetcher: (async () => { requests++; return stream(chunk("partial", null)); }) as typeof fetch }), /INCOMPLETE/);
  assert.equal(requests, 1);
  requests = 0;
  await assert.rejects(complete({ ...defaults, context, fetcher: (async () => { requests++; return new Response("invalid", { status: 401 }); }) as typeof fetch }), /AUTH/);
  assert.equal(requests, 1);
});
test("user cancellation closes a waiting model stream promptly", async () => {
  const { context, controller } = setup(); let cancelled = false;
  const task = complete({ ...defaults, context, fetcher: (async () => new Response(new ReadableStream({ start() { setTimeout(() => controller.abort(), 5); }, cancel() { cancelled = true; } }))) as typeof fetch });
  await assert.rejects(task, /CANCELLED/); assert.equal(cancelled, true);
});
test("compaction preserves the current request and complete recent tool groups", async () => {
  const { context, events } = setup();
  const prompt = "Keep the original files. Verify the change.";
  const history: WireMessage[] = [
    { role: "system", content: "agent instructions" }, { role: "user", content: prompt },
    { role: "assistant", content: "Old findings ".repeat(10_000) },
    { role: "assistant", content: null, tool_calls: [{ id: "recent", type: "function", function: { name: "fs_read", arguments: "{}" } }] },
    { role: "tool", tool_call_id: "recent", content: "Current file contents" }
  ];
  let summaries = 0;
  assert.equal(await compactHistory({ history, tools: [], prompt, contextLength: 8192, context, summarize: async messages => { summaries++; assert.ok(JSON.stringify(messages).includes("excerpt")); return "User wants a verified edit. Original files must be kept. Earlier findings recorded."; } }), true);
  assert.ok(summaries > 1); assert.ok(history.some(message => message.content === prompt));
  assert.equal(history.at(-2)?.tool_calls?.[0].id, "recent"); assert.equal(history.at(-1)?.tool_call_id, "recent");
  assert.ok(events.some(event => event.type === "phase" && event.phase === "compacting"));
});
test("failed compaction leaves its source history intact", async () => {
  const { context } = setup(); const history: WireMessage[] = [{ role: "system", content: "system" }, { role: "user", content: "old".repeat(20_000) }, { role: "user", content: "continue" }];
  const original = structuredClone(history);
  await assert.rejects(compactHistory({ history, tools: [], prompt: "continue", contextLength: 8192, context, summarize: async () => { throw new Error("summary connection failed"); } }), /summary connection/);
  assert.deepEqual(history, original);
});
test("tool schemas reject missing fields, coercion, unknown fields and invalid enum values across adapters", () => {
  for (const args of [{}, { tabId: "1", snapshot: "s", action: "click" }, { tabId: 1, snapshot: "s", action: "buy" }, { tabId: 1, snapshot: "s", action: "click", hidden: true }]) assert.throws(() => validateToolArguments(BROWSER_TOOLS, "browser_act", args), /Invalid tool arguments/);
  const schema = toolSchema(BROWSER_TOOLS.find(tool => tool.name === "browser_act")!);
  assert.equal(schema.shape.action.safeParse("buy").success, false);
  validateToolArguments(BROWSER_TOOLS, "browser_act", { tabId: 1, snapshot: "s", action: "scroll", direction: "down" });
});
test("text-only models receive neither screenshots nor old image input", async () => {
  const { context } = setup(); let request: any;
  await runBuiltin({ apiKey: "test", model: "test", prompt: "continue", history: [{ role: "user", content: [{ type: "image_url", image_url: { url: "data:image/png;base64,aaaa" } }] }], tools: BROWSER_TOOLS, maxSteps: 2, supportsVision: false, context, execute: async () => { throw new Error("unneeded"); }, fetcher: (async (_url, init) => { request = JSON.parse(init!.body as string); return stream(chunk("ready")); }) as typeof fetch });
  assert.ok(!request.tools.some((tool: any) => tool.function.name === "browser_screenshot"));
  assert.ok(!JSON.stringify(request.messages).includes("data:image"));
});
test("segmented file reads and exact edits preserve unrelated text and executable mode", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "wam-tools-")); const { context } = setup(); const local = localExecutor(workspace, context);
  try {
    const file = path.join(workspace, "source.txt"); const original = Array.from({ length: 5000 }, (_, i) => `line ${i + 1}: original text`).join("\n");
    await fs.writeFile(file, original, { mode: 0o755 });
    const read = JSON.parse((await local.execute("fs_read", { path: "source.txt", startLine: 3000, limit: 2 }, "read")).text);
    assert.equal(read.nextLine, 3002); assert.match(read.content, /3000: line 3000/);
    await assert.rejects(local.execute("fs_edit", { path: "source.txt", oldText: "original text", newText: "changed" }, "ambiguous"), /exactly once/);
    await local.execute("fs_edit", { path: "source.txt", oldText: "line 3000: original text", newText: "line 3000: verified change" }, "edit");
    assert.equal(await fs.readFile(file, "utf8"), original.replace("line 3000: original text", "line 3000: verified change"));
    if (process.platform !== "win32") assert.equal((await fs.stat(file)).mode & 0o777, 0o755);
    context.ask = async () => { await fs.writeFile(file, "concurrent edit"); return "allow"; };
    await assert.rejects(local.execute("fs_edit", { path: "source.txt", oldText: "line 3000: verified change", newText: "new" }, "concurrent"), /changed during approval/);
    assert.equal(await fs.readFile(file, "utf8"), "concurrent edit");
  } finally { local.close(); await fs.rm(workspace, { recursive: true, force: true }); }
});

test("approved commands execute and completed processes do not consume concurrent slots", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "wam-process-")); const { context } = setup(); const local = localExecutor(workspace, context);
  const quotedNode = process.platform === "win32" ? `"${process.execPath}"` : `'${process.execPath.replace(/'/g, "'\\''")}'`;
  try {
    await fs.writeFile(path.join(workspace, "verify.cjs"), "require('node:fs').writeFileSync('proof.txt','verified');console.log('process-ok');");
    for (let i = 0; i < 5; i++) {
      let result = JSON.parse((await local.execute("shell_start", { command: `${quotedNode} verify.cjs` }, String(i))).text);
      for (let attempt = 0; !result.done && attempt < 30; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 30));
        result = JSON.parse((await local.execute("process_read", { processId: result.processId }, "poll")).text);
      }
      assert.equal(result.done, true); assert.equal(result.exitCode, 0); assert.match(result.output, /process-ok/);
    }
    assert.equal(await fs.readFile(path.join(workspace, "proof.txt"), "utf8"), "verified");
    context.ask = async () => "deny";
    await assert.rejects(local.execute("shell_start", { command: `${quotedNode} verify.cjs` }, "deny"), /denied/);
  } finally { local.close(); await fs.rm(workspace, { recursive: true, force: true }); }
});
