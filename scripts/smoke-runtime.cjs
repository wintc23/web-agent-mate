// Opt-in integration checks using the user's installed agent and account.
// --turn verifies a real tool round-trip AND native context across two processes.
// --cancel verifies cancellation while a browser tool is awaiting its result.
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { createInterface } = require("node:readline");
const { buildSync } = require("esbuild");
const { randomUUID } = require("node:crypto");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const engine = process.argv[2] || "codex";
const turns = process.argv.includes("--turn");
const cancelTest = process.argv.includes("--cancel");
const throughBridge = process.argv.includes("--bridge");

// Read only the synthetic thread created by this test. This separates durable
// history failures from a model choosing not to follow the second-turn prompt.
async function assertCodexHistory(workspace, threadId, marker) {
  const child = spawn(process.env.WAM_CODEX_PATH || path.join(os.homedir(), ".local/bin/codex"), ["app-server", "--listen", "stdio://"], { cwd: workspace, stdio: ["pipe", "pipe", "ignore"] });
  const lines = createInterface({ input: child.stdout });
  let timer;
  try {
    const thread = await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Timed out reading the test thread's persisted history")), 15_000);
      child.on("error", reject); child.stdin.on("error", reject);
      child.on("exit", () => reject(new Error("Codex exited before returning persisted history")));
      lines.on("line", line => {
        try {
          const message = JSON.parse(line);
          if (message.id === undefined) return;
          if (message.error) { reject(new Error(message.error.message)); return; }
          if (message.id === 1) {
            child.stdin.write(JSON.stringify({ method: "initialized" }) + "\n");
            child.stdin.write(JSON.stringify({ id: 2, method: "thread/read", params: { threadId, includeTurns: true } }) + "\n");
          } else if (message.id === 2) resolve(message.result.thread);
        } catch (error) { reject(error); }
      });
      child.stdin.write(JSON.stringify({ id: 1, method: "initialize", params: { clientInfo: { name: "webagentmate_history_test", version: "0.6.0" }, capabilities: { experimentalApi: true } } }) + "\n");
    });
    const items = (thread.turns || []).flatMap(turn => turn.items || []);
    assert.ok(JSON.stringify(items).includes(marker), `Persisted history lost the tool marker; item types: ${items.map(item => item.type).join(", ")}`);
    console.log("codex: persisted tool-result marker verified via thread/read");
  } finally {
    clearTimeout(timer); lines.close(); child.stdin.end();
    await new Promise(resolve => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      const timer = setTimeout(() => child.kill(), 1500);
      child.once("exit", () => { clearTimeout(timer); resolve(); });
    });
  }
}

