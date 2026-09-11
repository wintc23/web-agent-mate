// Invoked by the graphical installers with their private Node runtime.
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const HOST = "ai.webagentmate.bridge";

function locations(platform = process.platform, home = os.homedir(), env = process.env) {
  if (platform === "darwin") return {
    root: path.join(home, "Library/Application Support/WebAgentMate"),
    manifests: [path.join(home, "Library/Application Support/Google/Chrome/NativeMessagingHosts", `${HOST}.json`)]
  };
  if (platform === "win32") {
    const root = path.join(env.LOCALAPPDATA || path.join(home, "AppData/Local"), "WebAgentMate");
    return { root, manifests: [path.join(root, `${HOST}.json`)] };
  }
  if (platform === "linux") return {
    root: path.join(env.XDG_DATA_HOME || path.join(home, ".local/share"), "webagentmate"),
    manifests: ["google-chrome", "chromium", "microsoft-edge"].map(browser => path.join(env.XDG_CONFIG_HOME || path.join(home, ".config"), browser, "NativeMessagingHosts", `${HOST}.json`))
  };
  throw new Error("Unsupported operating system");
}
async function metadata(source) {
  const value = JSON.parse(await fs.readFile(path.join(source, "bundle.json"), "utf8"));
  if (!/^[a-p]{32}$/.test(value.extensionId) || !/^\d+\.\d+\.\d+$/.test(value.version)) throw new Error("Invalid installer metadata");
  return value;
}
async function validatePayload(source, platform) {
  const meta = await metadata(source);
  if (!["darwin", "linux", "win32"].includes(meta.platform) || !["x64", "arm64"].includes(meta.arch) || !/^v\d+\.\d+\.\d+$/.test(meta.nodeVersion)) throw new Error("Invalid runtime metadata; download a complete Connector package.");
  if (platform && meta.platform !== platform) throw new Error("This installer is for a different operating system");
  const files = [meta.platform === "win32" ? "webagentmate-bridge.exe" : "webagentmate-bridge", "runtime/agent.mjs", meta.platform === "win32" ? "runtime/node/node.exe" : "runtime/node/bin/node", "runtime/licenses/node.txt", "LICENSE"];
  for (const file of files) {
    const info = await fs.stat(path.join(source, file)).catch(() => undefined);
    if (!info?.isFile() || !info.size) throw new Error(`Incomplete Connector package (${file}). Download the complete package again.`);
  }
  return meta;
}
async function atomicWrite(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, text, { mode: 0o644, flag: "wx" }); await fs.rename(temporary, file); }
  finally { await fs.rm(temporary, { force: true }); }
}
function manifest(binary, extensionId) {
  return JSON.stringify({ name: HOST, description: "WebAgentMate native bridge", path: binary, type: "stdio", allowed_origins: [`chrome-extension://${extensionId}/`] }, null, 2) + "\n";
}
const registryKeys = ["Google\\Chrome", "Chromium", "Microsoft\\Edge"].map(browser => `HKCU\\Software\\${browser}\\NativeMessagingHosts\\${HOST}`);
async function register(source, options = {}) {
  const platform = options.platform || process.platform;
  const target = options.locations || locations(platform);
  const meta = await validatePayload(source, platform);
  const extensionId = options.extensionId || meta.extensionId;
  if (!/^[a-p]{32}$/.test(extensionId)) throw new Error("Invalid extension ID");
  const binary = path.join(source, `webagentmate-bridge${platform === "win32" ? ".exe" : ""}`);
  await fs.access(binary);
  for (const file of target.manifests) await atomicWrite(file, manifest(binary, extensionId));
  if (platform === "win32") for (const key of registryKeys) (options.exec || execFileSync)("reg.exe", ["add", key, "/ve", "/t", "REG_SZ", "/d", target.manifests[0], "/f"], { windowsHide: true, stdio: "pipe" });
}
async function install(source, options = {}) {
  const platform = options.platform || process.platform;
  const target = options.locations || locations(platform);
  await validatePayload(source, platform);
  await fs.mkdir(target.root, { recursive: true });
  const staging = path.join(target.root, `.install-${randomUUID()}`);
  const bin = path.join(target.root, "bin"), backup = path.join(target.root, `.previous-${randomUUID()}`);
  let moved = false, activated = false;
  const previous = await Promise.all(target.manifests.map(file => fs.readFile(file).catch(error => { if (error.code !== "ENOENT") throw error; return undefined; })));
  try {
    await fs.cp(source, staging, { recursive: true });
    try { await fs.rename(bin, backup); moved = true; } catch (error) { if (error.code !== "ENOENT") throw error; }
    await fs.rename(staging, bin); activated = true;
    await register(bin, { ...options, platform, locations: target });
  } catch (error) {
    if (activated) await fs.rm(bin, { recursive: true, force: true });
    if (moved) await fs.rename(backup, bin);
    for (let i = 0; i < previous.length; i++) {
      if (previous[i] === undefined) await fs.rm(target.manifests[i], { force: true });
      else await atomicWrite(target.manifests[i], previous[i]);
    }
    throw error;
  } finally { await fs.rm(staging, { recursive: true, force: true }); }
  await fs.rm(backup, { recursive: true, force: true });
}
async function unregister(options = {}) {
  const platform = options.platform || process.platform;
  const target = options.locations || locations(platform);
  for (const file of target.manifests) {
    try {
      const value = JSON.parse(await fs.readFile(file, "utf8"));
      if (value.name === HOST && (value.path.startsWith(target.root + path.sep) || value.path === "/opt/webagentmate-bridge/webagentmate-bridge")) await fs.rm(file);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  if (platform === "win32") for (const key of registryKeys) {
    const exec = options.exec || execFileSync;
    try {
      const value = exec("reg.exe", ["query", key, "/ve"], { windowsHide: true, encoding: "utf8" });
      if (value.trim().endsWith(target.manifests[0])) exec("reg.exe", ["delete", key, "/f"], { windowsHide: true, stdio: "pipe" });
    } catch (error) { if (error.status !== 1) throw error; }
  }
}
// Package scripts drop root before touching any pre-existing per-user manifest.
async function migrateUsers(source, remove = false) {
  if (process.platform !== "linux" || process.getuid() !== 0) throw new Error("System package operation requires root on Linux");
  const entries = (await fs.readFile("/etc/passwd", "utf8")).split("\n").map(line => line.split(":"));
  for (const [name, , uid, , , home] of entries) {
    if (Number(uid) < 1000 || Number(uid) >= 65534 || !home?.startsWith("/")) continue;
    execFileSync("runuser", ["-u", name, "--", process.execPath, __filename, remove ? "migrate-remove" : "migrate-user", source], { stdio: "inherit" });
  }
}
async function migrateUser(source, remove = false) {
  const target = locations();
  const meta = await metadata(source);
  const binary = path.join(source, "webagentmate-bridge");
  for (const file of target.manifests) {
    let value;
    try { value = JSON.parse(await fs.readFile(file, "utf8")); } catch (error) { if (error.code === "ENOENT" || error instanceof SyntaxError) continue; throw error; }
    if (value.name !== HOST) continue;
    if (remove) { if (value.path === binary) await fs.rm(file); }
    else if (value.path?.startsWith(target.root + path.sep) || value.path === binary) {
      if (value.path !== binary) await atomicWrite(`${file}.before-package`, JSON.stringify(value));
      await atomicWrite(file, manifest(binary, meta.extensionId));
    }
  }
}
module.exports = { locations, manifest, install, register, unregister, validatePayload };
if (require.main === module) (async () => {
  const action = process.argv[2], source = path.resolve(process.argv[3] || __dirname);
  if (action === "install") await install(source, { extensionId: process.argv[4] });
  else if (action === "register") await register(source);
  else if (action === "uninstall") { await unregister(); if (process.platform === "darwin") await fs.rm(path.join(locations().root, "bin"), { recursive: true, force: true }); }
  else if (action === "migrate-users" || action === "remove-users") await migrateUsers(source, action === "remove-users");
  else if (action === "migrate-user" || action === "migrate-remove") await migrateUser(source, action === "migrate-remove");
  else throw new Error("Unknown installer action");
  console.log("OK");
})().catch(error => { console.error(error.message); process.exitCode = 1; });
