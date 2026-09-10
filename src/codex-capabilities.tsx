import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Collapse, Empty, Input, Modal, Space, Spin, Switch, Tag, Typography } from "antd";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import type { SupportedLanguage as Language } from "./locales";
import type { AgentConfig, RunContext, UserRequest } from "./agent/protocol";
import { codexRequest } from "./agent/native";
import type { CodexMcp, CodexSkill, CodexThread } from "./agent/codex";
import { codexText } from "./codex-i18n";
import { ElicitationForm } from "./elicitation-form";

export type CodexCapabilityView = "skills" | "mcp" | "threads";
export function CodexCapabilities({ view, active, config, language, disabled, onImport, onSkill }: {
  view: CodexCapabilityView; active: boolean; config: AgentConfig; language: Language; disabled: boolean;
  onImport: (thread: CodexThread) => Promise<void>; onSkill: (skill: CodexSkill) => Promise<void>;
}) {
  const t = (key: Parameters<typeof codexText>[1]) => codexText(language, key);
  const [skills, setSkills] = useState<CodexSkill[]>([]), [mcp, setMcp] = useState<CodexMcp[]>([]), [threads, setThreads] = useState<CodexThread[]>([]);
  const [query, setQuery] = useState(""), [cursor, setCursor] = useState<string | undefined>(), [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [question, setQuestion] = useState<{ request: UserRequest; resolve: (value: string) => void }>();
  const operation = useRef<AbortController>();
  const requested = useRef(false);
  const backgroundRead = useRef(false);
  const task = async (action: (context: RunContext) => Promise<void>, readOnly = false) => {
    operation.current?.abort(); const controller = new AbortController(); operation.current = controller;
    backgroundRead.current = readOnly;
    setBusy(true); setError("");
    const timer = setTimeout(() => {
      if (operation.current === controller) setError(t("requestTimeout"));
      controller.abort();
    }, readOnly ? 45_000 : 6 * 60_000);
    const context: RunContext = { signal: controller.signal, emit: async () => undefined, ask: request => new Promise((resolve, reject) => {
      const cancel = () => { setQuestion(undefined); reject(new Error("RUN_CANCELLED")); };
      controller.signal.addEventListener("abort", cancel, { once: true });
      setQuestion({ request, resolve: value => { controller.signal.removeEventListener("abort", cancel); setQuestion(undefined); resolve(value); } });
    }) };
    try { await action(context); }
    catch (error) { if (!controller.signal.aborted) setError((error as Error).message); }
    finally { clearTimeout(timer); if (operation.current === controller) { setBusy(false); setQuestion(undefined); } controller.abort(); }
  };
  const load = (append = false, forceReload = false) => task(async context => {
    if (view === "skills") {
      const result = await codexRequest(config, { method: "skills/list", params: { cwds: config.workspace ? [config.workspace] : [], forceReload } }, context);
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
  }, true);
  // Tabs retain their state until the dialog closes; the parent keys each
  // catalog by workspace. Unvisited tabs must not start a local process.
  useEffect(() => {
    if (!active || requested.current) return;
    requested.current = true;
    void load();
  }, [active]);
  useEffect(() => {
    // Read-only catalogs may finish in the background. Cancel interactive
    // operations when leaving their tab, as unmounting did previously.
    if (!active && (!backgroundRead.current || question)) operation.current?.abort();
  }, [active, question]);
  useEffect(() => () => { requested.current = false; operation.current?.abort(); }, []);
  const chooseThread = (thread: CodexThread) => task(async context => {
    const result = await codexRequest(config, { method: "thread/read", params: { threadId: thread.id, includeTurns: false } }, context);
    const turns: any[] = []; let next: string | undefined;
    // Cursor pagination also supports modern Codex histories whose metadata
    // deliberately excludes turns. Do not silently truncate imported context.
    do {
      const page = await codexRequest(config, { method: "thread/turns/list", params: { threadId: thread.id, cursor: next, limit: 100, sortDirection: "asc", itemsView: "full" } }, context);
      turns.push(...page.data); next = page.nextCursor;
    } while (next && !context.signal.aborted);
    if (!context.signal.aborted) await onImport({ ...result.thread, turns });
  });
  const filteredSkills = skills.filter(skill => `${skill.name} ${skill.description}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="ws-codex-capabilities" aria-busy={busy}>
    <Space.Compact block><Input aria-label={t("search")} prefix={<SearchOutlined />} value={query} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} onPressEnter={view === "threads" ? () => void load() : undefined} /><Button icon={<ReloadOutlined />} aria-label={t("refresh")} loading={busy} onClick={() => void load(false, true)} /></Space.Compact>
    <div className="ws-catalog-status" role="status">{busy && <><Spin size="small" /><span>{t("loadingCatalog")}</span></>}</div>
    {view === "mcp" && <p className="ws-modal-hint">{t("mcpHint")}</p>}
    {error && <Alert type="error" showIcon message={error} />}
    {view === "skills" && <><p className="ws-modal-hint">{t("skillHint")}</p>{!busy && !error && !filteredSkills.length && <Empty description={t("empty")} image={Empty.PRESENTED_IMAGE_SIMPLE} />}{filteredSkills.map(skill => <article className="ws-codex-card" key={skill.path}><div><strong>{skill.name}</strong><Tag>{skill.scope}</Tag></div><Typography.Paragraph ellipsis={{ rows: 3, expandable: true, symbol: t("more") }}>{skill.description}</Typography.Paragraph><Space wrap><Button disabled={disabled || busy || !skill.enabled} onClick={() => void task(async () => onSkill(skill))}>{t("saveAndUse")}</Button><Switch aria-label={`${t("enabled")}: ${skill.name}`} checked={skill.enabled} disabled={disabled || busy} onChange={enabled => void task(async context => { await codexRequest(config, { method: "skills/config/write", params: { path: skill.path, enabled } }, context); if (!context.signal.aborted) setSkills(items => items.map(item => item.path === skill.path ? { ...item, enabled } : item)); })} /></Space></article>)}</>}
    {view === "mcp" && <>{!busy && !error && !mcp.length && <Empty description={t("empty")} image={Empty.PRESENTED_IMAGE_SIMPLE} />}{mcp.filter(server => server.name.toLowerCase().includes(query.toLowerCase())).map(server => <article key={server.name} className="ws-codex-card"><strong>{server.name}</strong><Tag>{["oAuth", "bearerToken"].includes(server.authStatus) ? t("signedIn") : server.authStatus === "notLoggedIn" ? t("notLoggedIn") : server.authStatus === "unsupported" ? t("unsupported") : server.authStatus}</Tag><p>{t("tools")}: {Object.keys(server.tools ?? {}).length} · {t("resources")}: {server.resources?.length ?? 0}</p><Collapse ghost size="small" items={[{ key: "tools", label: t("tools"), children: <ul>{Object.keys(server.tools ?? {}).map(name => <li key={name}>{name}</li>)}</ul> }]} />{["notLoggedIn", "oAuth"].includes(server.authStatus) && <Button disabled={disabled || busy} onClick={() => void task(async context => { await codexRequest(config, { method: "mcpServer/oauth/login", params: { name: server.name, timeoutSecs: 300 } }, context); if (!context.signal.aborted) setMcp(items => items.map(item => item.name === server.name ? { ...item, authStatus: "oAuth" } : item)); })}>{t("login")}</Button>}</article>)}</>}
    {view === "threads" && <><p className="ws-modal-hint">{t("importHint")}</p>{!busy && !error && !threads.length && <Empty description={t("empty")} image={Empty.PRESENTED_IMAGE_SIMPLE} />}{threads.map(thread => <article key={thread.id} className="ws-codex-card"><strong>{thread.name || thread.preview || thread.id}</strong><small className="ws-path-preview">{thread.cwd}</small><Space wrap><span>{new Date(thread.updatedAt * 1000).toLocaleString(language.replace("_", "-"))}</span><Button disabled={disabled || busy} onClick={() => void chooseThread(thread)}>{t("import")}</Button></Space></article>)}</>}
    {view !== "skills" && cursor && <Button block disabled={disabled || busy} onClick={() => void load(true)}>{t("more")}</Button>}
    <Modal title={question?.request.title} open={active && !!question} onCancel={() => question?.resolve(JSON.stringify({ action: "cancel", content: null }))} footer={null} zIndex={1300} destroyOnHidden>{question && <ElicitationForm key={question.request.id} request={question.request} language={language} resolve={question.resolve} />}</Modal>
  </section>;
}
