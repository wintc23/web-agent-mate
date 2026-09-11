const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn, execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
const { validatePayload } = require("./setup.cjs");

async function request(binary, extensionId, env, method = "bridge.hello") {
  const child = spawn(binary, [`chrome-extension://${extensionId}/`], { env, stdio: ["pipe", "pipe", "pipe"] });
  let timer;
  try {
    return await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Bundled runtime check timed out")), 15_000);
      let data = Buffer.alloc(0);
      child.on("error", reject); child.stdin.on("error", reject);
      child.on("exit", code => reject(new Error(`Bridge exited before responding: ${code}`)));
      child.stdout.on("data", chunk => {
        data = Buffer.concat([data, chunk]);
        if (data.length > 1024 * 1024) return reject(new Error("Oversized response"));
        if (data.length >= 4 && data.length >= data.readUInt32LE(0) + 4) {
          try { resolve(JSON.parse(data.subarray(4, data.readUInt32LE(0) + 4))); } catch (error) { reject(error); }
        }
      });
      const body = Buffer.from(JSON.stringify({ id: "packaging-check", protocolVersion: 1, method, params: {} }));
      const header = Buffer.alloc(4); header.writeUInt32LE(body.length);
      child.stdin.write(Buffer.concat([header, body]));
    });
  } finally {
    clearTimeout(timer); child.stdin.end();
    if (child.exitCode === null && child.signalCode === null) await new Promise(resolve => {
      const timer = setTimeout(() => child.kill(), 1000);
      child.once("exit", () => { clearTimeout(timer); resolve(); });
    });
  }
}

async function verifyPayload(payload) {
  payload = path.resolve(payload);
  const meta = await validatePayload(payload, process.platform);
  assert.equal(meta.arch, process.arch, "Run verification on the package's target architecture");
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "wam-offline-runtime-"));
  const binaryName = process.platform === "win32" ? "webagentmate-bridge.exe" : "webagentmate-bridge";
  const nodeName = process.platform === "win32" ? "runtime/node/node.exe" : "runtime/node/bin/node";
  // /usr/bin can contain Node on CI. Use an empty directory instead.
  const emptyPath = path.join(temporary, "empty-path");
  await fs.mkdir(emptyPath);
  const env = { ...process.env, PATH: emptyPath, HOME: temporary, XDG_DATA_HOME: temporary, XDG_CONFIG_HOME: temporary, LOCALAPPDATA: temporary };
  for (const key of Object.keys(env)) if (key !== "PATH" && key.toUpperCase() === "PATH") delete env[key];
  try {
    const node = path.join(payload, nodeName);
    assert.equal(execFileSync(node, ["--version"], { env, encoding: "utf8", timeout: 15_000 }).trim(), meta.nodeVersion);
    const reply = await request(path.join(payload, binaryName), meta.extensionId, env);
    assert.equal(reply.ok, true);
    assert.equal(reply.result.version, meta.version);
    assert.equal(reply.result.runtimeV2, true, "Bridge must work without system Node");
    execFileSync(node, [path.join(payload, "runtime/agent.mjs")], { env, input: "", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] });

    // Run the packaged binaries with a diagnostic entrypoint in an isolated
    // copy. No model request is made and the actual payload remains unchanged.
    const probe = path.join(temporary, "probe");
    await fs.mkdir(path.dirname(path.join(probe, nodeName)), { recursive: true });
    await fs.copyFile(node, path.join(probe, nodeName));
    await fs.copyFile(path.join(payload, binaryName), path.join(probe, binaryName));
    const userBin = path.join(temporary, "user-bin");
    await fs.mkdir(userBin);
    const userNode = path.join(userBin, process.platform === "win32" ? "node.cmd" : "node");
    const userContents = process.platform === "win32" ? "@echo off\r\necho user-node-fixture\r\n" : "#!/bin/sh\nprintf 'user-node-fixture\\n'\n";
    await fs.writeFile(userNode, userContents, { mode: 0o755 });
    await fs.writeFile(path.join(probe, "runtime/agent.mjs"), `import { spawnSync } from 'node:child_process';
const shell = process.platform === 'win32' ? process.env.SystemRoot + '/System32/cmd.exe' : '/bin/sh';
const args = process.platform === 'win32' ? ['/d', '/c', 'node --version'] : ['-c', 'node --version'];
const result = spawnSync(shell, args, { encoding: 'utf8' });
console.log(JSON.stringify({ version: process.version, executable: process.execPath, path: process.env.PATH, userNode: result.stdout.trim() }));
`);
    const result = await request(path.join(probe, binaryName), meta.extensionId, { ...env, PATH: userBin }, "runtime.open");
    assert.equal(result.version, meta.nodeVersion);
    assert.equal(await fs.realpath(result.executable), await fs.realpath(path.join(probe, nodeName)));
    assert.equal(result.path, userBin, "Private Node must not change the PATH used by project commands");
    assert.equal(result.userNode, "user-node-fixture", "Project commands must retain the user's Node selection");
    assert.equal(await fs.readFile(userNode, "utf8"), userContents);

    await fs.rm(path.join(probe, nodeName));
    const systemNodeEnv = { ...env, PATH: path.dirname(process.execPath) };
    const broken = await request(path.join(probe, binaryName), meta.extensionId, systemNodeEnv);
    assert.equal(broken.result.runtimeV2, false, "Missing private Node must not fall back to system Node");
    const failure = await request(path.join(probe, binaryName), meta.extensionId, systemNodeEnv, "runtime.open");
    assert.equal(failure.ok, false);
    assert.equal(failure.error.code, "RUNTIME_BUNDLE_MISSING");
    console.log("Bundled runtime passed: no system Node, existing user Node/PATH preserved, incomplete package rejected.");
    return meta;
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}

module.exports = { verifyPayload };
if (require.main === module) verifyPayload(process.argv[2] || "build/installer-payload").catch(error => { console.error(error); process.exitCode = 1; });
