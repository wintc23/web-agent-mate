import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { SessionStore, claimRun, LEASE_MS } from "../src/agent/sessions";
import { recoverRun, replyToRun, stopRun, withRunLock } from "../src/agent/run-coordination";
import { listWorkspaceDirectory, directoryErrorKey } from "../src/agent/workspace-directory";

test("two windows share stop requests, and a late command cannot stop a newer run", async () => {
  const first = new SessionStore(), second = new SessionStore();
  const session = await first.create();
  await first.update(session.id, item => claimRun(item, "run-a", "owner"));
  await second.update(session.id, item => stopRun(item, "run-a"));
  assert.equal((await first.get(session.id)).activeRun?.stopRequested, true);
  await first.update(session.id, item => { item.activeRun = undefined; claimRun(item, "run-b", "owner"); });
  await assert.rejects(second.update(session.id, item => stopRun(item, "run-a")), /RUN_OWNERSHIP_LOST/);
  assert.equal((await first.get(session.id)).activeRun?.stopRequested, undefined);
});

test("only the first cross-window answer is accepted, and stopping rejects late approvals", async () => {
  const first = new SessionStore(), second = new SessionStore();
  const session = await first.create();
  await first.update(session.id, item => {
    claimRun(item, "run", "owner");
    item.activeRun!.requests = [{ id: "approval", kind: "approval", title: "Read screenshot?", detail: "" }];
  });
  const replies = await Promise.allSettled([
    first.update(session.id, item => replyToRun(item, "run", "approval", "allow")),
    second.update(session.id, item => replyToRun(item, "run", "approval", "deny"))
  ]);
  assert.equal(replies.filter(item => item.status === "fulfilled").length, 1);
  await first.update(session.id, item => { item.activeRun!.replies = {}; stopRun(item, "run"); });
  await assert.rejects(second.update(session.id, item => replyToRun(item, "run", "approval", "allow")), /REQUEST_ALREADY_RESOLVED/);
});

test("a live browser lock prevents recovery even with an expired heartbeat, then releases an orphan immediately", { skip: !globalThis.navigator?.locks }, async () => {
  const store = new SessionStore(); const session = await store.create();
  await store.update(session.id, item => { claimRun(item, "run", "owner", Date.now() - LEASE_MS - 1); item.activeRun!.coordinated = true; item.queuedMessages = [{ id: "steer", text: "Followup", createdAt: Date.now(), delivery: "sending" }]; });
  await withRunLock(session.id, async coordinated => {
    assert.equal(coordinated, true);
    let duplicateRan = false;
    await withRunLock(session.id, async () => { duplicateRan = true; });
    assert.equal(duplicateRan, false);
    await assert.rejects(store.delete(session.id), /SESSION_BUSY/);
    await assert.rejects(store.fork(session.id), /SESSION_BUSY/);
    await recoverRun(store, await store.get(session.id), "Recovered", true);
    assert.equal((await store.get(session.id)).activeRun?.id, "run");
    await store.update(session.id, item => { item.activeRun!.heartbeat = Date.now(); });
  });
  await recoverRun(store, await store.get(session.id), "Recovered");
  assert.equal((await store.get(session.id)).activeRun, undefined);
  assert.equal((await store.get(session.id)).queuedMessages?.[0].delivery, "uncertain");
});

test("legacy leases need expiry or confirmation that there is no other panel", async () => {
  const store = new SessionStore(); const session = await store.create();
  await store.update(session.id, item => claimRun(item, "legacy", "old-panel"));
  await recoverRun(store, await store.get(session.id), "Recovered");
  assert.equal((await store.get(session.id)).activeRun?.id, "legacy");
  await recoverRun(store, await store.get(session.id), "Recovered", true);
  assert.equal((await store.get(session.id)).activeRun, undefined);
});

test("Codex branches retain native context when selecting a new workspace or branching before first send", async () => {
  const store = new SessionStore();
  const session = await store.create({ location: "local", engine: "codex", model: "", workspace: "/old", maxSteps: 24 }, { nativeSessionId: "native-source" });
  const branch = await store.fork(session.id, { ...session.config, workspace: "/new" });
  assert.equal(branch.nativeSessionId, undefined); assert.equal(branch.nativeForkFromId, "native-source");
  assert.equal((await store.fork(branch.id)).nativeForkFromId, "native-source");
  const otherEngine = await store.fork(branch.id, { ...branch.config, engine: "builtin" });
  assert.equal(otherEngine.nativeForkFromId, undefined);
});

test("session subscribers are notified after commits, never after aborted mutations", async () => {
  const store = new SessionStore(); let commits = 0;
  const unsubscribe = store.subscribe(() => { commits++; });
  try {
    const session = await store.create();
    await store.update(session.id, item => { item.draft = "shared draft"; });
    await assert.rejects(store.update(session.id, () => { throw new Error("abort"); }));
    assert.equal(commits, 2);
    await store.delete(session.id); assert.equal(commits, 3);
  } finally { unsubscribe(); }
});

test("directory browsing uses native messaging with no background router and validates responses", async () => {
  const previous = globalThis.chrome;
  let responseMode = "good";
  globalThis.chrome = { runtime: {
    sendMessage: () => { throw new Error("Old background has no workspace handler"); },
    sendNativeMessage: async (host: string, message: any) => {
      assert.equal(host, "ai.webagentmate.bridge"); assert.equal(message.method, "workspace.list");
      assert.deepEqual(message.params, { path: "/project", offset: 200 });
      if (responseMode === "unavailable") throw new Error("Native host not found");
      if (responseMode === "old") return { id: message.id, ok: false, error: { code: "METHOD_NOT_FOUND" } };
      return { id: responseMode === "mismatch" ? "wrong" : message.id, ok: true, result: { path: "/project", parent: "/", directories: responseMode === "malformed" ? [{}] : [], nextOffset: null } };
    }
  } } as unknown as typeof chrome;
  try {
    assert.equal((await listWorkspaceDirectory("/project", 200)).path, "/project");
    for (const mode of ["mismatch", "malformed"]) { responseMode = mode; await assert.rejects(listWorkspaceDirectory("/project", 200), /WORKSPACE_RESPONSE_INVALID/); }
    responseMode = "old"; await assert.rejects(listWorkspaceDirectory("/project", 200), error => directoryErrorKey(error) === "directoryUpdate");
    responseMode = "unavailable"; await assert.rejects(listWorkspaceDirectory("/project", 200), error => directoryErrorKey(error) === "directoryUnavailable");
  } finally { globalThis.chrome = previous; }
});
