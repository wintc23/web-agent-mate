import { localExecutor } from "../../bridge/runtime/local-tools";

void (async () => {
  const controller = new AbortController();
  const local = localExecutor(process.argv[2], { signal: controller.signal, emit: async () => undefined, ask: async () => "allow" });
  try { await local.execute("shell_start", { command: process.argv[3] }, "cleanup-test"); }
  finally { local.close(); }
})().catch(error => { process.stderr.write(String(error)); process.exitCode = 1; });
