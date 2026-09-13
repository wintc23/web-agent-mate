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
  if (meta.autoUpdateProtocol !== 1) throw new Error("Unsupported Connector update protocol");
  const files = [meta.platform === "win32" ? "webagentmate-bridge.exe" : "webagentmate-bridge", "runtime/agent.mjs", meta.platform === "win32" ? "runtime/node/node.exe" : "runtime/node/bin/node", "runtime/licenses/node.txt", "LICENSE", "setup.cjs", "runtime/updater.cjs", "update-key.json", meta.platform === "win32" ? "webagentmate-launcher.exe" : "webagentmate-launcher"];
  for (const file of files) {
    const info = await fs.stat(path.join(source, file)).catch(() => undefined);
    if (!info?.isFile() || !info.size) throw new Error(`Incomplete Connector package (${file}). Download the complete package again.`);
  }
  return meta;
}
async function atomicWrite(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const handle = await fs.open(temporary, "wx", 0o600);
    try { await handle.writeFile(text); await handle.sync(); } finally { await handle.close(); }
    await fs.rename(temporary, file);
    if (process.platform !== "win32") { const directory = await fs.open(path.dirname(file), "r"); try { await directory.sync(); } finally { await directory.close(); } }
  }
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
  const binary = options.binary || path.join(source, `webagentmate-launcher${platform === "win32" ? ".exe" : ""}`);
  await fs.access(binary);
  for (const file of target.manifests) await atomicWrite(file, manifest(binary, extensionId));
  if (platform === "win32") for (const key of registryKeys) (options.exec || execFileSync)("reg.exe", ["add", key, "/ve", "/t", "REG_SZ", "/d", target.manifests[0], "/f"], { windowsHide: true, stdio: "pipe" });
}
async function install(source, options = {}) {
  const platform = options.platform || process.platform;
  const target = options.locations || locations(platform);
  const meta = await validatePayload(source, platform);
  await fs.mkdir(path.join(target.root, "versions"), { recursive: true, mode: 0o700 });
  const relative = `versions/${meta.version}-${randomUUID()}`;
  const bin = path.join(target.root, relative);
  const activeFile = path.join(target.root, "active.json");
  const oldActive = await fs.readFile(activeFile).catch(error => { if (error.code !== "ENOENT") throw error; });
  const previous = await Promise.all(target.manifests.map(file => fs.readFile(file).catch(error => { if (error.code !== "ENOENT") throw error; })));
  try {
    await fs.cp(source, bin, { recursive: true, errorOnExist: true, force: false });
    const launcherName = `webagentmate-launcher${platform === "win32" ? ".exe" : ""}`;
    const launcher = path.join(target.root, "launcher", launcherName);
    await fs.mkdir(path.dirname(launcher), { recursive: true });
    // The protocol-1 bootstrap is immutable while Chrome may be running it.
    try { await fs.copyFile(path.join(bin, launcherName), launcher, require("node:fs").constants.COPYFILE_EXCL); }
    catch (error) { if (error.code !== "EEXIST") throw error; }
    if (platform !== "win32") await fs.chmod(launcher, 0o755);
    await atomicWrite(activeFile, JSON.stringify({ current: relative, previous: oldActive ? JSON.parse(oldActive).current : null, probation: false }));
    await register(bin, { ...options, platform, locations: target, binary: launcher });
  } catch (error) {
    if (oldActive) await atomicWrite(activeFile, oldActive); else await fs.rm(activeFile, { force: true });
    for (let i = 0; i < previous.length; i++) {
      if (previous[i] === undefined) await fs.rm(target.manifests[i], { force: true });
      else await atomicWrite(target.manifests[i], previous[i]);
    }
    await fs.rm(bin, { recursive: true, force: true });
    throw error;
  }
  return bin;
}

async function unregister(options = {}) {
  const platform = options.platform || process.platform;
  const target = options.locations || locations(platform);
  for (const file of target.manifests) {
    try {
      const value = JSON.parse(await fs.readFile(file, "utf8"));
      if (value.name === HOST && (value.path.startsWith(target.root + path.sep) || value.path === "/opt/webagentmate-bridge/webagentmate-launcher")) await fs.rm(file);
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
    // A package manager can inherit the invoking account's XDG directories.
    // Each migration must resolve paths for its target account, not that user.
    execFileSync("runuser", ["-u", name, "--", process.execPath, __filename, remove ? "migrate-remove" : "migrate-user", source], {
      stdio: "inherit",
      env: { PATH: "/usr/sbin:/usr/bin:/sbin:/bin", HOME: home, USER: name, LOGNAME: name, XDG_DATA_HOME: path.join(home, ".local/share"), XDG_CONFIG_HOME: path.join(home, ".config") }
    });
  }
}
async function migrateUser(source, remove = false) {
  const target = locations();
  const meta = await metadata(source);
  const binary = path.join(source, "webagentmate-launcher");
  for (const file of target.manifests) {
    let value;
    try { value = JSON.parse(await fs.readFile(file, "utf8")); } catch (error) { if (error.code === "ENOENT" || error instanceof SyntaxError) continue; throw error; }
    if (value.name !== HOST) continue;
    const managed = value.path?.startsWith(path.join(target.root, "launcher") + path.sep);
    if (remove) {
      if (managed) await atomicWrite(path.join(target.root, "updates/settings.json"), JSON.stringify({ enabled: false }));
      if (value.path === binary || managed) await fs.rm(file);
    }
    else if (!managed && (value.path?.startsWith(target.root + path.sep) || value.path === binary || value.path === path.join(source, "webagentmate-bridge"))) {
      if (value.path !== binary) await atomicWrite(`${file}.before-package`, JSON.stringify(value));
      await atomicWrite(file, manifest(binary, meta.extensionId));
    }
  }
}
module.exports = { locations, manifest, install, register, unregister, validatePayload, atomicWrite };
if (require.main === module) (async () => {
  const action = process.argv[2], source = path.resolve(process.argv[3] || __dirname);
  if (action === "bootstrap") {
    const target = locations();
    if (!await fs.access(path.join(target.root, "active.json")).then(() => true, () => false)) await install(source);
    console.log(target.root); return;
  }
  if (action === "install") await install(source, { extensionId: process.argv[4] });
  else if (action === "register") await register(source);
  else if (action === "uninstall") {
    await atomicWrite(path.join(locations().root, "updates/settings.json"), JSON.stringify({ enabled: false }));
    await unregister();
    // Windows removes files after this private Node and launcher have exited.
    if (process.platform !== "win32") for (const entry of ["versions", "launcher", "bin", "active.json"]) await fs.rm(path.join(locations().root, entry), { recursive: true, force: true });
  }
  else if (action === "migrate-users" || action === "remove-users") await migrateUsers(source, action === "remove-users");
  else if (action === "migrate-user" || action === "migrate-remove") await migrateUser(source, action === "migrate-remove");
  else throw new Error("Unknown installer action");
  console.log("OK");
})().catch(error => { console.error(error.message); process.exitCode = 1; });