(async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "webmate-smoke-"));
  const transportFile = path.join(workspace, "transport.cjs");
  buildSync({ entryPoints: ["src/agent/transport.ts"], outfile: transportFile, bundle: true, platform: "node", format: "cjs" });
  const { encodeRuntimeMessage, RuntimeDecoder } = require(transportFile);
  const marker = `wam-${randomUUID()}`;
  const toolName = engine === "codex" ? "wam_update_plan" : "mcp__webmate__update_plan";
  async function run({ nativeSessionId, prompt, modelsOnly = false, cancel = false }) {
    const executable = throughBridge ? process.env.WAM_BRIDGE_PATH || path.resolve(`bridge/target/release/webagentmate-bridge${process.platform === "win32" ? ".exe" : ""}`) : process.execPath;
    const child = spawn(executable, throughBridge ? ["chrome-extension://lmlkkallnnjijicmfmfdelnamcnhflfg/"] : [path.resolve("bridge/runtime-dist/agent.mjs")], { env: { ...process.env,
      WAM_CODEX_PATH: process.env.WAM_CODEX_PATH || path.join(os.homedir(), ".local/bin/codex"),
      WAM_CLAUDE_PATH: process.env.WAM_CLAUDE_PATH || path.join(os.homedir(), ".local/bin/claude") }, stdio: ["pipe", "pipe", "pipe"] });
    let text = ""; let sessionId; let tools = 0; let terminal; let models; let timer; let forced;
    const toolResults = [];
    const decoder = new RuntimeDecoder();
    let firstFrame = true;
    const write = value => {
      for (const frame of encodeRuntimeMessage(value)) {
        if (throughBridge) {
          const payload = Buffer.from(JSON.stringify({ id: randomUUID(), protocolVersion: 1, method: firstFrame ? "runtime.open" : "runtime.send", params: frame })); firstFrame = false;
          const length = Buffer.alloc(4); length.writeUInt32LE(payload.length); child.stdin.write(Buffer.concat([length, payload]));
        } else child.stdin.write(JSON.stringify(frame) + "\n");
      }
    };
    let fail;
    const outcome = new Promise((resolve, reject) => {
      fail = reject;
      timer = setTimeout(() => { write({ type: "cancel" }); reject(new Error(`${engine}: smoke timeout after 120s`)); forced = setTimeout(() => child.kill(), 3000); }, 120_000);
      const receive = line => {
        try {
          const message = decoder.push(JSON.parse(line)); if (!message) return;
          if (message.type === "models") models = message.models;
          if (message.type === "event") {
            if (message.event.type === "session") sessionId = message.event.id;
            if (message.event.type === "text") text += message.event.delta;
            if (message.event.type === "tool_end") toolResults.push(message.event.output);
          }
          if (message.type === "browser") {
            assert.equal(message.payload.name, "update_plan", "Only the test planning tool is authorized"); tools++;
            if (nativeSessionId) assert.ok(message.payload.args.plan.includes(marker), "Resumed agent must remember the previous tool result");
            if (cancel) { write({ type: "cancel" }); return; }
            write({ type: "reply", id: message.id, value: { text: `Test plan recorded. Remember this verification marker: ${marker}` } });
          }
          if (message.type === "ask") write({ type: "reply", id: message.id, value: "deny" });
          if (["done", "error", "cancelled"].includes(message.type)) {
            terminal = message.type;
            child.stdin.end();
            if (message.type === (cancel ? "cancelled" : "done")) resolve({ text, sessionId, tools, models, terminal, toolResults });
            else reject(new Error(message.error || message.type));
          }
        } catch (error) { reject(error); child.stdin.end(); }
      };
      if (throughBridge) {
        let buffered = Buffer.alloc(0);
        child.stdout.on("data", data => {
          buffered = Buffer.concat([buffered, data]);
          while (buffered.length >= 4) {
            const length = buffered.readUInt32LE(0);
            if (length > 1_048_576) { reject(new Error("Native frame exceeds Chrome limit")); child.stdin.end(); return; }
            if (buffered.length < length + 4) return;
            receive(buffered.subarray(4, length + 4).toString()); buffered = buffered.subarray(length + 4);
          }
        });
      } else createInterface({ input: child.stdout }).on("line", receive);
      child.on("error", reject);
      child.on("exit", code => { if (!terminal) reject(new Error(`Runtime exited without completion: ${code}`)); });
    });
    child.stderr.resume(); child.stdin.on("error", error => { if (!terminal) fail(error); });
    const history = modelsOnly && process.argv.includes("--large") ? [{ role: "user", content: "长会话分片测试😀".repeat(100_000) }] : [];
    write({ type: "start", payload: { config: { location: "local", engine, model: "", workspace, maxSteps: 6 }, prompt, nativeSessionId, history, modelsOnly } });
    try { return await outcome; }
    finally {
      clearTimeout(timer); clearTimeout(forced); decoder.dispose(); child.stdin.end();
      await new Promise(resolve => { if (child.exitCode !== null) return resolve(); const kill = setTimeout(() => child.kill(), 3000); child.once("exit", () => { clearTimeout(kill); resolve(); }); });
    }
  }
  try {
    if (turns || cancelTest) {
      const first = await run({ prompt: `Integration test: call ${toolName} with the plan text "test", then reply only "Test complete". Do not use other tools, read files, access pages or run commands.`, cancel: cancelTest });
      assert.ok(first.tools > 0, "A real tool request must reach the client");
      assert.ok(first.sessionId, "A native session identity must be returned");
      if (!cancelTest) assert.ok(first.toolResults.some(result => result.text.includes(marker) && !result.isError), "The UI event must preserve the real tool result");
      console.log(`${engine}: real tool round-trip ${first.terminal}`);
      if (turns && !cancelTest) {
        if (engine === "codex") await assertCodexHistory(workspace, first.sessionId, marker);
        const second = await run({ nativeSessionId: first.sessionId, prompt: `Continue this test. Call ${toolName} with the exact verification marker from the PREVIOUS tool result as the plan text. Then reply with that marker. Do not use other tools or read files.` });
        assert.equal(second.sessionId, first.sessionId); assert.ok(second.tools > 0, `No resumed browser call: ${second.text.slice(0, 1200)}`); assert.ok(second.text.includes(marker), "Reply must preserve the previous tool's marker");
        console.log(`${engine}: two-process native session resume and tool-result memory passed`);
      }
    } else {
      const result = await run({ prompt: "", modelsOnly: true }); assert.ok(result.models?.length);
      console.log(`${engine}: ${result.models.length} native models available${throughBridge ? " via framed Rust Bridge" : ""}${process.argv.includes("--large") ? "; large history reassembled" : ""}`);
    }
  } finally { await rm(workspace, { recursive: true, force: true }); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
