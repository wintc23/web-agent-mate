import { test } from "node:test";
import assert from "node:assert/strict";
import { orcaKeyFromExchange, parseOrcaCallback, validateOrcaKey } from "../src/orca-auth";
import { modelOptions } from "../src/agent/model-options";
import { readProviderIssue } from "../src/agent/provider-error";

test("OAuth accepts only the expected callback, state, code and API scope", () => {
  const callback = "https://test.chromiumapp.org/orcarouter";
  assert.equal(parseOrcaCallback(`${callback}?code=single-use&state=expected`, callback, "expected"), "single-use");
  assert.throws(() => parseOrcaCallback("https://other.test/orcarouter?code=x&state=expected", callback, "expected"), /AUTH_CALLBACK_INVALID/);
  assert.throws(() => parseOrcaCallback(`${callback}?code=x&state=wrong`, callback, "expected"), /AUTH_STATE_INVALID/);
  assert.throws(() => parseOrcaCallback(`${callback}?error=access_denied&state=expected`, callback, "expected"), /AUTH_DECLINED/);
  assert.throws(() => orcaKeyFromExchange({ key: "sk-orca-test", scope: "connector" }), /AUTH_SCOPE_INVALID/);
  assert.equal(orcaKeyFromExchange({ key: "sk-orca-test", scope: "api" }), "sk-orca-test");
  assert.equal(validateOrcaKey(" sk-orca-test-key\n"), "sk-orca-test-key");
  assert.throws(() => validateOrcaKey("sk-or-test-key"), /AUTH_KEY_INVALID/);
});

test("model cascades group by provider, retain selected model, and never collapse free/paid variants", () => {
  const options = modelOptions([
    { id: "openai/gpt-test", name: "OpenAI: GPT test", free: false },
    { id: "openai/gpt-test-free", name: "OpenAI: GPT test free", free: true },
    { id: "orcarouter/free", name: "Orca Free", free: true },
    { id: "anthropic/claude-test", name: "Anthropic: Claude test", free: false }
  ], "google/gemini-old");
  assert.equal(options[0].value, "orcarouter");
  assert.equal(options.find(item => item.value === "openai")!.children![0].value, "openai/gpt-test-free");
  assert.equal(options.find(item => item.value === "openai")!.children!.length, 2);
  assert.equal(options.find(item => item.value === "google")!.children![0].value, "google/gemini-old");
});

test("background saves a successful PKCE grant independently of catalog availability, and rejects bad manual keys", async () => {
  const previousChrome = globalThis.chrome, previousFetch = globalThis.fetch;
  const storage: Record<string, any> = { orcarouter_api_key: "sk-orca-existing" };
  let listener: any, authorization: URL, grantMode = "good", catalogRequests = 0, keyStatus = 401;
  const get = async (keys: string | string[]) => Object.fromEntries((typeof keys === "string" ? [keys] : keys).map(key => [key, storage[key]]));
  const area = { get, set: async (items: any) => Object.assign(storage, items), remove: async (keys: string[]) => keys.forEach(key => delete storage[key]), setAccessLevel: async () => {} };
  globalThis.chrome = { runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onConnect: { addListener() {} }, onMessage: { addListener(fn: any) { listener = fn; } }, sendNativeMessage: async () => { throw new Error("No test host"); } },
    storage: { local: area, session: area }, identity: { getRedirectURL: () => "https://test.chromiumapp.org/orcarouter", launchWebAuthFlow: async ({ url }: { url: string }) => {
      authorization = new URL(url); assert.equal(authorization.protocol, "https:");
      assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");
      return `${authorization.searchParams.get("callback_url")}?code=test-code&state=${authorization.searchParams.get("state")}`;
    } } } as unknown as typeof chrome;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("openid-configuration")) return Response.json({ authorization_endpoint: "http://www.orcarouter.ai/auth", token_endpoint: "http://www.orcarouter.ai/api/v1/auth/keys" });
    if (url.endsWith("auth/keys")) {
      const body = JSON.parse(String(init?.body));
      const digest = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body.code_verifier))).toString("base64url");
      assert.equal(digest, authorization.searchParams.get("code_challenge"));
      return Response.json({ key: "sk-orca-new-key", scope: grantMode === "good" ? "api" : "connector" });
    }
    if (url.includes("generation?")) return Response.json({ error: { message: "Revoked key", code: keyStatus === 429 ? "rate_limit" : "invalid_key" } }, { status: keyStatus, headers: { "Retry-After": "60" } });
    if (url.endsWith("models")) { catalogRequests++; return Response.json({ error: "Catalog unavailable" }, { status: 503 }); }
    throw new Error(`Unexpected URL: ${url}`);
  };
  try {
    await import("../src/background");
    const request = (message: any) => new Promise<any>(resolve => listener(message, {}, resolve));
    const connected = await request({ type: "auth:connect" });
    assert.equal(connected.ok, true); assert.equal(connected.data.connected, true);
    assert.equal(storage.orcarouter_api_key, "sk-orca-new-key"); assert.equal(catalogRequests, 0);
    grantMode = "wrong-scope";
    assert.match((await request({ type: "auth:connect" })).error, /AUTH_SCOPE_INVALID/);
    assert.equal(storage.orcarouter_api_key, "sk-orca-new-key");
    assert.match((await request({ type: "auth:key", key: "sk-orca-revoked" })).error, /AUTH_CREDENTIAL_REJECTED/);
    assert.equal(storage.orcarouter_api_key, "sk-orca-new-key");
    keyStatus = 429;
    const limited = await request({ type: "auth:verify" });
    assert.equal(readProviderIssue(limited.error)?.kind, "rate");
    assert.ok(readProviderIssue(limited.error)!.retryAt! > Date.now());
    assert.doesNotMatch(limited.error, /Revoked key|invalid_key/);
    assert.match((await request({ type: "agent:start", adapter: "orcarouter", goal: "legacy remote request" })).error, /LOCAL_ENGINE_REQUIRES_BRIDGE/);
    storage["agent_task:legacy"] = { taskId: "legacy", adapter: "orcarouter", status: "waiting_approval" };
    assert.match((await request({ type: "agent:approve", taskId: "legacy", action: { name: "click", elementId: "old", reason: "legacy" } })).error, /LOCAL_ENGINE_REQUIRES_BRIDGE/);
  } finally { globalThis.chrome = previousChrome; globalThis.fetch = previousFetch; }
});
