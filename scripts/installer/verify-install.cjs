const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
const { install, unregister, locations } = require("./setup.cjs");

(async () => {
  const source = path.resolve(process.argv[2] || "build/installer-payload");
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'wam-gui-install "test"-'));
  const target = locations(process.platform, home, {});
  try {
    await fs.mkdir(target.root, { recursive: true });
    await fs.writeFile(path.join(target.root, "conversation-fixture.txt"), "preserve");
    const bin = await install(source, { locations: target });
    execFileSync(process.execPath, [path.join(__dirname, "verify-payload.cjs"), bin], { stdio: "inherit" });
    // Load the actual runtime using only the installed private Node. An empty
    // stdin exits without provider calls, but verifies imports and dependencies.
    execFileSync(path.join(bin, process.platform === "win32" ? "runtime/node/node.exe" : "runtime/node/bin/node"), [path.join(bin, "runtime/agent.mjs")], { input: "", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, PATH: "/usr/bin:/bin" } });
    await install(source, { locations: target });
    await unregister({ locations: target });
    for (const file of target.manifests) await assert.rejects(fs.access(file));
    assert.equal(await fs.readFile(path.join(target.root, "conversation-fixture.txt"), "utf8"), "preserve");
    console.log("Actual payload installation, runtime loading, upgrade and unregistration passed in an isolated account directory.");
  } finally { await fs.rm(home, { recursive: true, force: true }); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
