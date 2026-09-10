import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
// @ts-ignore: shared installer code is executed by the bundled Node runtime.
import { install, register, unregister, locations } from "../scripts/installer/setup.cjs";

async function fixture(t: TestContext) {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'wam-install "space"-'));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  const source = path.join(home, "source");
  await fs.mkdir(path.join(source, "runtime/node/bin"), { recursive: true });
  await fs.writeFile(path.join(source, "bundle.json"), JSON.stringify({ version: "0.6.0", extensionId: "lmlkkallnnjijicmfmfdelnamcnhflfg", platform: "darwin" }));
  for (const file of ["webagentmate-bridge", "runtime/agent.mjs", "runtime/node/bin/node"]) await fs.writeFile(path.join(source, file), "new runtime");
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
  const target = locations("win32", home, { LOCALAPPDATA: path.join(home, "Local AppData") });
  const calls: any[] = [];
  await register(source, { platform: "win32", locations: target, exec: (...args: any[]) => { calls.push(args); } });
  assert.equal(calls.length, 3);
  assert(calls.every(([program, args]) => program === "reg.exe" && args[1].startsWith("HKCU\\") && args.includes(target.manifests[0])));
  assert.equal(JSON.parse(await fs.readFile(target.manifests[0], "utf8")).path, path.join(source, "webagentmate-bridge.exe"));
});
