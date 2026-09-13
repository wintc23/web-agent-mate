// Developer/CI build step. End users receive the resulting offline installer.
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const lock = require("./node-runtime.json");
const root = path.resolve(__dirname, "../..");

async function prepare({ platform, arch, binary, out }) {
  const asset = lock.assets[`${platform}-${arch}`];
  if (!asset || !binary || !out) throw new Error("Unsupported platform or missing binary/output path");
  out = path.resolve(out); binary = path.resolve(binary);
  if (out === root || !out.startsWith(path.join(root, "build") + path.sep)) throw new Error("Output must be inside build/");
  const cache = path.join(root, "build/installer-cache");
  await fs.mkdir(cache, { recursive: true });
  const archive = path.join(cache, asset.file);
  const digest = async file => createHash("sha256").update(await fs.readFile(file)).digest("hex");
  if (await digest(archive).catch(() => "") !== asset.sha256) {
    const temporary = `${archive}.${process.pid}.download`;
    try {
      execFileSync("curl", ["--fail", "--location", "--proto", "=https", "--http1.1", "--retry", "3", "--retry-all-errors", "--max-time", "600", "--output", temporary, `https://nodejs.org/dist/${lock.version}/${asset.file}`], { stdio: "inherit" });
      if (await digest(temporary) !== asset.sha256) throw new Error("Node runtime checksum mismatch");
      await fs.rename(temporary, archive);
    } finally { await fs.rm(temporary, { force: true }); }
  }
  await fs.access(binary);
  await fs.access(path.join(root, "bridge/runtime-dist/agent.mjs"));
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "wam-node-"));
  try {
    const prefix = asset.file.replace(/\.(tar\.(gz|xz)|zip)$/, "");
    const executable = platform === "win32" ? "node.exe" : "bin/node";
    execFileSync("tar", ["-xf", archive, "-C", temporary, `${prefix}/${executable}`, `${prefix}/LICENSE`]);
    await fs.rm(out, { recursive: true, force: true });
    await fs.mkdir(out, { recursive: true });
    await fs.copyFile(binary, path.join(out, `webagentmate-bridge${platform === "win32" ? ".exe" : ""}`));
    await fs.copyFile(binary, path.join(out, `webagentmate-launcher${platform === "win32" ? ".exe" : ""}`));
    await fs.copyFile(path.join(__dirname, "update-key.json"), path.join(out, "update-key.json"));
    await fs.cp(path.join(root, "bridge/runtime-dist"), path.join(out, "runtime"), { recursive: true });
    const node = path.join(out, "runtime/node", executable);
    await fs.mkdir(path.dirname(node), { recursive: true });
    await fs.copyFile(path.join(temporary, prefix, executable), node);
    await fs.copyFile(path.join(temporary, prefix, "LICENSE"), path.join(out, "runtime/licenses/node.txt"));
    await fs.copyFile(path.join(root, "LICENSE"), path.join(out, "LICENSE"));
    await fs.copyFile(path.join(__dirname, "setup.cjs"), path.join(out, "setup.cjs"));
    if (platform !== "win32") {
      await fs.chmod(path.join(out, "webagentmate-launcher"), 0o755); await fs.chmod(node, 0o755); await fs.chmod(path.join(out, "webagentmate-bridge"), 0o755);
    }
    if (platform === process.platform && arch === process.arch) {
      if (execFileSync(node, ["--version"], { encoding: "utf8" }).trim() !== lock.version) throw new Error("Wrong bundled Node version");
    }
    const manifest = require(path.join(root, "public/manifest.json"));
    const extensionId = createHash("sha256").update(Buffer.from(manifest.key, "base64")).digest("hex").slice(0, 32).replace(/[0-9a-f]/g, digit => String.fromCharCode(97 + parseInt(digit, 16)));
    await fs.writeFile(path.join(out, "bundle.json"), JSON.stringify({ version: manifest.version, extensionId, platform, arch, nodeVersion: lock.version, autoUpdateProtocol: 1 }, null, 2) + "\n");
    console.log(`Prepared ${platform}/${arch} installer payload at ${out}`);
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}
module.exports = { prepare };
if (require.main === module) {
  const options = {};
  for (let i = 2; i < process.argv.length; i += 2) options[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
  prepare(options).catch(error => { console.error(error.message); process.exitCode = 1; });
}
