export const PROVIDER_ISSUE_KINDS = ["rate", "freeLimit", "freePrompt", "freeCapacity", "freeQuota", "balance", "keyQuota", "budget", "cycle", "access", "auth", "model", "unavailable", "request", "policy", "byok"] as const;
export type ProviderIssueKind = typeof PROVIDER_ISSUE_KINDS[number];
export interface ProviderIssue { kind: ProviderIssueKind; retryAt?: number }

export function validateProviderIssue(value: unknown): ProviderIssue | undefined {
  if (!value || typeof value !== "object") return;
  const issue = value as ProviderIssue;
  if (!PROVIDER_ISSUE_KINDS.includes(issue.kind)) return;
  return { kind: issue.kind, ...(typeof issue.retryAt === "number" && Number.isFinite(issue.retryAt) && issue.retryAt >= 0 && issue.retryAt <= 8.64e15 ? { retryAt: issue.retryAt } : {}) };
}

function retryTime(value: string | null | undefined, now: number): number | undefined {
  if (!value?.trim()) return;
  const seconds = /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : NaN;
  const time = Number.isFinite(seconds) ? now + seconds * 1000 : Date.parse(value);
  return Number.isFinite(time) && time >= 0 && time <= 8.64e15 ? Math.max(now, time) : undefined;
}

function classify(status: number, body: string, retryAfter?: string | null, now = Date.now()): ProviderIssue {
  let payload: any;
  try { payload = JSON.parse(body); } catch { /* Old stored errors may contain truncated JSON. */ }
  const error = payload?.error ?? payload;
  const detail = `${error?.code ?? ""} ${error?.message ?? body}`;
  const retryAt = retryTime(retryAfter, now);
  if (/token cycle spend limit reached|周期.*(?:额度|限额)|週期.*(?:額度|限額)/i.test(detail)) {
    const reset = detail.match(/resets at\s+(\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|\s*UTC|[+-]\d\d:\d\d)?)/i)?.[1];
    const date = reset?.trim().replace(/ UTC$/i, "Z").replace(" ", "T");
    const time = date ? Date.parse(/[Zz]|[+-]\d\d:\d\d$/.test(date) ? date : `${date}Z`) : NaN;
    return { kind: "cycle", ...(Number.isFinite(time) ? { retryAt: time } : {}) };
  }
  if (/monthly budget reached|(?:member|agent).*budget|(?:成员|智能体|成員).*预算/i.test(detail)) return { kind: "budget" };
  if (/pre_consume_token_quota_failed|token quota is not enough/i.test(detail)) return { kind: "keyQuota" };
  if (/free_quota_exhausted|err_free_used/i.test(detail)) return { kind: /allowance.*used up|额度.*用[尽完]|額度.*用[盡完]/i.test(detail) ? "freeQuota" : "freeCapacity" };
  // Free-tier 429 without Retry-After is a per-request prompt cap, not a timer.
  // A legacy/stream error has no reliable header information; don't guess there.
  if (/free_rate_limited/i.test(detail) && status === 429 && retryAfter === null) return { kind: "freePrompt" };
  if (/free_rate_limited/i.test(detail) && retryAfter === undefined) return { kind: "freeLimit" };
  if (status === 429 || /free_rate_limited|rate_limit|too many requests/i.test(detail)) return { kind: "rate", ...(retryAt === undefined ? {} : { retryAt }) };
  if (/insufficient_user_quota|insufficient.*(?:credit|balance)|payment required/i.test(detail) || status === 402) return { kind: "balance" };
  if (/no access to model|access_denied|IP.*(?:allowlist|whitelist)/i.test(detail)) return { kind: "access" };
  if (/byok:key_unavailable/i.test(detail)) return { kind: "byok" };
  if (/model_not_found|model_not_yet_available|model.*unavailable/i.test(detail) || status === 404 || status === 425) return { kind: "model" };
  if (/guardrail_blocked|firewall_|prompt_blocked|sensitive_words_detected/i.test(detail)) return { kind: "policy" };
  if (status === 401 || /invalid.*(?:key|token)|authentication|unauthorized/i.test(detail)) return { kind: "auth" };
  if (status === 403) return { kind: "access" };
  return { kind: status === 400 ? "request" : "unavailable" };
}

// Encode only actionable metadata across Native Messaging, never raw provider
// responses or provider-supplied URLs. The UI and persisted notices stay readable.
export function orcaFailure(status: number, body: string, retryAfter?: string | null, now = Date.now()): Error {
  const issue = classify(status, body, retryAfter, now);
  const prefix = status === 401 || status === 403 ? "PROVIDER_AUTH" : status === 402 ? "PROVIDER_BALANCE" : status === 429 ? "PROVIDER_RATE_LIMIT" : status === 400 ? "PROVIDER_REQUEST" : "PROVIDER_ERROR";
  return new Error(`${prefix}: ${JSON.stringify({ provider: "orcarouter", ...issue })}`);
}

export function readProviderIssue(value: unknown): ProviderIssue | undefined {
  const detail = value instanceof Error ? value.message : String(value);
  const prefix = detail.match(/PROVIDER_(AUTH|BALANCE|RATE_LIMIT|REQUEST|ERROR|FREE_UNAVAILABLE|FREE_PROMPT_LIMIT)\b:?\s*/);
  if (!prefix || prefix.index === undefined) return;
  const body = detail.slice(prefix.index + prefix[0].length);
  try {
    const data = JSON.parse(body);
    if (data?.provider === "orcarouter") return validateProviderIssue(data);
  } catch { /* Fall back to old persisted and older Bridge errors. */ }
  const status = { AUTH: 401, BALANCE: 402, RATE_LIMIT: 429, REQUEST: 400, ERROR: 0, FREE_UNAVAILABLE: 403, FREE_PROMPT_LIMIT: 429 }[prefix[1]] ?? 0;
  if (prefix[1] === "FREE_PROMPT_LIMIT") return { kind: "freePrompt" };
  return classify(status, body);
}
