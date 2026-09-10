import { useEffect, useRef, useState } from "react";
import { Alert, AutoComplete, Button, Form, InputNumber, Modal, Select, Space, Switch, Tabs } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { translate, type SupportedLanguage } from "./locales";
import { configTransition, requiresBridge, type AgentConfig } from "./agent/protocol";
import { nativeModels } from "./agent/native";
import type { CodexSkill, CodexThread, EngineModel } from "./agent/codex";
import type { RemoteModel } from "./messages";
import { workspaceText, turnLimitText } from "./workspace-i18n";
import { codexText } from "./codex-i18n";
import { ModelPicker, WorkspacePicker } from "./workspace-controls";
import { BridgeSetup } from "./bridge-setup";
import { CodexSettingsFields } from "./codex-settings";
import { CodexCapabilities, type CodexCapabilityView } from "./codex-capabilities";

type ConfigView = "runtime" | CodexCapabilityView;
interface AgentConfigDialogProps {
  open: boolean;
  config: AgentConfig;
  onChange: (config: AgentConfig) => void;
  onClose: () => void;
  onSave: (config: AgentConfig) => Promise<void>;
  onUseSkill: (skill: CodexSkill) => Promise<void>;
  onImport: (thread: CodexThread) => Promise<void>;
  language: SupportedLanguage;
  models: RemoteModel[];
  recentWorkspaces: string[];
  bridgeReady: boolean;
  checkBridge: () => Promise<void>;
  running: boolean;
  hasHistory: boolean;
}

