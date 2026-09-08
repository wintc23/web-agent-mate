import { test } from "node:test";
import assert from "node:assert/strict";
import { orcaFailure, readProviderIssue } from "../src/agent/provider-error";
import { agentErrorText } from "../src/agent/error-text";
import { complete } from "../src/agent/loop";
import { makeSession } from "../src/agent/sessions";
import { parseSessionBackup, serializeSession } from "../src/agent/session-backup";

const now = Date.parse("2026-09-08T00:00:00Z");
const body = (code: string, message = "Rejected", metadata?: object) => JSON.stringify({ error: { code, message, metadata } });

test("free-tier 429s distinguish timed rate windows from per-request prompt caps", () => {
  const rate = readProviderIssue(orcaFailure(429, body("free_rate_limited"), "60", now));
  assert.deepEqual(rate, { kind: "rate", retryAt: now + 60_000 });
  assert.deepEqual(readProviderIssue(orcaFailure(429, body("free_rate_limited"), null, now)), { kind: "freePrompt" });
  assert.deepEqual(readProviderIssue(orcaFailure(429, "", "120", now)), { kind: "rate", retryAt: now + 120_000 });
  assert.deepEqual(readProviderIssue(orcaFailure(429, "Too many requests", "Tue, 08 Sep 2026 00:01:00 GMT", now)), rate);
  assert.equal(readProviderIssue(orcaFailure(429, body("free_rate_limited"), "invalid", now))?.kind, "rate");
  assert.equal(readProviderIssue(`PROVIDER_RATE_LIMIT: ${body("free_rate_limited")}`)?.kind, "freeLimit");
});

test("quota and access failures are not all treated as insufficient balance or bad credentials", () => {
  for (const [code, message, kind] of [
    ["insufficient_user_quota", "Not enough workspace balance", "balance"],
    ["insufficient_user_quota", "monthly budget reached for this member", "budget"],
    ["pre_consume_token_quota_failed", "token quota is not enough", "keyQuota"],
    ["", "This token has no access to model example/model", "access"],
    ["free_quota_exhausted", "No free model available", "freeCapacity"],
    ["free_quota_exhausted", "your orcarouter/free allowance is used up", "freeQuota"],
    ["model_not_yet_available", "Not live yet", "model"],
    ["byok:key_unavailable", "Cannot use your key", "byok"]
  ]) assert.equal(readProviderIssue(orcaFailure(403, body(code, message)))?.kind, kind);
  const cycle = readProviderIssue(orcaFailure(403, body("insufficient_user_quota", "token cycle spend limit reached, resets at 2026-09-09 00:00:00 UTC")));
  assert.deepEqual(cycle, { kind: "cycle", retryAt: Date.parse("2026-09-09T00:00:00Z") });
});

test("raw errors, provider URLs and secrets never appear in user-facing messages or error transport", () => {
  const failure = orcaFailure(402, body("insufficient_user_quota", "sk-orca-private", { buy_credits_url: "https://evil.example/pay" }));
  assert.doesNotMatch(failure.message, /sk-orca-private|evil.example/);
  assert.match(agentErrorText("zh_CN", failure), /余额不足/);
  assert.doesNotMatch(agentErrorText("zh_CN", failure), /PROVIDER_|error|metadata/);
  const old = 'PROVIDER_BALANCE: {"error":{"code":"free_quota_exhausted","message":"your orcarouter/free allowance is used up';
  assert.match(agentErrorText("zh_CN", old), /免费用量已耗尽/);
  assert.equal(readProviderIssue("PROVIDER_STREAM_TIMEOUT"), undefined);
});

test("provider actions survive backup round trips without accepting arbitrary URLs or invalid issue metadata", () => {
  const session = makeSession();
  session.entries.push({ id: "error", kind: "notice", text: "Rate limited", status: "failed", providerIssue: { kind: "rate", retryAt: now + 1000 } });
  const json = JSON.parse(serializeSession(session));
  json.entries[0].providerIssue.url = "https://evil.example";
  assert.deepEqual(parseSessionBackup(JSON.stringify(json)).entries[0].providerIssue, { kind: "rate", retryAt: now + 1000 });
  json.entries[0].providerIssue.kind = "evil";
  assert.equal(parseSessionBackup(JSON.stringify(json)).entries[0].providerIssue, undefined);
});

test("rate limits and terminal BYOK failures do not automatically retry model requests", async () => {
  for (const status of [429, 503]) {
    let calls = 0;
    await assert.rejects(complete({ apiKey: "test", model: "test", history: [], tools: [],
      context: { signal: new AbortController().signal, emit: async () => {}, ask: async () => "deny" },
      fetcher: (async () => { calls++; return new Response(body(status === 429 ? "free_rate_limited" : "byok:key_unavailable"), { status, headers: { "Retry-After": "3" } }); }) as typeof fetch
    }), error => {
      const issue = readProviderIssue(error);
      assert.equal(issue?.kind, status === 429 ? "rate" : "byok");
      if (status === 429) assert.ok(issue!.retryAt! > Date.now());
      return true;
    });
    assert.equal(calls, 1);
  }
});

test("streamed quota errors are interpreted and not reported as successful completions", async () => {
  await assert.rejects(complete({ apiKey: "test", model: "test", history: [], tools: [],
    context: { signal: new AbortController().signal, emit: async () => {}, ask: async () => "deny" },
    fetcher: (async () => new Response(`data: ${body("pre_consume_token_quota_failed", "token quota is not enough")}\n\ndata: [DONE]\n\n`)) as typeof fetch
  }), error => { assert.equal(readProviderIssue(error)?.kind, "keyQuota"); return true; });
});
