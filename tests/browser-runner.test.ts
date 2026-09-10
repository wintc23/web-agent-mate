import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { runAgent } from "../src/agent/runner";
import { BROWSER_TOOLS } from "../src/agent/browser-tools";
import { applyEvent, SessionStore } from "../src/agent/sessions";
import type { RunContext } from "../src/agent/protocol";

function stream(delta: object): Response {
  return new Response(`data: ${JSON.stringify({ choices: [{ delta, finish_reason: "tool_calls" in delta ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`);
}
function call(name: string, args: object = {}) {
  return { tool_calls: [{ index: 0, id: "call", function: { name, arguments: JSON.stringify(args) } }] };
}

test("a browser agent completes tools and persists continuation without a native host", async t => {
  let nativeCalls = 0, tabReads = 0;
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected network request"); });
  const previous = globalThis.chrome;
  (globalThis as any).chrome = { runtime: { connectNative: () => { nativeCalls++; throw new Error("Host not installed"); } }, tabs: { query: async () => { tabReads++; return [{ id: 17, title: "Example", url: "https://example.com/", active: true }]; } } };
  t.after(() => { (globalThis as any).chrome = previous; });
  const store = new SessionStore(), session = await store.create();
  const controller = new AbortController();
  const context: RunContext = { signal: controller.signal, ask: async () => "deny", emit: async event => { await store.update(session.id, item => applyEvent(item, event)); } };
  const bodies: any[] = [];
  const fetcher = (async (_url, init) => {
    const body = JSON.parse(String(init?.body)); bodies.push(body);
    assert.deepEqual(body.tools.map((tool: any) => tool.function.name), BROWSER_TOOLS.map(tool => tool.name));
    return stream(bodies.length === 1 ? call("browser_tabs") : { content: "Found Example" });
  }) as typeof fetch;
  await runAgent(session, "Find the Example tab", context, "synthetic-key", { fetcher });
  assert.equal(nativeCalls, 0); assert.equal(tabReads, 1);
  const saved = await new SessionStore().get(session.id);
  assert.equal(saved.history.at(-1)?.content, "Found Example");
  assert.match(saved.entries.find(entry => entry.name === "browser_tabs")!.text, /Example/);
  await runAgent(saved, "Continue", context, "synthetic-key", { fetcher });
  assert(bodies.at(-1).messages.some((message: any) => message.role === "tool" && message.content.includes("Example")));
  assert.equal(nativeCalls, 0);
});

test("browser mode rejects local tools returned by a model and keeps their error in history", async () => {
  const store = new SessionStore(), session = await store.create();
  let requests = 0;
  await runAgent(session, "Task", { signal: new AbortController().signal, ask: async () => { throw new Error("Unexpected approval"); }, emit: async event => { await store.update(session.id, item => applyEvent(item, event)); } }, "synthetic-key", {
    fetcher: (async () => stream(++requests === 1 ? call("fs_read", { path: "/private/file" }) : { content: "Local tools unavailable" })) as typeof fetch
  });
  const saved = await store.get(session.id);
  const tool = saved.entries.find(entry => entry.id === "call")!;
  assert.equal(tool.status, "failed");
  assert.equal(tool.text, "Unknown or unavailable tool");
  assert.equal(saved.history.find(message => message.role === "tool")?.content, "Unknown or unavailable tool");
});

test("cancel while waiting for browser approval never navigates and does not replay on continuation", async t => {
  let navigations = 0, requests = 0;
  const previous = globalThis.chrome;
  (globalThis as any).chrome = { tabs: { create: async () => { navigations++; } } };
  t.after(() => { (globalThis as any).chrome = previous; });
  const store = new SessionStore(), session = await store.create();
  const controller = new AbortController();
  const context: RunContext = { signal: controller.signal, ask: async () => { controller.abort(); return "allow"; }, emit: async event => { await store.update(session.id, item => applyEvent(item, event)); } };
  await assert.rejects(runAgent(session, "Navigate", context, "synthetic-key", { fetcher: (async () => stream(call("browser_navigate", { url: "https://example.com/" }))) as typeof fetch }), /RUN_CANCELLED/);
  assert.equal(navigations, 0);
  const saved = await store.get(session.id);
  await runAgent(saved, "Inspect before continuing", { ...context, signal: new AbortController().signal }, "synthetic-key", { fetcher: (async (_url, init) => {
    requests++;
    const messages = JSON.parse(String(init?.body)).messages;
    assert(messages.some((message: any) => message.role === "tool" && /RUN_CANCELLED|outcome unknown/.test(message.content)));
    return stream({ content: "Stopped safely" });
  }) as typeof fetch });
  assert.equal(requests, 1); assert.equal(navigations, 0);
});

test("missing credentials and an already aborted task fail before contacting a model", async () => {
  const session = await new SessionStore().create();
  const controller = new AbortController();
  const context: RunContext = { signal: controller.signal, emit: async () => {}, ask: async () => "deny" };
  const options = { fetcher: (async () => { throw new Error("Unexpected request"); }) as typeof fetch };
  await assert.rejects(runAgent(session, "Task", context, undefined, options), /ORCA_NOT_CONNECTED/);
  controller.abort();
  await assert.rejects(runAgent(session, "Task", context, "synthetic-key", options), /RUN_CANCELLED/);
});
