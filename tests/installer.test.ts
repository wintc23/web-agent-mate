import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
// @ts-ignore: shared installer code is executed by the bundled Node runtime.
import { install, register, unregister, locations, validatePayload } from "../scripts/installer/setup.cjs";

async function fixture(t: TestContext) {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'wam-install "space"-'));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  const source = path.join(home, "source");
  await fs.mkdir(path.join(source, "runtime/node/bin"), { recursive: true });
  await fs.mkdir(path.join(source, "runtime/licenses"), { recursive: true });
  await fs.writeFile(path.join(source, "bundle.json"), JSON.stringify({ version: "0.6.0", extensionId: "lmlkkallnnjijicmfmfdelnamcnhflfg", platform: "darwin", arch: "x64", nodeVersion: "v24.21.0" }));
  for (const file of ["webagentmate-bridge", "runtime/agent.mjs", "runtime/node/bin/node", "runtime/licenses/node.txt", "LICENSE"]) await fs.writeFile(path.join(source, file), "new runtime");
  return { home, source, target: locations("darwin", home) };
}
test("GUI install upgrades an existing user installation and leaves conversation data intact", async t => {
  const { source, target } = await fixture(t);
  const bin = path.join(target.root, "bin");
  await fs.mkdir(bin, { recursive: true });
  await fs.writeFile(path.join(bin, "webagentmate-bridge"), "old");
  await fs.writeFile(path.join(target.root, "conversations.sqlite"), "keep");
  await install(source, { platform: "darwin", locations: target });
  const value = JSON.parse(await fs.readFile(target.manifests[0], "utf8"));
  assert.equal(value.path, path.join(bin, "webagentmate-bridge"));
  assert.deepEqual(value.allowed_origins, ["chrome-extension://lmlkkallnnjijicmfmfdelnamcnhflfg/"]);
  assert.equal(await fs.readFile(path.join(bin, "runtime/node/bin/node"), "utf8"), "new runtime");
  await install(source, { platform: "darwin", locations: target });
  await unregister({ platform: "darwin", locations: target });
  await assert.rejects(fs.access(target.manifests[0]));
  assert.equal(await fs.readFile(path.join(target.root, "conversations.sqlite"), "utf8"), "keep");
});
test("incomplete or wrong-platform payloads cannot replace a working installation", async t => {
  const { source, target } = await fixture(t);
  const bin = path.join(target.root, "bin");
  await fs.mkdir(bin, { recursive: true });
  await fs.writeFile(path.join(bin, "webagentmate-bridge"), "old");
  await fs.rm(path.join(source, "runtime/node/bin/node"));
  await assert.rejects(install(source, { platform: "darwin", locations: target }));
  await assert.rejects(install(source, { platform: "linux", locations: target }), /different operating system/);
  assert.equal(await fs.readFile(path.join(bin, "webagentmate-bridge"), "utf8"), "old");
});
test("Windows registration uses the installed path and per-user registry without shell interpolation", async t => {
  const { home, source } = await fixture(t);
  await fs.writeFile(path.join(source, "webagentmate-bridge.exe"), "fixture");
  await fs.writeFile(path.join(source, "runtime/node/node.exe"), "fixture");
  const metadata = JSON.parse(await fs.readFile(path.join(source, "bundle.json"), "utf8"));
  await fs.writeFile(path.join(source, "bundle.json"), JSON.stringify({ ...metadata, platform: "win32" }));
  const target = locations("win32", home, { LOCALAPPDATA: path.join(home, "Local AppData") });
  const calls: any[] = [];
  await register(source, { platform: "win32", locations: target, exec: (...args: any[]) => { calls.push(args); } });
  assert.equal(calls.length, 3);
  assert(calls.every(([program, args]) => program === "reg.exe" && args[1].startsWith("HKCU\\") && args.includes(target.manifests[0])));
  assert.equal(JSON.parse(await fs.readFile(target.manifests[0], "utf8")).path, path.join(source, "webagentmate-bridge.exe"));
});
test("package validation rejects missing Node and its license even when system Node is available", async t => {
  const { source } = await fixture(t);
  await validatePayload(source, "darwin");
  for (const file of ["runtime/node/bin/node", "runtime/licenses/node.txt"]) {
    const full = path.join(source, file), content = await fs.readFile(full);
    await fs.rm(full);
    await assert.rejects(validatePayload(source), /Incomplete Connector package/);
    await fs.writeFile(full, content);
  }
});
test("publication refuses a Bridge ZIP changed after runtime verification", async t => {
  const { home } = await fixture(t);
  const output = path.join(home, "release");
  await fs.mkdir(output);
  const version = JSON.parse(await fs.readFile("public/manifest.json", "utf8")).version;
  const nodeVersion = JSON.parse(await fs.readFile("scripts/installer/node-runtime.json", "utf8")).version;
  for (const [name, platform, arch] of [["macos-x64", "darwin", "x64"], ["macos-arm64", "darwin", "arm64"], ["windows-x64", "win32", "x64"], ["linux-x64", "linux", "x64"]]) {
    const file = path.join(output, `webagentmate-bridge-${name}.zip`);
    const contents = Buffer.from(`archive fixture ${name}`);
    await fs.writeFile(file, contents);
    await fs.writeFile(`${file}.runtime.json`, JSON.stringify({ version, nodeVersion, platform, arch, runtimeVerified: true, sha256: createHash("sha256").update(contents).digest("hex") }));
  }
  for (const name of ["webagentmate-bridge-macos-arm64.dmg", "webagentmate-bridge-macos-x64.dmg", "webagentmate-bridge-windows-x64.exe", "webagentmate-bridge-linux-x64.deb", "webagentmate-bridge-linux-x64.rpm", "webagentmate-extension.zip"]) {
    await fs.writeFile(path.join(output, name), "asset fixture");
    if (/\.(dmg|exe)$/.test(name)) await fs.writeFile(path.join(output, `${name}.release.json`), JSON.stringify({ version, signed: true, notarized: true }));
  }
  const check = () => spawnSync(process.execPath, ["scripts/installer/check-release.cjs", output], { encoding: "utf8", env: { ...process.env, GITHUB_REF_NAME: `v${version}` } });
  assert.equal(check().status, 0);
  await fs.appendFile(path.join(output, "webagentmate-bridge-macos-x64.zip"), "changed after verification");
  const rejected = check();
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /requires verification of its bundled runtime/);
});
