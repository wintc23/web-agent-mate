const fs = require("node:fs");
const path = require("node:path");
const { execFileSync: exec } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const payload = path.resolve(process.argv[2] || "build/installer-payload");
const meta = JSON.parse(fs.readFileSync(path.join(payload, "bundle.json")));
if (process.platform !== "win32" || meta.platform !== "win32" || meta.arch !== "x64") throw new Error("Windows x64 payload required");
const output = path.join(root, "release/artifacts/webagentmate-bridge-windows-x64.exe");
fs.mkdirSync(path.dirname(output), { recursive: true });
const compiler = process.env.WAM_MAKENSIS || path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "NSIS/makensis.exe");
exec(compiler, [`/DPAYLOAD=${payload}`, `/DOUTPUT=${output}`, `/DVERSION=${meta.version}`, path.join(__dirname, "windows.nsi")], { stdio: "inherit" });
const certificate = process.env.WAM_WINDOWS_CERTIFICATE;
if (certificate) {
  try {
    exec(process.env.WAM_SIGNTOOL || "signtool.exe", ["sign", "/fd", "SHA256", "/f", certificate, "/p", process.env.WAM_WINDOWS_CERTIFICATE_PASSWORD || "", "/tr", "http://timestamp.digicert.com", "/td", "SHA256", output], { stdio: "inherit" });
    exec(process.env.WAM_SIGNTOOL || "signtool.exe", ["verify", "/pa", "/all", output], { stdio: "inherit" });
  } catch { throw new Error("Windows signing failed. Check the signing certificate and timestamp service."); }
}
fs.writeFileSync(`${output}.release.json`, JSON.stringify({ signed: !!certificate, version: meta.version }));
console.log(output);
