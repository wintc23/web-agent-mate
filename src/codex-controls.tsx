import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Collapse, Empty, Form, Input, InputNumber, Modal, Select, Space, Switch, Tabs, Tag, Typography } from "antd";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import type { SupportedLanguage as Language } from "./locales";
import type { AgentConfig, RunContext, UserRequest } from "./agent/protocol";
import { codexRequest } from "./agent/native";
import { safeExternalUrl, validateElicitation, type CodexMcp, type CodexSkill, type CodexThread, type EngineModel } from "./agent/codex";
import { codexText } from "./codex-i18n";

export function CodexSettingsFields({ config, onChange, models, language }: { config: AgentConfig; onChange: (config: AgentConfig) => void; models: EngineModel[]; language: Language }) {
  const t = (key: Parameters<typeof codexText>[1]) => codexText(language, key);
  const c = config.codex ?? {};
  const model = models.find(model => config.model ? model.id === config.model : model.isDefault);
  const change = (key: keyof NonNullable<AgentConfig["codex"]>, value: string) => onChange({ ...config, codex: { ...c, [key]: value || undefined } });
  const inherit = { value: "", label: t("inherit") };
  return <>
    <Form.Item label={t("effort")}><Select aria-label={t("effort")} value={c.effort ?? ""} options={[inherit, ...(model?.supportedReasoningEfforts ?? (c.effort ? [{ reasoningEffort: c.effort, description: "" }] : [])).map(option => ({ value: option.reasoningEffort, label: option.reasoningEffort, title: option.description }))]} onChange={value => change("effort", value)} /></Form.Item>
    <Form.Item label={t("mode")}><Select aria-label={t("mode")} value={c.mode ?? ""} options={[inherit, { value: "default", label: t("defaultMode") }, { value: "plan", label: t("planMode") }]} onChange={value => change("mode", value)} /></Form.Item>
    <Form.Item label={t("sandbox")}><Select aria-label={t("sandbox")} value={c.sandbox ?? ""} options={[inherit, { value: "read-only", label: t("readOnly") }, { value: "workspace-write", label: t("workspaceWrite") }, { value: "danger-full-access", label: t("fullAccess") }]} onChange={value => change("sandbox", value)} /></Form.Item>
    {c.sandbox === "danger-full-access" && <Alert type="warning" showIcon message={t("fullAccessHint")} />}
    <Form.Item label={t("approval")}><Select aria-label={t("approval")} value={c.approvalPolicy ?? ""} options={[inherit, { value: "untrusted", label: t("untrusted") }, { value: "on-request", label: t("onRequest") }, { value: "never", label: t("never") }]} onChange={value => change("approvalPolicy", value)} /></Form.Item>
    <Form.Item label={t("serviceTier")}><Select aria-label={t("serviceTier")} value={c.serviceTier ?? ""} options={[inherit, ...(model?.serviceTiers ?? (c.serviceTier ? [{ id: c.serviceTier }] : [])).map(tier => ({ value: tier.id, label: tier.name ?? tier.id, title: tier.description }))]} onChange={value => change("serviceTier", value)} /></Form.Item>
    <p className="ws-modal-hint">{t("settingsHint")}</p>
  </>;
}

export function ElicitationForm({ request, language, resolve }: { request: UserRequest; language: Language; resolve: (value: string) => void }) {
  const t = (key: Parameters<typeof codexText>[1]) => codexText(language, key);
  const [error, setError] = useState("");
  const schema = request.schema;
  const fields = Object.entries<any>(schema?.properties ?? {});
  const url = request.url && safeExternalUrl(request.url);
  const advanced = !request.url && (!schema || schema.type !== "object" || fields.some(([, field]) => !["string", "number", "integer", "boolean", "array"].includes(field.type)));
  const submit = (values: unknown) => {
    try { const content = request.url ? null : validateElicitation(schema!, values); resolve(JSON.stringify({ action: "accept", content })); }
    catch (error) { setError((error as Error).message); }
  };
  return <Form layout="vertical" onFinish={submit} initialValues={Object.fromEntries(fields.filter(([, field]) => field.default !== undefined).map(([key, field]) => [key, field.default]))}>
    {request.url ? <Space direction="vertical"><Button href={url || undefined} target="_blank" rel="noopener noreferrer" disabled={!url}>{t("openUrl")}</Button><small className="ws-path-preview">{url || request.url}</small></Space> : advanced ? <Alert type="info" message={t("formUnsupported")} /> : fields.map(([key, field]) => {
      const enumField = field.type === "array" ? field.items : field;
      const options = (enumField?.oneOf ?? enumField?.anyOf)?.map((item: any) => ({ value: item.const, label: item.title ?? String(item.const) })) ?? enumField?.enum?.map((value: any, i: number) => ({ value, label: enumField.enumNames?.[i] ?? String(value) }));
      return <Form.Item key={key} name={key} label={field.title || key} help={field.description} required={schema?.required?.includes(key)}>
        {options ? <Select aria-label={field.title || key} allowClear mode={field.type === "array" ? "multiple" : undefined} options={options} /> : field.type === "boolean" ? <Select aria-label={field.title || key} allowClear options={[{ value: true, label: t("yes") }, { value: false, label: t("no") }]} /> : ["number", "integer"].includes(field.type) ? <InputNumber aria-label={field.title || key} min={field.minimum} max={field.maximum} precision={field.type === "integer" ? 0 : undefined} /> : <Input aria-label={field.title || key} maxLength={field.maxLength} />}
      </Form.Item>;
    })}
    {error && <Alert type="error" showIcon message={error} />}
    <Space wrap className="ws-codex-form-actions"><Button type="primary" htmlType="submit" disabled={advanced || (!!request.url && !url)}>{t(request.url ? "loginDone" : "submit")}</Button><Button onClick={() => resolve(JSON.stringify({ action: "decline", content: null }))}>{t("decline")}</Button><Button onClick={() => resolve(JSON.stringify({ action: "cancel", content: null }))}>{t("cancel")}</Button></Space>
  </Form>;
}

