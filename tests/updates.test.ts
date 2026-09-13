import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { generateKeyPairSync, sign, createHash, randomUUID } from "node:crypto";
import { zipSync, strToU8 } from "fflate";
// @ts-ignore CJS shared with the distributed updater
import { verifyManifest, extract, download, check, apply, recover } from "../scripts/installer/updater.cjs";
const version = "0.6.0", previousVersion = "0.5.0";
const pair = generateKeyPairSync("ed25519");
const publicKey = { spki: pair.publicKey.export({ type: "spki", format: "der" }).toString("base64") };
const platformName = { darwin: "macos", win32: "windows", linux: "linux" }[process.platform as "darwin" | "win32" | "linux"];
const binary = process.platform === "win32" ? "webagentmate-bridge.exe" : "webagentmate-bridge";
const metadata = { version: previousVersion, platform: process.platform, arch: process.arch, nodeVersion: "v24.21.0", extensionId: "lmlkkallnnjijicmfmfdelnamcnhflfg", autoUpdateProtocol: 1 };
function envelope(bytes: Uint8Array, changes = {}) {
  const value = { schema: 1, version, extensionVersion: version, protocolVersion: 1, assets: { [`${process.platform}-${process.arch}`]: { url: `https://github.com/wintc23/web-agent-mate/releases/download/v${version}/webagentmate-bridge-${platformName}-${process.arch}.zip`, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") } }, ...changes };
  const payload = Buffer.from(JSON.stringify(value));
  return { payload: payload.toString("base64"), signature: sign(null, payload, pair.privateKey).toString("base64") };
}
async function fixture(t: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wam-update-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const relative = "versions/0.5.0-fixture", source = path.join(root, relative);
  const files: Record<string, Uint8Array> = Object.fromEntries([binary, "setup.cjs", "runtime/agent.mjs", "runtime/updater.cjs", "runtime/licenses/node.txt", "LICENSE", process.platform === "win32" ? "webagentmate-launcher.exe" : "webagentmate-launcher", process.platform === "win32" ? "runtime/node/node.exe" : "runtime/node/bin/node"].map(name => [name, strToU8("fixture")]));
  files["update-key.json"] = strToU8(JSON.stringify(publicKey));
  files["bundle.json"] = strToU8(JSON.stringify(metadata));
  for (const [name, bytes] of Object.entries(files)) { const file = path.join(source, name); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, bytes); }
  const active = { current: relative, previous: null, probation: false };
  await fs.writeFile(path.join(root, "active.json"), JSON.stringify(active));
  await fs.writeFile(path.join(root, "conversations.sqlite"), "keep data");
  files["bundle.json"] = strToU8(JSON.stringify({ ...metadata, version }));
  const archive = zipSync(files);
  const stageName = `stage-${randomUUID()}`, stage = path.join(root, "updates", stageName);
  await fs.mkdir(stage, { recursive: true });
  await fs.writeFile(path.join(stage, "manifest.json"), JSON.stringify(envelope(archive)));
  await fs.writeFile(path.join(stage, "package.zip"), archive);
  return { root, source, stageName, stage, archive, active };
}
const state = (root: string) => fs.readFile(path.join(root, "updates/status.json"), "utf8").then(JSON.parse);
const active = (root: string) => fs.readFile(path.join(root, "active.json"), "utf8").then(JSON.parse);
test("only the pinned signature, exact extension compatibility, platform and increasing versions are accepted", () => {
  const signed = envelope(strToU8("zip"));
  assert.equal(verifyManifest(signed, publicKey, version, metadata).manifest.version, version);
  assert.throws(() => verifyManifest({ ...signed, signature: Buffer.alloc(64).toString("base64") }, publicKey, version, metadata), /SIGNATURE/);
  assert.throws(() => verifyManifest(signed, publicKey, "0.7.0", metadata), /INCOMPATIBLE/);
  assert.throws(() => verifyManifest(signed, publicKey, version, { ...metadata, version }), /INCOMPATIBLE/);
  assert.throws(() => verifyManifest(signed, publicKey, version, { ...metadata, arch: "wrong" }), /ASSET/);
  assert.throws(() => verifyManifest(envelope(strToU8("zip"), { protocolVersion: 2 }), publicKey, version, metadata), /INCOMPATIBLE/);
});
test("ZIP traversal, absolute paths, Windows aliases, case collisions and ZIP bombs are rejected", () => {
  for (const name of ["../bad", "/bad", "C:/bad", "a/../bad", "a\\bad", "a/nul.txt", "a./bad"]) assert.throws(() => extract(zipSync({ [name]: strToU8("bad") })), /ARCHIVE/);
  assert.throws(() => extract(zipSync({ "a.txt": strToU8("x"), "A.TXT": strToU8("y") })), /ARCHIVE/);
  const bomb = Buffer.from(zipSync({ "large.txt": strToU8("small") }));
  bomb.writeUInt32LE(600 * 1024 * 1024, bomb.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 24); // central directory uncompressed size
  assert.throws(() => extract(bomb));
});
test("download checks actual bytes and checksum, not just HTTP success", async t => {
  const { root } = await fixture(t);
  const bytes = Buffer.from("expected");
  const asset = { size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
  await assert.rejects(download("https://example.test", path.join(root, "bad.zip"), asset, async () => {}, async () => new Response("tampered")), /CHECKSUM/);
  await assert.rejects(download("https://example.test", path.join(root, "oversized.zip"), asset, async () => {}, async () => new Response("far too much content")), /SIZE/);
});
test("verified activation retains the old version and user data; a failed health check rolls back", async t => {
  const fixture1 = await fixture(t);
  let calls = 0;
  await apply(fixture1.root, fixture1.source, fixture1.stageName, version, { health: () => { calls++; } });
  assert.equal(calls, 2);
  assert.equal((await active(fixture1.root)).previous, fixture1.active.current);
  assert.equal((await active(fixture1.root)).probation, false);
  assert.equal(await fs.readFile(path.join(fixture1.root, "conversations.sqlite"), "utf8"), "keep data");
  const fixture2 = await fixture(t);
  calls = 0;
  await assert.rejects(apply(fixture2.root, fixture2.source, fixture2.stageName, version, { health: () => { if (++calls === 2) throw new Error("failed after activation"); } }));
  assert.deepEqual(await active(fixture2.root), fixture2.active);
  assert.equal((await state(fixture2.root)).phase, "rolled_back");
});
test("interrupted activation restores the previous version on the next launch", async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.root, "active.json"), JSON.stringify({ current: "versions/0.6.0-interrupted", previous: f.active.current, targetVersion: version, probation: true }));
  await recover(f.root);
  assert.equal((await active(f.root)).current, f.active.current);
  assert.equal((await state(f.root)).phase, "rolled_back");
});
test("disabled updates, unpublished releases and failed-version suppression never activate", async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.root, "updates/settings.json"), '{"enabled":false}');
  let requests = 0;
  const fetch = async () => { requests++; return new Response(null, { status: 404 }); };
  await check(f.root, f.source, version, true, { fetch });
  assert.equal(requests, 0);
  await fs.writeFile(path.join(f.root, "updates/settings.json"), '{"enabled":true}');
  await check(f.root, f.source, version, true, { fetch });
  assert.equal((await state(f.root)).phase, "unavailable");
  await fs.writeFile(path.join(f.root, "updates/status.json"), JSON.stringify({ phase: "rolled_back", failedVersion: version }));
  await check(f.root, f.source, version, false, { fetch });
  assert.equal(requests, 1);
  assert.deepEqual(await active(f.root), f.active);
});
test("staged archive tampering and disabling before activation leave the installed version unchanged", async t => {
  const f = await fixture(t);
  await fs.appendFile(path.join(f.stage, "package.zip"), "tampered");
  await assert.rejects(apply(f.root, f.source, f.stageName, version), /CHECKSUM/);
  assert.deepEqual(await active(f.root), f.active);
  await fs.writeFile(path.join(f.root, "updates/settings.json"), '{"enabled":false}');
  await apply(f.root, f.source, f.stageName, version);
  assert.deepEqual(await active(f.root), f.active);
});

test("release signing binds all four complete archives and refuses a different signing key", async t => {
  // @ts-ignore shared release helper
  const { signRelease, verifyRelease } = await import("../scripts/installer/sign-update.cjs");
  const { root } = await fixture(t);
  for (const name of ["macos-x64", "macos-arm64", "windows-x64", "linux-x64"]) await fs.writeFile(path.join(root, `webagentmate-bridge-${name}.zip`), `archive ${name}`);
  const key = pair.privateKey.export({ type: "pkcs8", format: "pem" });
  assert.throws(() => signRelease(root, key, { spki: "wrong" }), /does not match/);
  signRelease(root, key, publicKey);
  verifyRelease(root, publicKey);
  await fs.appendFile(path.join(root, "webagentmate-bridge-linux-x64.zip"), "changed");
  assert.throws(() => verifyRelease(root, publicKey), /does not match/);
});