// Owns the dialog UI and catalog requests. Conversation persistence stays in Workspace.
export function AgentConfigDialog({ open, config, onChange, onClose, onSave, onUseSkill, onImport, language, models, recentWorkspaces, bridgeReady, checkBridge, running, hasHistory }: AgentConfigDialogProps) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const s = (key: Parameters<typeof workspaceText>[1]) => workspaceText(language, key);
  const c = (key: Parameters<typeof codexText>[1]) => codexText(language, key);
  const [view, setView] = useState<ConfigView>("runtime");
  const [engineModels, setEngineModels] = useState<EngineModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const modelRequest = useRef<AbortController>();
  const savingRef = useRef(false);
  const hasStepLimit = config.engine === "claude" || config.engine === "builtin" && config.limitToolCalls === true;
  const invalid = hasStepLimit && (!Number.isInteger(config.maxSteps) || config.maxSteps < 1 || config.maxSteps > 100);

  const loadModels = async () => {
    if (config.engine === "builtin" || !bridgeReady) return;
    modelRequest.current?.abort();
    const controller = new AbortController(); modelRequest.current = controller;
    setLoadingModels(true); setModelError(""); setEngineModels([]);
    const timer = setTimeout(() => { if (modelRequest.current === controller) setModelError(s("modelFailure")); controller.abort(); }, 45_000);
    try {
      const result = await nativeModels(config, controller.signal);
      if (!controller.signal.aborted) setEngineModels(result);
    } catch { if (!controller.signal.aborted) setModelError(s("modelFailure")); }
    finally { clearTimeout(timer); if (modelRequest.current === controller) setLoadingModels(false); }
  };
  useEffect(() => { if (open) { setView("runtime"); setError(""); } }, [open]);
  useEffect(() => {
    setEngineModels([]); setModelError("");
    if (open && config.engine === "codex" && bridgeReady) void loadModels();
    return () => modelRequest.current?.abort();
  }, [open, config.engine, config.workspace, bridgeReady]);

  const finish = async (action: () => Promise<void>) => {
    if (savingRef.current || running || invalid) return;
    savingRef.current = true; setSaving(true); setError("");
    try { await action(); onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const runtimeFields = <Form layout="vertical" component={false} disabled={saving || running}>
        <Form.Item label={t("model")}>{config.engine === "builtin" ? <ModelPicker models={models} value={config.model} onChange={value => onChange({ ...config, model: value })} s={s} freeLabel={t("freeModels")} paidLabel={t("paidModels")} label={t("model")} /> : <Space.Compact block><AutoComplete aria-label={t("model")} placeholder={s("defaultModel")} value={config.model} options={engineModels.map(model => ({ value: model.id, label: model.name }))} filterOption={(input, option) => String(option?.value).toLowerCase().includes(input.toLowerCase())} onChange={value => onChange({ ...config, model: value, codex: config.codex ? { ...config.codex, effort: undefined, serviceTier: undefined } : undefined })} /><Button disabled={!bridgeReady} loading={loadingModels} aria-label={s("loadingModels")} icon={<ReloadOutlined />} onClick={() => void loadModels()} /></Space.Compact>}</Form.Item>
        {config.engine === "builtin" && <Form.Item label={s("localTools")} htmlFor="local-tools-toggle" extra={s("localToolsHint")}><Switch id="local-tools-toggle" aria-label={s("localTools")} checked={requiresBridge(config)} onChange={checked => onChange(configTransition(config, { ...config, location: checked ? "local" : "remote" }))} /></Form.Item>}
        {requiresBridge(config) && <Form.Item label={s("workspace")}><WorkspacePicker value={config.workspace} recent={recentWorkspaces} available={bridgeReady} disabled={saving || running} onChange={async path => onChange({ ...config, workspace: path })} s={s} /><small className="ws-path-preview">{config.workspace}</small></Form.Item>}
        {config.engine === "codex" && <CodexSettingsFields config={config} onChange={onChange} models={engineModels} language={language} />}
        {config.engine === "builtin" && <Form.Item label={s("limitToolCalls")} htmlFor="tool-limit-toggle" extra={<span id="tool-limit-help">{s("toolLimitHint")}</span>}><Space><Switch id="tool-limit-toggle" aria-label={s("limitToolCalls")} aria-describedby="tool-limit-help" checked={config.limitToolCalls === true} onChange={checked => onChange({ ...config, limitToolCalls: checked })} /><span>{s(config.limitToolCalls ? "limited" : "unlimited")}</span></Space></Form.Item>}
        {(config.engine === "claude" || config.engine === "builtin" && config.limitToolCalls === true) && <Form.Item label={config.engine === "claude" ? turnLimitText(language) : s("steps")} htmlFor="agent-step-limit"><InputNumber id="agent-step-limit" aria-label={config.engine === "claude" ? turnLimitText(language) : s("steps")} min={1} max={100} precision={0} value={config.maxSteps} onChange={value => onChange({ ...config, maxSteps: value ?? 24 })} /></Form.Item>}
      <p className="ws-modal-hint">{s(requiresBridge(config) ? "localNotice" : "browserNotice")}</p>
      {hasHistory && <p className="ws-modal-hint">{s("branchNotice")}</p>}
    </Form>;
  const runtime = config.engine !== "codex" || view === "runtime";
  return <Modal title={config.engine === "codex" ? "Codex" : t("switchModel")} centered open={open}
    onCancel={() => { if (!savingRef.current) onClose(); }}
    onOk={() => void finish(() => onSave(config))} confirmLoading={saving}
    okText={s("save")} cancelText={s("cancel")} okButtonProps={{ disabled: running || invalid }} cancelButtonProps={{ disabled: saving }}
    footer={runtime ? undefined : <Button disabled={saving} onClick={onClose}>{t("close")}</Button>}
    width={config.engine === "codex" ? 560 : 440} className={`ws-modal ws-agent-config${config.engine === "codex" ? " ws-agent-config-codex" : ""}`} destroyOnHidden>
    <Form layout="vertical" component={false}>
      <Form.Item label={s("engine")} htmlFor="agent-engine"><Select id="agent-engine" aria-label={s("engine")} value={config.engine} disabled={saving || running}
        options={[{ value: "builtin", label: `${s("builtin")} · OrcaRouter` }, { value: "codex", label: "Codex" }, { value: "claude", label: "Claude Code" }]}
        onChange={value => { setView("runtime"); setError(""); onChange(configTransition(config, { ...config, engine: value, location: value === "builtin" ? "remote" : "local", model: value === "builtin" ? "orcarouter/free" : "" })); }} />
      </Form.Item>
    </Form>
    {error && <Alert className="ws-config-error" type="error" showIcon message={error} />}
    {config.engine === "codex" ? <Tabs className="ws-codex-tabs" activeKey={view} onChange={key => setView(key as ConfigView)} animated={false} items={[
      { key: "runtime", label: c("runtimeTab"), disabled: saving, children: runtimeFields },
      ...(["skills", "mcp", "threads"] as CodexCapabilityView[]).map(key => ({
        key, label: c(key === "skills" ? "skillsTab" : key === "threads" ? "historyTab" : "mcpTab"), disabled: saving,
        children: bridgeReady ? <>
          <p className="ws-capability-workspace">{s("workspace")}: <span>{config.workspace || s("defaultWorkspace")}</span></p>
          <CodexCapabilities key={`${key}:${config.workspace}`} view={key} active={open && view === key} config={config} language={language} disabled={saving || running}
            onSkill={skill => finish(() => onUseSkill(skill))} onImport={thread => finish(() => onImport(thread))} />
        </> : null
      }))
    ]} /> : runtimeFields}
    {runtime && modelError && <Alert className="ws-config-error" type="warning" showIcon message={modelError} />}
    {requiresBridge(config) && !bridgeReady && <Alert type="info" showIcon message={s("bridgeRequired")} description={<BridgeSetup s={s} language={language} onCheck={checkBridge} />} />}
  </Modal>;
}
