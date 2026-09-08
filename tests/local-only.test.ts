import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, assertConfig, type Session } from "../src/agent/protocol";
import { makeSession, SessionStore } from "../src/agent/sessions";
import { parseSessionBackup, serializeSession } from "../src/agent/session-backup";
import { runNative } from "../src/agent/native";

async function rawDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("webagentmate-sessions-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("sessions", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

test("old browser sessions migrate atomically without losing history, drafts, queued messages or ownership", async () => {
  const legacy = makeSession();
  legacy.config = { ...legacy.config, location: "remote", permissionMode: "auto", model: "custom/model", maxSteps: 9, limitToolCalls: true };
  legacy.draft = "Unsaved task";
  legacy.title = "Saved conversation";
  legacy.entries = [{ id: "text", kind: "assistant", text: "Earlier answer", status: "completed" }];
  legacy.history = [{ role: "assistant", content: null, tool_calls: [{ id: "read", type: "function", function: { name: "browser_tabs", arguments: "{}" } }] }, { role: "tool", tool_call_id: "read", content: "page list" }];
  legacy.queuedMessages = [{ id: "queued", text: "Do not run on migration", createdAt: 1 }];
  legacy.activeRun = { id: "run", owner: "other-window", heartbeat: 1, coordinated: true };
  const db = await rawDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("sessions", "readwrite"); tx.objectStore("sessions").put(legacy);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
  db.close();
  const migrated = await new SessionStore().get(legacy.id);
  const expected = { ...legacy, config: { ...legacy.config, location: "local", permissionMode: "ask" } };
  assert.deepEqual(migrated, expected);
  assert.deepEqual(await new SessionStore().get(legacy.id), expected);
  const persisted = await rawDatabase();
  const record = await new Promise<Session>((resolve, reject) => {
    const request = persisted.transaction("sessions").objectStore("sessions").get(legacy.id);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  persisted.close(); assert.deepEqual(record, expected);
});

test("legacy backups become local conversations and preserve explicit budgets without inheriting browser auto approval", () => {
  const session = makeSession();
  session.draft = "Keep this draft";
  const backup = JSON.parse(serializeSession(session));
  backup.config = { ...backup.config, location: "remote", permissionMode: "auto", maxSteps: 6, limitToolCalls: true };
  const migrated = parseSessionBackup(JSON.stringify(backup));
  assert.equal(migrated.config.location, "local"); assert.equal(migrated.config.permissionMode, "ask");
  assert.equal(migrated.config.maxSteps, 6); assert.equal(migrated.config.limitToolCalls, true); assert.equal(migrated.draft, session.draft);
  backup.config.permissionMode = "invalid";
  assert.throws(() => parseSessionBackup(JSON.stringify(backup)), /INVALID_SESSION_BACKUP/);
  backup.config.permissionMode = "ask"; backup.config.engine = "codex";
  assert.throws(() => parseSessionBackup(JSON.stringify(backup)), /INVALID_SESSION_BACKUP/);
});

test("all three local engines are valid and remote execution is rejected before opening a native connection", () => {
  assert.equal(DEFAULT_CONFIG.location, "local");
  for (const engine of ["builtin", "codex", "claude"] as const) assert.doesNotThrow(() => assertConfig({ ...DEFAULT_CONFIG, engine }));
  const session = makeSession(); session.config.location = "remote";
  assert.throws(() => assertConfig(session.config), /LOCAL_ENGINE_REQUIRES_BRIDGE/);
  assert.throws(() => runNative(session, "do not execute", { signal: new AbortController().signal, emit: async () => {}, ask: async () => "deny" }), /LOCAL_ENGINE_REQUIRES_BRIDGE/);
});

test("new local automatic-approval settings survive reopening and stale legacy updates are normalized", async () => {
  const store = new SessionStore(); const session = await store.create({ ...DEFAULT_CONFIG, permissionMode: "auto" });
  assert.equal((await new SessionStore().get(session.id)).config.permissionMode, "auto");
  await store.update(session.id, item => { item.config.location = "remote"; });
  assert.equal((await store.get(session.id)).config.location, "local");
  assert.equal((await store.get(session.id)).config.permissionMode, "ask");
});
