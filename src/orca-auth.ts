export function validateOrcaKey(value: unknown): string {
  if (typeof value !== "string" || !/^sk-orca-[A-Za-z0-9_-]+$/.test(value.trim()) || value.length > 1024) throw new Error("AUTH_KEY_INVALID");
  return value.trim();
}

export function parseOrcaCallback(redirect: string, expected: string, state: string): string {
  const callback = new URL(redirect); const target = new URL(expected);
  if (callback.origin !== target.origin || callback.pathname !== target.pathname || callback.hash || callback.username || callback.password) throw new Error("AUTH_CALLBACK_INVALID");
  if (callback.searchParams.get("state") !== state) throw new Error("AUTH_STATE_INVALID");
  if (callback.searchParams.has("error")) throw new Error(`AUTH_DECLINED:${callback.searchParams.get("error")}`);
  const code = callback.searchParams.get("code");
  if (!code) throw new Error("AUTH_CODE_MISSING");
  return code;
}

export function orcaKeyFromExchange(payload: { key?: unknown; scope?: unknown } | null): string {
  if (payload?.scope !== undefined && payload.scope !== "api") throw new Error("AUTH_SCOPE_INVALID");
  return validateOrcaKey(payload?.key);
}
