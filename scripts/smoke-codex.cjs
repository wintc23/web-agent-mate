// Opt-in: exercises the user's installed Codex with a temporary workspace and
// synthetic conversation. No existing thread is resumed or modified.
const { spawn } = require("node:child_process");
const { createInterface } = require("node:readline");
const { mkdtemp, rm, writeFile } = require("node:fs/promises");
const { buildSync } = require("esbuild");
const path = require("node:path"), os = require("node:os"), assert = require("node:assert/strict");

(async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "wam-codex-compat-"));
  buildSync({ entryPoints: ["src/agent/transport.ts"], outfile: path.join(workspace, "transport.cjs"), bundle: true, platform: "node", format: "cjs" });
  const { encodeRuntimeMessage, RuntimeDecoder } = require(path.join(workspace, "transport.cjs"));
  const base = { location: "local", engine: "codex", model: "", workspace, maxSteps: 6, codex: { sandbox: "read-only", approvalPolicy: "never" } };
  const marker = `STEER-${Date.now()}`;
  const results = {};
  async function run(payload, onMessage = () => {}) {
    const child = spawn(process.execPath, [path.resolve("bridge/runtime-dist/agent.mjs")], { env: { ...process.env, WAM_CODEX_PATH: process.env.WAM_CODEX_PATH || path.join(os.homedir(), ".local/bin/codex") }, stdio: ["pipe", "pipe", "pipe"] });
    const decoder = new RuntimeDecoder(); const events = []; let result, models, errorText = "";
    const send = message => { for (const frame of encodeRuntimeMessage(message)) child.stdin.write(JSON.stringify(frame) + "\n"); };
    const lines = createInterface({ input: child.stdout }); child.stderr.on("data", data => { errorText = (errorText + data).slice(-1000); });
    let timer;
    try {
      await new Promise((resolve, reject) => {
        timer = setTimeout(() => { send({ type: "cancel" }); reject(new Error("Codex compatibility smoke timed out")); }, 150_000);
        child.on("error", reject); child.stdin.on("error", reject); child.on("exit", code => reject(new Error(`Runtime exited ${code}: ${errorText}`)));
        lines.on("line", line => {
          try {
            const m = decoder.push(JSON.parse(line)); if (!m) return;
            if (m.type === "event") events.push(m.event);
            if (m.type === "models") models = m.models;
            if (m.type === "codex_result") result = m.result;
            if (m.type === "ask") send({ type: "reply", id: m.id, value: m.payload.kind === "elicitation" ? '{"action":"decline","content":null}' : "deny" });
            onMessage(m, send);
            if (m.type === "done") resolve();
            if (["error", "cancelled"].includes(m.type)) reject(new Error(m.error || m.type));
          } catch (error) { reject(error); }
        });
        send({ type: "start", payload: { config: base, history: [], prompt: "", ...payload } });
      });
      return { events, result, models };
    } finally {
      clearTimeout(timer); decoder.dispose(); lines.close(); child.stdin.end();
      await new Promise(resolve => { if (child.exitCode !== null) return resolve(); const timeout = setTimeout(() => child.kill(), 2000); child.once("exit", () => { clearTimeout(timeout); resolve(); }); });
    }
  }
  const request = async (method, params) => (await run({ modelsOnly: true, codexRequest: { method, params } })).result;
  try {
    const { models } = await run({ modelsOnly: true });
    assert.ok(models.length && models.some(model => model.supportedReasoningEfforts?.length));
    results.models = models.length;
    const skills = await request("skills/list", { cwds: [workspace] });
    assert.ok(Array.isArray(skills.data)); results.skills = skills.data.flatMap(item => item.skills).length;
    const mcp = await request("mcpServerStatus/list", { limit: 50 });
    assert.ok(Array.isArray(mcp.data)); results.mcpServers = mcp.data.length;
    if (process.argv.includes("--turn")) {
      let browserId, steered = false;
      const first = await run({ prompt: 'Integration test. Call wam_update_plan with plan "test", then reply briefly. Do not read files, run commands or call other tools.' }, (m, send) => {
        if (m.type === "browser") {
          assert.equal(m.payload.name, "update_plan"); browserId = m.id;
          send({ type: "control", id: "smoke-steer", text: `Additional instruction: include the exact text ${marker} in your final reply.` });
        }
        if (m.type === "control_reply") {
          assert.equal(m.error, undefined); steered = true;
          send({ type: "reply", id: browserId, value: { text: "Test plan recorded" } });
        }
      });
      assert.equal(steered, true); assert.ok(first.events.some(event => event.type === "steered"));
      assert.ok(first.events.filter(event => event.type === "text").map(event => event.delta).join("").includes(marker));
      const id = first.events.find(event => event.type === "session").id;
      const page = await request("thread/turns/list", { threadId: id, itemsView: "full", limit: 100, sortDirection: "asc" });
      assert.ok(page.data.length > 0 && JSON.stringify(page.data).includes(marker));
      const listed = await request("thread/list", { cwd: workspace, limit: 30, modelProviders: [] });
      assert.ok(listed.data.some(thread => thread.id === id));
      const metadata = await request("thread/read", { threadId: id, includeTurns: false });
      assert.equal(metadata.thread.id, id);
      const fork = await run({ nativeForkFromId: id, prompt: "Recall the exact STEER marker from the previous conversation and reply with it alone. Do not use tools." });
      const forkId = fork.events.find(event => event.type === "session").id;
      assert.notEqual(forkId, id); assert.ok(fork.events.filter(event => event.type === "text").map(event => event.delta).join("").includes(marker));
      results.steer = true; results.originalThread = id; results.forkThread = forkId; results.nativeHistory = true;
    }
    await writeFile(process.argv.includes("--turn") ? "/tmp/webmate-codex-smoke-results.json" : "/tmp/webmate-codex-catalog-results.json", JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally { await rm(workspace, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
