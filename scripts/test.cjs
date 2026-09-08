const { buildSync } = require("esbuild");
const { spawnSync } = require("node:child_process");
const { readdirSync } = require("node:fs");
const entries = readdirSync("tests").filter(name => name.endsWith(".test.ts"));
buildSync({ entryPoints: entries.map(name => `tests/${name}`), outdir: ".test-output", outExtension: { ".js": ".cjs" }, bundle: true, platform: "node", format: "cjs", target: "node20" });
buildSync({ entryPoints: ["tests/fixtures/process-cleanup.ts"], outfile: ".test-output/process-cleanup.cjs", bundle: true, platform: "node", format: "cjs", target: "node20" });
const result = spawnSync(process.execPath, ["--test", ...entries.map(name => `.test-output/${name.replace(/\.ts$/, ".cjs")}`)], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
