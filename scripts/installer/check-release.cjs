// Public installers must pass the platform's trust checks before publication.
const fs = require("node:fs");
const path = require("node:path");
const directory = process.argv[2] || "artifacts";
const version = require("../../public/manifest.json").version;
if (process.env.GITHUB_REF_NAME && process.env.GITHUB_REF_NAME !== `v${version}`) throw new Error("Release tag must match the extension manifest version");
for (const file of ["webagentmate-bridge-macos-arm64.dmg", "webagentmate-bridge-macos-x64.dmg", "webagentmate-bridge-windows-x64.exe", "webagentmate-bridge-linux-x64.deb", "webagentmate-bridge-linux-x64.rpm", "webagentmate-extension.zip"]) {
  if (!fs.statSync(path.join(directory, file)).isFile()) throw new Error(`Missing release asset: ${file}`);
  if (/\.(dmg|exe)$/.test(file)) {
    const status = JSON.parse(fs.readFileSync(path.join(directory, `${file}.release.json`)));
    if (status.version !== version) throw new Error(`${file} does not match the extension version`);
    if (!status.signed || file.endsWith(".dmg") && !status.notarized) throw new Error(`${file} requires signing${file.endsWith(".dmg") ? " and Apple notarization" : ""} before public release. Configure the release secrets; development artifacts remain available from the workflow run.`);
  }
}
