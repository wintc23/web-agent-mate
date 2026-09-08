import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { runBuiltin } from "../src/agent/loop";
import { LoopGuard } from "../src/agent/loop-guard";
import { DEFAULT_CONFIG, assertConfig, builtinStepLimit, type AgentEvent, type RunContext, type ToolOutput, type WireMessage } from "../src/agent/protocol";
import { BROWSER_TOOLS } from "../src/agent/browser-tools";
import { LOCAL_TOOLS } from "../bridge/runtime/local-tools";
import { makeSession, SessionStore } from "../src/agent/sessions";
import { parseSessionBackup, serializeSession } from "../src/agent/session-backup";

function harness(call: (n: number) => { name: string; args?: object }[] | undefined, execute: (n: number) => ToolOutput, maxSteps?: number) {
  const controller = new AbortController();
  let executed = 0, requested = 0;
  let history: WireMessage[] = [];
  const context: RunContext = { signal: controller.signal, ask: async () => "allow", emit: async (event: AgentEvent) => { if (event.type === "checkpoint") history = event.history; } };
  return { controller, get executed() { return executed; }, get history() { return history; }, run: () => runBuiltin({
    apiKey: "test", model: "test", prompt: "Finish this task", history: [], maxSteps, context,
    tools: [...BROWSER_TOOLS, ...LOCAL_TOOLS],
    execute: async () => execute(++executed),
    fetcher: (async () => {
      const calls = call(++requested);
      const delta = calls ? { tool_calls: calls.map((tool, index) => ({ index, id: `${requested}-${index}`, function: { name: tool.name, arguments: JSON.stringify(tool.args ?? {}) } })) } : { content: "Done" };
      return new Response(`data: ${JSON.stringify({ choices: [{ delta, finish_reason: calls ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`);
    }) as typeof fetch
  }) };
}

test("default and legacy sessions have no built-in budget; explicit budgets survive storage and backups", async () => {
  const legacy = { ...DEFAULT_CONFIG }; delete legacy.limitToolCalls;
  assert.equal(builtinStepLimit(DEFAULT_CONFIG), undefined);
  assert.equal(builtinStepLimit(legacy), undefined);
  const store = new SessionStore();
  const session = await store.create({ ...legacy, maxSteps: 7, limitToolCalls: true });
  const restored = parseSessionBackup(serializeSession(await store.get(session.id)));
  assert.equal(builtinStepLimit(restored.config), 7);
  assert.equal(builtinStepLimit(parseSessionBackup(serializeSession(makeSession(legacy))).config), undefined);
  assert.throws(() => assertConfig({ ...legacy, limitToolCalls: "yes" as any }), /INVALID_STEP_LIMIT/);
});

test("a progressing run completes 40 tools without an explicit budget", async () => {
  const run = harness(n => n <= 40 ? [{ name: "fs_read", args: { path: `file-${n}.txt` } }] : undefined, n => ({ text: `file ${n}` }));
  await run.run(); assert.equal(run.executed, 40); assert.equal(run.history.at(-1)?.content, "Done");
});

test("explicit budget skips the rest of a batch and checkpoints definite non-execution", async () => {
  const run = harness(() => Array.from({ length: 3 }, () => ({ name: "browser_tabs" })), () => ({ text: "[]" }), 1);
  await assert.rejects(run.run(), /AGENT_STEP_LIMIT/);
  assert.equal(run.executed, 1);
  assert.equal(run.history.filter(message => message.role === "tool").length, 3);
  assert.match(String(run.history.at(-1)?.content), /Not executed: AGENT_STEP_LIMIT/);
});

test("the model can answer after using exactly its optional budget", async () => {
  const run = harness(n => n === 1 ? [{ name: "browser_tabs" }] : undefined, () => ({ text: "[]" }), 1);
  await run.run(); assert.equal(run.executed, 1); assert.equal(run.history.at(-1)?.content, "Done");
});

test("eight consecutive failures pause after preserving the final error", async () => {
  const run = harness(n => [{ name: "fs_read", args: { path: `${n}.txt` } }], n => { throw new Error(`Missing file ${n}`); });
  await assert.rejects(run.run(), /AGENT_CONSECUTIVE_FAILURES/);
  assert.equal(run.executed, 8); assert.match(String(run.history.at(-1)?.content), /Missing file 8/);
});

test("successful recovery resets consecutive failures", async () => {
  const run = harness(n => n <= 15 ? [{ name: "browser_tabs" }] : undefined, n => ({ text: `result ${n}`, isError: n !== 8 }));
  await run.run(); assert.equal(run.executed, 15);
});

test("a repeated read/wait loop pauses despite fresh snapshot and tool IDs", async () => {
  const run = harness(n => n % 2 ? [{ name: "browser_read", args: { tabId: 1 } }] : [{ name: "browser_wait", args: { milliseconds: 5000 } }], n => ({ text: n % 2 ? JSON.stringify({ snapshot: `fresh-${n}`, text: "unchanged page" }) : "Wait completed" }));
  await assert.rejects(run.run(), /AGENT_NO_PROGRESS/); assert.equal(run.executed, 12);
});

test("live process polling is not treated as a stalled agent", async () => {
  const run = harness(n => n <= 40 ? [{ name: "process_read", args: { processId: "p" } }] : undefined, () => ({ text: JSON.stringify({ processId: "p", output: "", done: false, exitCode: null }) }));
  await run.run(); assert.equal(run.executed, 40);
});

test("changing images count as progress and argument key order does not hide repetition", () => {
  const guard = new LoopGuard();
  for (let n = 0; n < 40; n++) assert.equal(guard.observe("browser_screenshot", { tabId: 1 }, { text: "Screenshot", image: `image-${n}` }), undefined);
  const repeat = new LoopGuard();
  for (let n = 0; n < 11; n++) assert.equal(repeat.observe("fs_read", n % 2 ? { path: "a", offset: 0 } : { offset: 0, path: "a" }, { text: "same" }), undefined);
  assert.equal(repeat.observe("fs_read", { path: "a", offset: 0 }, { text: "same" }), "AGENT_NO_PROGRESS");
});

test("an unlimited run remains manually cancellable beyond the old cap", async () => {
  const run = harness(n => [{ name: "fs_read", args: { path: `${n}.txt` } }], n => { if (n === 30) run.controller.abort(); return { text: `${n}` }; });
  await assert.rejects(run.run(), /RUN_CANCELLED/); assert.equal(run.executed, 30);
});
