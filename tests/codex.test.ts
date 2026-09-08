import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { codexInput, codexThreadSettings, codexTurnSettings, codexThreadSeed, validateElicitation, safeExternalUrl, type NativeControl } from "../src/agent/codex";
import { DEFAULT_CONFIG, assertConfig, type AgentEvent } from "../src/agent/protocol";
import { applyEvent, makeSession } from "../src/agent/sessions";
import { enqueueMessage, takeQueuedMessage } from "../src/agent/message-queue";
import { parseSessionBackup, serializeSession } from "../src/agent/session-backup";
import { runCodex } from "../bridge/runtime/codex";

const config = { ...DEFAULT_CONFIG, location: "local" as const, engine: "codex" as const, model: "" };
test("Codex inherits native permissions/instructions unless explicitly overridden, and uses native plan mode", () => {
  assert.deepEqual(codexThreadSettings(config), { cwd: "" });
  const selected = { ...config, model: "native-model", codex: { effort: "ultra", mode: "plan" as const, sandbox: "read-only" as const, approvalPolicy: "on-request" as const } };
  assert.deepEqual(codexThreadSettings(selected), { cwd: "", model: "native-model", sandbox: "read-only", approvalPolicy: "on-request" });
  assert.deepEqual(codexTurnSettings(selected, "native-model"), { effort: "ultra", collaborationMode: { mode: "plan", settings: { model: "native-model", reasoning_effort: "ultra", developer_instructions: null } } });
  assert.throws(() => assertConfig({ ...config, codex: { sandbox: "bogus" as any } }), /INVALID_CODEX/);
  assert.throws(() => assertConfig({ ...config, codex: { effort: "invalid value" } }), /INVALID_CODEX/);
});
test("Codex settings round-trip in conversation backups; native thread identity never does", () => {
  const session = makeSession({ ...config, permissionMode: "auto", codex: { effort: "high", sandbox: "workspace-write", mode: "plan", serviceTier: "priority" } });
  session.nativeSessionId = "private-native-id";
  const backup = serializeSession(session);
  assert.equal(backup.includes("private-native-id"), false);
  assert.deepEqual(parseSessionBackup(backup).config, session.config);
});
test("skill input carries the enabled local path, ignores disabled skills and plain substrings", () => {
  const skills = [{ name: "review", path: "/skills/review/SKILL.md", description: "", enabled: true, scope: "user" }, { name: "hidden", path: "/hidden", description: "", enabled: false, scope: "user" }];
  assert.deepEqual(codexInput("$review check $hidden review", skills), [{ type: "text", text: "$review check $hidden review", text_elements: [] }, { type: "skill", name: "review", path: "/skills/review/SKILL.md" }]);
});
test("native history import keeps a fork source instead of concurrently resuming the terminal thread", () => {
  const seed = codexThreadSeed({ id: "native", preview: "Original", cwd: "/workspace", createdAt: 1, updatedAt: 2, turns: [{ id: "t", items: [{ id: "u", type: "userMessage", content: [{ type: "text", text: "question" }] }, { id: "r", type: "reasoning", content: ["private reasoning"] }, { id: "a", type: "agentMessage", text: "answer" }] }] }, config);
  assert.equal(seed.nativeForkFromId, "native"); assert.equal(seed.nativeSessionId, undefined);
  assert.deepEqual(seed.entries?.map(item => item.text), ["question", "answer"]);
});
test("MCP elicitation validates required fields, numbers, choices and unknown fields without converting consent", () => {
  const schema = { type: "object", properties: { consent: { type: "boolean" }, count: { type: "integer", minimum: 1, maximum: 3 }, choice: { type: "string", oneOf: [{ const: "a", title: "A" }] } }, required: ["consent", "count"] };
  assert.deepEqual({ ...validateElicitation(schema, { consent: false, count: 2, choice: "a" }) }, { consent: false, count: 2, choice: "a" });
  for (const value of [{ count: 2 }, { consent: "true", count: 2 }, { consent: true, count: 4 }, { consent: true, count: 2, choice: "b" }, { consent: true, count: 2, extra: "x" }]) assert.throws(() => validateElicitation(schema, value));
  assert.equal(safeExternalUrl("javascript:alert(1)"), undefined);
  assert.equal(safeExternalUrl("https://user:password@example.com"), undefined);
  assert.equal(safeExternalUrl("https://example.com/login"), "https://example.com/login");
  const multi = { type: "object", properties: { choices: { type: "array", minItems: 1, items: { anyOf: [{ const: "one", title: "One" }, { const: "two", title: "Two" }] } } } };
  assert.deepEqual({ ...validateElicitation(multi, { choices: ["one", "two"] }) }, { choices: ["one", "two"] });
  assert.throws(() => validateElicitation(multi, { choices: ["other"] }), /selection/);
});
test("steer receipts are idempotent; unconfirmed messages never automatically become another turn", () => {
  const session = makeSession(config), message = enqueueMessage(session, "steer this");
  message.delivery = "sending";
  assert.throws(() => takeQueuedMessage(session), /NOT_FOUND/);
  assert.throws(() => takeQueuedMessage(session, message.id), /IN_PROGRESS/);
  applyEvent(session, { type: "steered", id: message.id, text: message.text });
  applyEvent(session, { type: "steered", id: message.id, text: message.text });
  assert.equal(session.entries.length, 1); assert.equal(session.queuedMessages?.length, 0);
  const pending = enqueueMessage(session, "not confirmed"); pending.delivery = "uncertain";
  assert.throws(() => takeQueuedMessage(session), /NOT_FOUND/);
});

