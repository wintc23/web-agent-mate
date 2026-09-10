import { test } from "node:test";
import assert from "node:assert/strict";
import { agentPageUrl, openAgentPage } from "../src/agent/page";
import { openFromToolbar } from "../src/agent/toolbar-action";

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

test("toolbar clicks on an independent page open fresh tabs without navigating or restarting the source", async () => {
  const original = globalThis.chrome;
  const opened: any[] = [];
  globalThis.chrome = {
    runtime: { getURL: (path: string) => `chrome-extension://test/${path}` },
    tabs: { create: async (options: any) => { opened.push(options); } },
    sidePanel: { open: async () => { throw new Error("Must not open a sidebar on the independent page"); } }
  } as any;
  try {
    const url = agentPageUrl("session / ? & 中文");
    await openFromToolbar({ url, windowId: 7 });
    await openFromToolbar({ url, windowId: 7 });
    assert.deepEqual(opened, [{ url, active: true, windowId: 7 }, { url, active: true, windowId: 7 }]);
    await openFromToolbar({ url: "chrome-extension://test/sidepanel.html?view=page", windowId: 7 });
    assert.equal(opened[2].url, "chrome-extension://test/sidepanel.html?view=page");
  } finally { globalThis.chrome = original; }
});

test("other toolbar clicks open the sidebar synchronously, including missing and lookalike URLs", async () => {
  const original = globalThis.chrome;
  const opened: any[] = [];
  globalThis.chrome = {
    runtime: { getURL: (path: string) => `chrome-extension://test/${path}` },
    tabs: { create: async () => { throw new Error("Unexpected new tab"); } },
    sidePanel: { open: (options: any) => { opened.push(options); return Promise.resolve(); } }
  } as any;
  try {
    for (const url of [undefined, "not a URL", "https://test/sidepanel.html?view=page", "chrome-extension://other/sidepanel.html?view=page", "chrome-extension://test/sidepanel.html", "chrome-extension://test/other.html?view=page"]) {
      const before = opened.length;
      const result = openFromToolbar({ url, windowId: 4 });
      assert.equal(opened.length, before + 1, "No asynchronous work may consume the sidebar user gesture");
      assert.deepEqual(opened.at(-1), { windowId: 4 });
      await result;
    }
  } finally { globalThis.chrome = original; }
});
