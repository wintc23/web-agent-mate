import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm, access } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { macBridgeInstallCommand } from "../src/agent/bridge-install-command";

const extensionId = "lmlkkallnnjijicmfmfdelnamcnhflfg";

test("installation commands reject shell input in version and extension identity", () => {
  for (const version of ["0.6.0; touch injected", "$(whoami)", "0.6.0\nexit", "../latest"]) assert.throws(() => macBridgeInstallCommand(version, extensionId));
  for (const id of ["", `${extensionId}'`, `${extensionId}\n`, "$(whoami)"]) assert.throws(() => macBridgeInstallCommand("0.6.0", id));
});

test("Mac command selects the host architecture and stops before installation on download or checksum failure", { skip: process.platform === "win32" }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "wam-command-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const marker = path.join(directory, "installed"), log = path.join(directory, "downloads");
  const file = Buffer.from("complete archive fixture");
  const digest = createHash("sha256").update(file).digest("hex");
  const script = async (name: string, content: string) => writeFile(path.join(directory, name), "#!/bin/bash\nset -euo pipefail\n" + content, { mode: 0o755 });
  await script("uname", 'if [[ "$1" == -s ]]; then echo "${WAM_TEST_OS:-Darwin}"; else echo "$WAM_TEST_ARCH"; fi\n');
  await script("sysctl", 'echo "${WAM_TEST_TRANSLATED:-0}"\n');
  await script("curl", `[[ "\${WAM_TEST_DOWNLOAD_FAIL:-0}" != 1 ]] || exit 22
while [[ "$1" != --output ]]; do shift; done
wam_output="$2"; wam_url="$3"
printf '%s\\n' "$wam_url" >> "$WAM_TEST_DOWNLOADS"
if [[ "$wam_url" == *.sha256 ]]; then
  wam_filename="$(basename "\${wam_url%.sha256}")"
  printf '%s  %s\\n' "\${WAM_TEST_DIGEST}" "$wam_filename" > "$wam_output"
else
  printf 'complete archive fixture' > "$wam_output"
fi
`);
  await script("ditto", `mkdir -p "$4"
cat > "$4/install-native-host-macos.sh" <<'INSTALL'
#!/bin/bash
printf '%s' "$1" > "$WAM_TEST_MARKER"
INSTALL
`);
  const command = macBridgeInstallCommand("0.6.0", extensionId);
  const run = (extra: Record<string, string>) => spawnSync("/bin/bash", ["-s"], {
    input: command, encoding: "utf8", timeout: 10000,
    env: { ...process.env, PATH: `${directory}:/usr/bin:/bin`, WAM_TEST_ARCH: "x86_64", WAM_TEST_MARKER: marker, WAM_TEST_DOWNLOADS: log, WAM_TEST_DIGEST: digest, ...extra }
  });
  for (const [arch, translated, expected] of [["x86_64", "0", "x64"], ["arm64", "0", "arm64"], ["x86_64", "1", "arm64"]]) {
    await rm(log, { force: true });
    const result = run({ WAM_TEST_ARCH: arch, WAM_TEST_TRANSLATED: translated });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(await readFile(marker, "utf8"), extensionId);
    assert.deepEqual((await readFile(log, "utf8")).trim().split("\n"), [
      `https://github.com/wintc23/web-agent-mate/releases/download/v0.6.0/webagentmate-bridge-macos-${expected}.zip`,
      `https://github.com/wintc23/web-agent-mate/releases/download/v0.6.0/webagentmate-bridge-macos-${expected}.zip.sha256`
    ]);
    await rm(marker);
  }
  for (const failure of [{ WAM_TEST_DIGEST: "0".repeat(64) }, { WAM_TEST_DOWNLOAD_FAIL: "1" }, { WAM_TEST_OS: "Linux" }, { WAM_TEST_ARCH: "unknown" }]) {
    const result = run(failure);
    assert.notEqual(result.status, 0);
    await assert.rejects(access(marker));
  }
});