// A real subprocess speaks the App Server protocol. It deliberately emits a
// completed child turn before the parent, then requests MCP/user interaction.
test("Codex adapter steers the original turn, handles MCP forms and ignores child completion", { timeout: 10_000 }, async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "wam-codex-protocol-"));
  const executable = path.join(workspace, "codex-fixture");
  await fs.writeFile(executable, `#!${process.execPath}
const fs = require("node:fs"), readline = require("node:readline");
const send = x => process.stdout.write(JSON.stringify(x) + "\\n");
const event = (method, params) => send({method,params});
const reply = (id,result) => send({id,result});
const lines = readline.createInterface({input:process.stdin});
lines.on("line", line => {
 const m = JSON.parse(line); fs.appendFileSync("rpc.jsonl", line+"\\n");
 if(m.method === "initialize") reply(m.id,{});
 if(m.method === "thread/start") reply(m.id,{thread:{id:"parent"},model:"native",reasoningEffort:"medium"});
 if(m.method === "turn/start") { reply(m.id,{turn:{id:"turn-1"}}); event("turn/started",{threadId:"parent",turn:{id:"turn-1"}}); event("turn/completed",{threadId:"child",turn:{id:"child-turn",status:"completed"}}); }
 if(m.method === "turn/steer") { reply(m.id,{turnId:"turn-1"}); send({id:100,method:"mcpServer/elicitation/request",params:{threadId:"parent",serverName:"test",mode:"form",message:"Choose",requestedSchema:{type:"object",properties:{count:{type:"integer",minimum:1}},required:["count"]}}}); }
 if(m.id === 100 && m.result) { event("thread/tokenUsage/updated",{threadId:"parent",turnId:"turn-1",tokenUsage:{total:{totalTokens:42,inputTokens:30,outputTokens:12,cachedInputTokens:10},last:{totalTokens:42},modelContextWindow:1000}}); event("turn/plan/updated",{threadId:"parent",turnId:"turn-1",plan:[{step:"Verify",status:"completed"}]}); event("turn/completed",{threadId:"parent",turn:{id:"turn-1",status:"completed"}}); }
});

`, { mode: 0o700 });
  const old = process.env.WAM_CODEX_PATH; process.env.WAM_CODEX_PATH = executable;
  const events: AgentEvent[] = []; const controller = new AbortController(); let control: NativeControl | undefined; let steering: Promise<void> | undefined;
  try {
    await runCodex({ config: { ...config, workspace, codex: { effort: "high", mode: "plan" } }, prompt: "Start", history: [] }, {
      context: { signal: controller.signal, emit: async event => { events.push(event); if (event.type === "native_turn") steering = control!("steer-id", "Follow-up"); }, ask: async request => { assert.equal(request.kind, "elicitation"); assert.equal(request.schema?.required[0], "count"); return JSON.stringify({ action: "accept", content: { count: 2 } }); } },
      browser: async () => { throw new Error("Unexpected browser call"); }, activity() {}, send() {}, cleanups: new Set(), setControl: value => { control = value; }
    });
    await steering;
    const rpc = (await fs.readFile(path.join(workspace, "rpc.jsonl"), "utf8")).trim().split("\n").map(line => JSON.parse(line));
    assert.equal(rpc.filter(item => item.method === "turn/start").length, 1);
    assert.equal(rpc.some(item => item.method === "turn/interrupt"), false);
    assert.equal(rpc.find(item => item.method === "turn/steer").params.expectedTurnId, "turn-1");
    assert.equal(rpc.find(item => item.method === "turn/start").params.collaborationMode.settings.model, "native");
    assert.deepEqual(rpc.find(item => item.id === 100 && item.result).result, { action: "accept", content: { count: 2 } });
    assert.equal(events.filter(event => event.type === "steered").length, 1);
    assert.ok(events.some(event => event.type === "usage"));
    assert.ok(events.some(event => event.type === "detail" && event.name === "plan" && event.text.includes("✓ Verify")));
  } finally { controller.abort(); if (old === undefined) delete process.env.WAM_CODEX_PATH; else process.env.WAM_CODEX_PATH = old; await fs.rm(workspace, { recursive: true, force: true }); }
});

