const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");

(async () => {
  const payload = path.resolve(process.argv[2] || "build/installer-payload");
  const meta = JSON.parse(await fs.readFile(path.join(payload, "bundle.json"), "utf8"));
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "wam-offline-runtime-"));
  const child = spawn(path.join(payload, `webagentmate-bridge${process.platform === "win32" ? ".exe" : ""}`), [`chrome-extension://${meta.extensionId}/`], {
    env: { ...process.env, PATH: process.platform === "win32" ? path.join(process.env.SystemRoot || "C:\\Windows", "System32") : "/usr/bin:/bin", HOME: temporary, XDG_DATA_HOME: temporary, XDG_CONFIG_HOME: temporary, LOCALAPPDATA: temporary },
    stdio: ["pipe", "pipe", "pipe"]
  });
  let timer;
  try {
    const reply = await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Bundled runtime check timed out")), 15_000);
      let data = Buffer.alloc(0);
      child.on("error", reject); child.stdin.on("error", reject);
      child.on("exit", code => reject(new Error(`Bridge exited: ${code}`)));
      child.stdout.on("data", chunk => {
        data = Buffer.concat([data, chunk]);
        if (data.length > 1024 * 1024) return reject(new Error("Oversized response"));
        if (data.length >= 4 && data.length >= data.readUInt32LE(0) + 4) {
          try { resolve(JSON.parse(data.subarray(4, data.readUInt32LE(0) + 4))); } catch (error) { reject(error); }
        }
      });
      const body = Buffer.from(JSON.stringify({ id: "packaging-check", protocolVersion: 1, method: "bridge.hello" }));
      const header = Buffer.alloc(4); header.writeUInt32LE(body.length);
      child.stdin.write(Buffer.concat([header, body]));
    });
    assert.equal(reply.ok, true);
    assert.equal(reply.result.version, meta.version);
    assert.equal(reply.result.runtimeV2, true, "Bridge must find its bundled Node without a user-installed Node");
    console.log("Bridge hello passed with a clean home and no user Node on PATH.");
  } finally {
    clearTimeout(timer); child.stdin.end();
    if (child.exitCode === null) await new Promise(resolve => { const timer = setTimeout(() => child.kill(), 1000); child.once("exit", () => { clearTimeout(timer); resolve(); }); });
    await fs.rm(temporary, { recursive: true, force: true });
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
