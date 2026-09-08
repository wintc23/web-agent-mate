import { test } from "node:test";
import assert from "node:assert/strict";
import { agentPageUrl, openAgentPage } from "../src/agent/page";

test("opening the current conversation reuses its page without navigating a running tab", async () => {
  const actions: unknown[] = [];
  let tabs: any[] = [];
  const original = globalThis.chrome;
  globalThis.chrome = {
    runtime: { getURL: (path: string) => `chrome-extension://test/${path}` },
    tabs: {
      query: async () => tabs,
      create: async (options: any) => { actions.push(["create", options]); tabs = [{ id: 3, windowId: 2, url: options.url }]; },
      update: async (id: number, options: any) => { actions.push(["focus", id, options]); }
    },
    windows: { update: async (id: number, options: any) => { actions.push(["window", id, options]); } }
  } as any;
  try {
    await openAgentPage("current-session");
    const url = agentPageUrl("current-session");
    assert.equal(new URL(url).searchParams.get("session"), "current-session");
    await openAgentPage("current-session");
    assert.deepEqual(actions, [["create", { url, active: true }], ["focus", 3, { active: true }], ["window", 2, { focused: true }]]);
    await openAgentPage("another-session");
    assert.equal(actions.filter(action => (action as any)[0] === "create").length, 2);
  } finally { globalThis.chrome = original; }
});