test("MCP OAuth keeps App Server alive until its callback confirms login", { timeout: 10_000 }, async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "wam-codex-oauth-"));
  const executable = path.join(workspace, "codex-fixture");
  await fs.writeFile(executable, `#!${process.execPath}
const lines=require("node:readline").createInterface({input:process.stdin});
const send=x=>process.stdout.write(JSON.stringify(x)+"\\n");
lines.on("line",line=>{const m=JSON.parse(line);if(m.method==="initialize")send({id:m.id,result:{}});if(m.method==="mcpServer/oauth/login"){send({id:m.id,result:{authorizationUrl:"https://example.test/authorize"}});setTimeout(()=>send({method:"mcpServer/oauthLogin/completed",params:{name:"example",threadId:null,success:true}}),50);}});
`, { mode: 0o700 });
  const old = process.env.WAM_CODEX_PATH; process.env.WAM_CODEX_PATH = executable;
  const controller = new AbortController(); const messages: any[] = []; let asked = false;
  try {
    await runCodex({ config: { ...config, workspace }, prompt: "", history: [], modelsOnly: true, codexRequest: { method: "mcpServer/oauth/login", params: { name: "example" } } }, {
      context: { signal: controller.signal, emit: async () => undefined, ask: async request => { asked = true; assert.equal(request.url, "https://example.test/authorize"); return '{"action":"accept","content":null}'; } },
      browser: async () => { throw new Error("Unexpected browser call"); }, activity() {}, send: message => { messages.push(message); }, cleanups: new Set(), setControl() {}
    });
    assert.equal(asked, true); assert.equal(messages.at(-1).type, "codex_result");
  } finally { controller.abort(); if (old === undefined) delete process.env.WAM_CODEX_PATH; else process.env.WAM_CODEX_PATH = old; await fs.rm(workspace, { recursive: true, force: true }); }
});
