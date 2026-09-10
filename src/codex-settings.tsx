import { Alert, Form, Select } from "antd";
import type { SupportedLanguage as Language } from "./locales";
import type { AgentConfig } from "./agent/protocol";
import type { EngineModel } from "./agent/codex";
import { codexText } from "./codex-i18n";

export function CodexSettingsFields({ config, onChange, models, language }: { config: AgentConfig; onChange: (config: AgentConfig) => void; models: EngineModel[]; language: Language }) {
  const t = (key: Parameters<typeof codexText>[1]) => codexText(language, key);
  const c = config.codex ?? {};
  const model = models.find(model => config.model ? model.id === config.model : model.isDefault);
  const change = (key: keyof NonNullable<AgentConfig["codex"]>, value: string) => onChange({ ...config, codex: { ...c, [key]: value || undefined } });
  const inherit = { value: "", label: t("inherit") };
  return <>
    <fieldset className="ws-config-group"><legend>{t("runtimeOptions")}</legend>
    <Form.Item label={t("effort")}><Select aria-label={t("effort")} value={c.effort ?? ""} options={[inherit, ...(model?.supportedReasoningEfforts ?? (c.effort ? [{ reasoningEffort: c.effort, description: "" }] : [])).map(option => ({ value: option.reasoningEffort, label: option.reasoningEffort, title: option.description }))]} onChange={value => change("effort", value)} /></Form.Item>
    <Form.Item label={t("mode")}><Select aria-label={t("mode")} value={c.mode ?? ""} options={[inherit, { value: "default", label: t("defaultMode") }, { value: "plan", label: t("planMode") }]} onChange={value => change("mode", value)} /></Form.Item>
    <Form.Item label={t("serviceTier")}><Select aria-label={t("serviceTier")} value={c.serviceTier ?? ""} options={[inherit, ...(model?.serviceTiers ?? (c.serviceTier ? [{ id: c.serviceTier }] : [])).map(tier => ({ value: tier.id, label: tier.name ?? tier.id, title: tier.description }))]} onChange={value => change("serviceTier", value)} /></Form.Item>
    </fieldset>
    <fieldset className="ws-config-group"><legend>{t("accessOptions")}</legend>
    <Form.Item label={t("sandbox")}><Select aria-label={t("sandbox")} value={c.sandbox ?? ""} options={[inherit, { value: "read-only", label: t("readOnly") }, { value: "workspace-write", label: t("workspaceWrite") }, { value: "danger-full-access", label: t("fullAccess") }]} onChange={value => change("sandbox", value)} /></Form.Item>
    {c.sandbox === "danger-full-access" && <Alert type="warning" showIcon message={t("fullAccessHint")} />}
    <Form.Item label={t("approval")}><Select aria-label={t("approval")} value={c.approvalPolicy ?? ""} options={[inherit, { value: "untrusted", label: t("untrusted") }, { value: "on-request", label: t("onRequest") }, { value: "never", label: t("never") }]} onChange={value => change("approvalPolicy", value)} /></Form.Item>
    </fieldset>
    <p className="ws-modal-hint">{t("settingsHint")}</p>
  </>;
}
