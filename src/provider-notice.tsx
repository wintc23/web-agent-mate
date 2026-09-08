import { useEffect, useState } from "react";
import { Alert, Button, Space } from "antd";
import type { SupportedLanguage } from "./locales";
import type { ProviderIssue } from "./agent/provider-error";
import { providerControl, providerReason } from "./provider-error-i18n";

export function ProviderNotice({ issue, language, actionable, onRetry, onModel, onConnection, onShorter }: {
  issue: ProviderIssue; language: SupportedLanguage; actionable: boolean;
  onRetry: () => void; onModel: () => void; onConnection: () => void; onShorter: () => void;
}) {
  const [now, setNow] = useState(Date.now);
  const remaining = Math.max(0, Math.ceil(((issue.retryAt ?? 0) - now) / 1000));
  useEffect(() => {
    setNow(Date.now());
    if (!actionable || !issue.retryAt || issue.retryAt <= Date.now()) return;
    const timer = setInterval(() => { const time = Date.now(); setNow(time); if (time >= issue.retryAt!) clearInterval(timer); }, 1000);
    return () => clearInterval(timer);
  }, [issue.retryAt, actionable]);
  const t = (key: Parameters<typeof providerControl>[1]) => providerControl(language, key);
  const retryable = ["rate", "unavailable", "cycle"].includes(issue.kind);
  const account = ["keyQuota", "budget", "cycle", "access", "freeQuota", "byok", "policy"].includes(issue.kind);
  return <Alert className="ws-provider-error" type="warning" showIcon message={t("title")} description={<>
    <p>{providerReason(language, issue.kind)}</p>
    {issue.retryAt !== undefined ? <p>{t("reset").replace("{time}", new Date(issue.retryAt).toLocaleString(language.replace("_", "-")))}</p> : issue.kind === "rate" || issue.kind === "cycle" ? <p>{t("unknown")}</p> : null}
    <p>{t("saved")}</p>
    {actionable && <Space wrap>
      {retryable && <Button type="primary" disabled={remaining > 0} onClick={() => { if (!issue.retryAt || Date.now() >= issue.retryAt) onRetry(); }}>{remaining > 0 ? t("wait").replace("{seconds}", String(remaining)) : t("retry")}</Button>}
      <Button onClick={onModel}>{t("model")}</Button>
      {issue.kind === "auth" && <Button type="primary" onClick={onConnection}>{t("connection")}</Button>}
      {issue.kind === "freePrompt" && <Button type="primary" onClick={onShorter}>{t("shorter")}</Button>}
      {account && <Button href="https://www.orcarouter.ai/console" target="_blank" rel="noopener noreferrer">{t("account")}</Button>}
      {issue.kind === "balance" && <Button href="https://www.orcarouter.ai/console/billing" target="_blank" rel="noopener noreferrer">{t("billing")}</Button>}
      {["freeLimit", "freeCapacity", "freeQuota", "freePrompt"].includes(issue.kind) && <Button href="https://docs.orcarouter.ai/routing/free-models" target="_blank" rel="noopener noreferrer">{t("limits")}</Button>}
    </Space>}
  </>} />;
}
