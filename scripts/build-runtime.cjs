const { build } = require("esbuild");
const { mkdir, copyFile } = require("node:fs/promises");
build({ entryPoints: ["bridge/runtime/agent.ts"], outfile: "bridge/runtime-dist/agent.mjs", bundle: true,
  platform: "node", target: "node20", format: "esm", sourcemap: false,
  banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);' }
}).then(async () => {
  await build({ entryPoints: ["scripts/installer/updater.cjs"], outfile: "bridge/runtime-dist/updater.cjs", bundle: true, platform: "node", target: "node20", format: "cjs" });
  await mkdir("bridge/runtime-dist/licenses", { recursive: true });
  await copyFile("node_modules/fflate/LICENSE", "bridge/runtime-dist/licenses/fflate.txt");
  await copyFile("node_modules/@anthropic-ai/claude-agent-sdk/LICENSE.md", "bridge/runtime-dist/licenses/claude-agent-sdk.md");
  await copyFile("node_modules/zod/LICENSE", "bridge/runtime-dist/licenses/zod.txt");
}).catch(error => { console.error(error); process.exitCode = 1; });
