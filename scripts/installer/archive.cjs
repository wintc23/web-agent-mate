// All distributed ZIPs use the same complete payload as graphical installers.
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { validatePayload } = require("./setup.cjs");
const { verifyPayload } = require("./verify-payload.cjs");

async function archive(payload, output) {
  payload = path.resolve(payload);
  const meta = await validatePayload(payload, process.platform);
  const platform = { darwin: "macos", win32: "windows", linux: "linux" }[meta.platform];
  if (meta.arch !== process.arch || meta.nodeVersion !== require("./node-runtime.json").version || meta.version !== require("../../public/manifest.json").version) throw new Error("Build a matching payload before packaging");
  output = path.resolve(output || `release/artifacts/webagentmate-bridge-${platform}-${meta.arch}.zip`);
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "wam-archive-"));
  try {
    const stage = path.join(temporary, "package"), extracted = path.join(temporary, "extracted");
    await fs.cp(payload, stage, { recursive: true });
    for (const action of ["install", "uninstall"]) {
      const script = `${action}-native-host-${platform}.${platform === "windows" ? "ps1" : "sh"}`;
      await fs.copyFile(path.join(__dirname, "..", script), path.join(stage, script));
    }
    const zipped = path.join(temporary, "bridge.zip");
    if (process.platform === "win32") {
      execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "$ErrorActionPreference='Stop'; Compress-Archive -Path (Join-Path $env:WAM_ARCHIVE_STAGE '*') -DestinationPath $env:WAM_ARCHIVE_ZIP; Expand-Archive -LiteralPath $env:WAM_ARCHIVE_ZIP -DestinationPath $env:WAM_ARCHIVE_EXTRACT"], { env: { ...process.env, WAM_ARCHIVE_STAGE: stage, WAM_ARCHIVE_ZIP: zipped, WAM_ARCHIVE_EXTRACT: extracted }, stdio: "inherit" });
    } else {
      execFileSync("zip", ["-qr", zipped, "."], { cwd: stage, stdio: "inherit" });
      execFileSync("unzip", ["-q", zipped, "-d", extracted], { stdio: "inherit" });
    }
    await verifyPayload(extracted);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.copyFile(zipped, output);
    const sha256 = createHash("sha256").update(await fs.readFile(output)).digest("hex");
    await fs.writeFile(`${output}.sha256`, `${sha256}  ${path.basename(output)}\n`);
    await fs.writeFile(`${output}.runtime.json`, JSON.stringify({ version: meta.version, platform: meta.platform, arch: meta.arch, nodeVersion: meta.nodeVersion, sha256, runtimeVerified: true }, null, 2) + "\n");
    console.log(`Verified complete Bridge archive: ${output}`);
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}
module.exports = { archive };
if (require.main === module) archive(process.argv[2] || "build/installer-payload", process.argv[3]).catch(error => { console.error(error); process.exitCode = 1; });