type View = "skills" | "mcp" | "threads";
export function CodexManager({ open, onClose, config, language, onImport, onSkill }: { open: boolean; onClose: () => void; config: AgentConfig; language: Language; onImport: (thread: CodexThread) => Promise<void>; onSkill: (skill: CodexSkill) => void }) {
  const t = (key: Parameters<typeof codexText>[1]) => codexText(language, key);
  const [view, setView] = useState<View>("skills");
  const [skills, setSkills] = useState<CodexSkill[]>([]), [mcp, setMcp] = useState<CodexMcp[]>([]), [threads, setThreads] = useState<CodexThread[]>([]);
  const [query, setQuery] = useState(""), [cursor, setCursor] = useState<string | undefined>(), [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState<{ request: UserRequest; resolve: (value: string) => void }>();
  const operation = useRef<AbortController>();
  const task = async (action: (context: RunContext) => Promise<void>) => {
    operation.current?.abort(); const controller = new AbortController(); operation.current = controller;
    setBusy(true); setError("");
    const timer = setTimeout(() => controller.abort(), 6 * 60_000);
    const context: RunContext = { signal: controller.signal, emit: async () => undefined, ask: request => new Promise((resolve, reject) => {
      const cancel = () => { setQuestion(undefined); reject(new Error("RUN_CANCELLED")); };
      controller.signal.addEventListener("abort", cancel, { once: true });
      setQuestion({ request, resolve: value => { controller.signal.removeEventListener("abort", cancel); setQuestion(undefined); resolve(value); } });
    }) };
    try { await action(context); }
    catch (error) { if (!controller.signal.aborted) setError((error as Error).message); }
    finally { clearTimeout(timer); if (operation.current === controller) { setBusy(false); setQuestion(undefined); } controller.abort(); }
  };
  const load = (append = false) => task(async context => {
    if (view === "skills") {
      const result = await codexRequest(config, { method: "skills/list", params: { cwds: config.workspace ? [config.workspace] : [], forceReload: true } }, context);
      if (context.signal.aborted) return;
      setSkills(result.data.flatMap((item: any) => item.skills));
      setError(result.data.flatMap((item: any) => item.errors ?? []).map((error: any) => `${error.path}: ${error.message}`).join("\n"));
    } else if (view === "mcp") {
      const result = await codexRequest(config, { method: "mcpServerStatus/list", params: { cursor: append ? cursor : undefined, limit: 50 } }, context);
      if (context.signal.aborted) return;
      setMcp(items => append ? [...items, ...result.data] : result.data); setCursor(result.nextCursor);
    } else {
      const result = await codexRequest(config, { method: "thread/list", params: { cursor: append ? cursor : undefined, limit: 30, sortKey: "updated_at", modelProviders: [], searchTerm: query || undefined } }, context);
      if (context.signal.aborted) return;
      setThreads(items => append ? [...items, ...result.data] : result.data); setCursor(result.nextCursor);
    }
  });
  useEffect(() => { if (open) { setCursor(undefined); void load(); } return () => operation.current?.abort(); }, [open, view, config.workspace]);
  const chooseThread = (thread: CodexThread) => task(async context => {
    const result = await codexRequest(config, { method: "thread/read", params: { threadId: thread.id, includeTurns: false } }, context);
    const turns: any[] = []; let next: string | undefined;
    // Cursor pagination also supports modern Codex histories whose metadata
    // deliberately excludes turns. Do not silently truncate imported context.
    do {
      const page = await codexRequest(config, { method: "thread/turns/list", params: { threadId: thread.id, cursor: next, limit: 100, sortDirection: "asc", itemsView: "full" } }, context);
      turns.push(...page.data); next = page.nextCursor;
    } while (next && !context.signal.aborted);
    if (!context.signal.aborted) { await onImport({ ...result.thread, turns }); onClose(); }
  });
  const filteredSkills = skills.filter(skill => `${skill.name} ${skill.description}`.toLowerCase().includes(query.toLowerCase()));
  return <Modal title={t("capabilities")} centered open={open} onCancel={onClose} footer={null} width={560} className="ws-modal ws-codex-manager" zIndex={1200} destroyOnHidden>
    <Tabs activeKey={view} items={(["skills", "mcp", "threads"] as View[]).map(key => ({ key, label: t(key) }))} onChange={value => { setQuery(""); setView(value as View); }} />
    <Space.Compact block><Input aria-label={t("search")} prefix={<SearchOutlined />} value={query} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} onPressEnter={() => void load()} /><Button icon={<ReloadOutlined />} aria-label={t("refresh")} loading={busy} onClick={() => void load()} /></Space.Compact>
    {error && <Alert type="error" showIcon message={error} />}
    {view === "skills" && <><p className="ws-modal-hint">{t("skillHint")}</p>{!busy && !filteredSkills.length && <Empty description={t("empty")} image={Empty.PRESENTED_IMAGE_SIMPLE} />}{filteredSkills.map(skill => <article className="ws-codex-card" key={skill.path}><div><strong>{skill.name}</strong><Tag>{skill.scope}</Tag></div><Typography.Paragraph ellipsis={{ rows: 3, expandable: true, symbol: t("more") }}>{skill.description}</Typography.Paragraph><Space wrap><Button disabled={busy || !skill.enabled} onClick={() => { onSkill(skill); onClose(); }}>{t("insert")}</Button><Switch aria-label={`${t("enabled")}: ${skill.name}`} checked={skill.enabled} disabled={busy} onChange={enabled => void task(async context => { await codexRequest(config, { method: "skills/config/write", params: { path: skill.path, enabled } }, context); if (!context.signal.aborted) setSkills(items => items.map(item => item.path === skill.path ? { ...item, enabled } : item)); })} /></Space></article>)}</>}
    {view === "mcp" && <>{!busy && !mcp.length && <Empty description={t("empty")} image={Empty.PRESENTED_IMAGE_SIMPLE} />}{mcp.filter(server => server.name.toLowerCase().includes(query.toLowerCase())).map(server => <article key={server.name} className="ws-codex-card"><strong>{server.name}</strong><Tag>{["oAuth", "bearerToken"].includes(server.authStatus) ? t("signedIn") : server.authStatus === "notLoggedIn" ? t("notLoggedIn") : server.authStatus === "unsupported" ? t("unsupported") : server.authStatus}</Tag><p>{t("tools")}: {Object.keys(server.tools ?? {}).length} · {t("resources")}: {server.resources?.length ?? 0}</p><Collapse ghost size="small" items={[{ key: "tools", label: t("tools"), children: <ul>{Object.keys(server.tools ?? {}).map(name => <li key={name}>{name}</li>)}</ul> }]} />{["notLoggedIn", "oAuth"].includes(server.authStatus) && <Button disabled={busy} onClick={() => void task(async context => { await codexRequest(config, { method: "mcpServer/oauth/login", params: { name: server.name, timeoutSecs: 300 } }, context); if (!context.signal.aborted) setMcp(items => items.map(item => item.name === server.name ? { ...item, authStatus: "oAuth" } : item)); })}>{t("login")}</Button>}</article>)}</>}
    {view === "threads" && <><p className="ws-modal-hint">{t("importHint")}</p>{!busy && !threads.length && <Empty description={t("empty")} image={Empty.PRESENTED_IMAGE_SIMPLE} />}{threads.map(thread => <article key={thread.id} className="ws-codex-card"><strong>{thread.name || thread.preview || thread.id}</strong><small className="ws-path-preview">{thread.cwd}</small><Space wrap><span>{new Date(thread.updatedAt * 1000).toLocaleString(language.replace("_", "-"))}</span><Button disabled={busy} onClick={() => void chooseThread(thread)}>{t("import")}</Button></Space></article>)}</>}
    {view !== "skills" && cursor && <Button block disabled={busy} onClick={() => void load(true)}>{t("more")}</Button>}
    <Modal title={question?.request.title} open={!!question} onCancel={() => question?.resolve(JSON.stringify({ action: "cancel", content: null }))} footer={null} zIndex={1300} destroyOnHidden>{question && <ElicitationForm key={question.request.id} request={question.request} language={language} resolve={question.resolve} />}</Modal>
  </Modal>;
}
