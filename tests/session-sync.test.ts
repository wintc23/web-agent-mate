import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { SessionStore, claimRun, makeSession, reconcileSessions } from "../src/agent/sessions";

test("unchanged polls retain the list and session identities while other sessions change", async () => {
  const store = new SessionStore();
  const current = await store.create();
  const other = await store.create();
  const previous = await store.list();
  assert.equal(reconcileSessions(previous, await store.list()), previous);
  await store.update(other.id, session => { session.draft = "another window's draft"; }, false);
  const next = reconcileSessions(previous, await store.list());
  assert.notEqual(next, previous);
  assert.equal(next.find(session => session.id === current.id), previous.find(session => session.id === current.id));
  assert.equal(next.find(session => session.id === other.id)?.draft, "another window's draft");
  assert.equal(reconcileSessions(next, await store.list()), next);
});

test("draft, run and approval updates synchronize even when updatedAt does not change", async () => {
  const first = new SessionStore(), second = new SessionStore();
  const source = await first.create();
  let visible = [source];
  const mutations = [
    (session: typeof source) => { session.draft = "shared draft"; },
    (session: typeof source) => { claimRun(session, "run", "other-window"); },
    (session: typeof source) => { session.activeRun!.phase = "waiting"; session.activeRun!.requests = [{ id: "approval", kind: "approval", title: "Read?", detail: "" }]; },
    (session: typeof source) => { session.activeRun!.replies = { approval: "allow" }; },
    (session: typeof source) => { session.activeRun!.stopRequested = true; }
  ];
  for (const mutate of mutations) {
    const saved = await second.update(source.id, mutate, false);
    const next = reconcileSessions(visible, [await first.get(source.id)]);
    assert.notEqual(next, visible);
    assert.deepEqual(next[0], saved);
    assert.equal(next[0].updatedAt, source.updatedAt);
    visible = next;
  }
});

test("revisions advance atomically across writers and aborted writes stay invisible", async () => {
  const first = new SessionStore(), second = new SessionStore();
  const source = await first.create();
  await Promise.all([
    first.update(source.id, session => { session.title = "renamed"; }, false),
    second.update(source.id, session => { session.draft = "saved"; }, false)
  ]);
  const saved = await first.get(source.id);
  assert.equal(saved.revision, source.revision! + 2);
  assert.equal(saved.title, "renamed"); assert.equal(saved.draft, "saved");
  await assert.rejects(second.update(source.id, session => { session.draft = "aborted"; throw new Error("abort"); }));
  const visible = [saved];
  assert.equal(reconcileSessions(visible, [await first.get(source.id)]), visible);
});

test("session additions, ordering and archived tombstones reach the UI", () => {
  const first = makeSession(), second = makeSession();
  const previous = [first, second];
  const reordered = reconcileSessions(previous, [structuredClone(second), structuredClone(first)]);
  assert.notEqual(reordered, previous);
  assert.equal(reordered[0], second); assert.equal(reordered[1], first);
  const third = makeSession();
  const added = reconcileSessions(previous, [...structuredClone(previous), third]);
  assert.equal(added[2], third);
  const archived = reconcileSessions(previous, [{ ...structuredClone(first), archived: true, revision: 1 }, structuredClone(second)]);
  assert.equal(archived[0].archived, true); assert.equal(archived[1], second);
  assert.deepEqual(reconcileSessions(previous, []), []);
});

test("legacy snapshots without revisions still detect changes to drafts and history", () => {
  const legacy = makeSession(); delete legacy.revision;
  const visible = [legacy];
  assert.equal(reconcileSessions(visible, structuredClone(visible)), visible);
  const incoming = structuredClone(legacy);
  incoming.draft = "legacy change";
  incoming.history = [{ role: "user", content: "retained context" }];
  assert.equal(reconcileSessions(visible, [incoming])[0], incoming);
  assert.notEqual(reconcileSessions(visible, [{ ...legacy, revision: 1 }]), visible);
});
