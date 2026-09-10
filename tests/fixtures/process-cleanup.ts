import { localExecutor } from "../../bridge/runtime/local-tools";
import { access } from "node:fs/promises";
import path from "node:path";

void (async () => {
  const controller = new AbortController();
  const local = localExecutor(process.argv[2], { signal: controller.signal, emit: async () => undefined, ask: async () => "allow" });
  try {
    await local.execute("shell_start", { command: process.argv[3] }, "cleanup-test");
    // Under concurrent test/build load the child may need more than the tool's
    // 300 ms initial poll to start. Verify readiness before testing cleanup.
    const deadline = Date.now() + 2000;
    while (true) {
      try { await access(path.join(process.argv[2], "child.pid")); break; }
      catch (error) { if (Date.now() >= deadline) throw error; }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
  finally { local.close(); }
})().catch(error => { process.stderr.write(String(error)); process.exitCode = 1; });
