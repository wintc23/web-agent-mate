import { useRef, useState } from "react";
import { Alert, Avatar, Button, Cascader, Empty, Input, List, Modal, Popover, Segmented, Space, Tag, Typography } from "antd";
import { ArrowUpOutlined, CheckOutlined, CloudOutlined, CodeOutlined, FolderOpenOutlined, FolderOutlined, KeyOutlined, LinkOutlined, ReloadOutlined, RobotOutlined } from "@ant-design/icons";
import type { AgentConfig } from "./agent/protocol";
import type { AgentAdapter, AuthStatus, RemoteModel, WorkspaceDirectory } from "./messages";
import type { SupportedLanguage } from "./locales";
import { workspaceText } from "./workspace-i18n";
import { readProviderIssue } from "./agent/provider-error";
import { providerReason } from "./provider-error-i18n";
import { modelOptions, modelProvider } from "./agent/model-options";
import { directoryErrorKey, listWorkspaceDirectory } from "./agent/workspace-directory";

type Text = (key: Parameters<typeof workspaceText>[1]) => string;

export function AgentAvatar({ engine = "builtin", size = 28 }: { engine?: AgentConfig["engine"]; size?: number }) {
  const label = engine === "codex" ? "Codex" : engine === "claude" ? "Claude" : "WebAgentMate";
  return <Avatar className={`ws-agent-avatar ws-avatar-${engine}`} size={size} shape="square" aria-label={`${label} Agent`} icon={engine === "builtin" ? <RobotOutlined /> : <CodeOutlined />} />;
}

export function ModelPicker({ models, value, onChange, s, freeLabel, paidLabel, label }: { models: RemoteModel[]; value: string; onChange: (value: string) => void; s: Text; freeLabel: string; paidLabel: string; label: string }) {
  return <Cascader aria-label={label} className="ws-model-picker" classNames={{ popup: { root: "ws-model-cascade" } }}
    options={modelOptions(models, value)} value={value ? [modelProvider(value), value] : []} allowClear={false}
    placeholder={s("modelSearch")} showSearch={{ filter: (input, path) => path.some(option => `${option.label} ${option.value}`.toLowerCase().includes(input.toLowerCase())), limit: 60 }}
    displayRender={labels => labels.at(-1)} onChange={path => { if (path.length === 2) onChange(String(path[1])); }}
    optionRender={option => <span className="ws-model-option"><span>{option.label}</span>{option.model && <small className={option.model.free ? "ws-free" : ""}>{option.model.free ? freeLabel : option.model.promptPricePerMillion === undefined ? paidLabel : `$${option.model.promptPricePerMillion}/1M`}</small>}</span>} />;
}

export function ConnectionPanel({ auth, adapters, busy, onAction, s, labels }: {
  auth?: AuthStatus; adapters: AgentAdapter[]; busy: boolean; onAction: (type: "auth:connect" | "auth:key" | "auth:disconnect" | "auth:verify", key?: string) => Promise<boolean>; s: Text;
  labels: { connect: string; verify: string; disconnect: string; connected: string; notConnected: string; ready: string; unavailable: string };
}) {
  const [method, setMethod] = useState("login"); const [key, setKey] = useState("");
  return <div className="ws-connections">
    <section className="ws-connection-section">
      <div className="ws-connection-heading"><Avatar size={38} shape="square" className="ws-local-avatar" icon={<CodeOutlined />} /><div><strong>{s("node")}</strong><p>{s("localConnectionHint")}</p></div><Tag bordered={false} color={auth?.runtimeV2 ? "success" : "default"}>{auth?.runtimeV2 ? labels.ready : labels.unavailable}</Tag></div>
      {!auth?.runtimeV2 && <Alert type="info" showIcon message={s("bridgeRequired")} />}
      <div className="ws-adapters">{adapters.filter(adapter => ["codex", "claude"].includes(adapter.id)).map(adapter => <div key={adapter.id}><Space><AgentAvatar engine={adapter.id as "codex" | "claude"} size={24} /><span>{adapter.name}</span></Space><Tag bordered={false} color={adapter.available ? "success" : "default"}>{adapter.available ? labels.ready : labels.unavailable}</Tag></div>)}</div>
    </section>
    <section className="ws-connection-section">
      <div className="ws-connection-heading"><Avatar shape="square" size={38} className="ws-orca-avatar" icon={<CloudOutlined />} /><div><strong>OrcaRouter</strong><p>{s("connectionHint")}</p></div><Tag bordered={false} color={auth?.connected ? "success" : "default"}>{auth?.connected ? labels.connected : labels.notConnected}</Tag></div>
      {auth?.connected ? <Space wrap><Button loading={busy} icon={<CheckOutlined />} onClick={() => void onAction("auth:verify")}>{labels.verify}</Button><Button danger disabled={busy} onClick={() => void onAction("auth:disconnect")}>{labels.disconnect}</Button></Space> : <>
        <Segmented block value={method} onChange={value => setMethod(String(value))} options={[{ label: s("browserLogin"), value: "login", icon: <LinkOutlined /> }, { label: s("apiKey"), value: "key", icon: <KeyOutlined /> }]} />
        {method === "login" ? <Button block type="primary" loading={busy} icon={<LinkOutlined />} onClick={() => void onAction("auth:connect")}>{labels.connect}</Button> : <form onSubmit={event => { event.preventDefault(); void onAction("auth:key", key).then(ok => { if (ok) setKey(""); }); }}>
          <Input.Password aria-label={s("apiKey")} placeholder="sk-orca-…" autoComplete="off" value={key} disabled={busy} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setKey(event.target.value)} />
          <Button block type="primary" htmlType="submit" loading={busy} disabled={!key.trim()}>{s("keyConnect")}</Button>
          <p>{s("keyHint")} <Typography.Link href="https://www.orcarouter.ai/console" target="_blank" rel="noreferrer">{s("apiKeysLink")}</Typography.Link></p>
        </form>}
      </>}
    </section>
  </div>;
}

export function connectionError(error: unknown, language: SupportedLanguage): string {
  const issue = readProviderIssue(error);
  if (issue) return providerReason(language, issue.kind);
  const detail = error instanceof Error ? error.message : String(error);
  const key = /AUTH_KEY_INVALID/.test(detail) ? "authKeyInvalid" : /AUTH_CREDENTIAL_REJECTED/.test(detail) ? "authRejected" : /TIMEOUT|Failed to fetch|NetworkError/.test(detail) ? "authTimeout" : /AUTH_CANCELLED|AUTH_DECLINED/.test(detail) ? "authDeclined" : /AUTH_WINDOW_FAILED/.test(detail) ? "authWindowFailed" : "authFailed";
  const reason = detail.includes(":") ? detail.slice(detail.indexOf(":") + 1).replace(/sk-orca-[\w-]+/g, "[redacted]").slice(0, 180) : "";
  return workspaceText(language, key) + (["authFailed", "authWindowFailed"].includes(key) && reason ? ` ${reason}` : "");
}

export function WorkspacePicker({ value, recent, disabled, available, onChange, s }: { value: string; recent: string[]; disabled: boolean; available: boolean; onChange: (path: string) => Promise<void>; s: Text }) {
  const [open, setOpen] = useState(false); const [browsing, setBrowsing] = useState(false);
  const [path, setPath] = useState(value); const [listing, setListing] = useState<WorkspaceDirectory>();
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const requestId = useRef(0);
  const read = async (next: string, append = false) => {
    const id = ++requestId.current; setLoading(true); setError("");
    try {
      const result = await listWorkspaceDirectory(next, append ? listing?.nextOffset ?? 0 : 0);
      if (id !== requestId.current) return;
      setListing(previous => append && previous?.path === result.path ? { ...result, directories: [...previous.directories, ...result.directories] } : result);
      setPath(result.path);
    } catch (error) { if (id === requestId.current) { setError(s(directoryErrorKey(error))); if (!append) setListing(undefined); } }
    finally { if (id === requestId.current) setLoading(false); }
  };
  const choose = async (next: string) => {
    const id = ++requestId.current;
    setLoading(true); setError("");
    try {
      const result = next ? await listWorkspaceDirectory(next) : undefined;
      if (id !== requestId.current) return;
      await onChange(result?.path ?? ""); setOpen(false); setBrowsing(false);
    } catch (error) { if (id === requestId.current) setError(s(directoryErrorKey(error))); }
    finally { if (id === requestId.current) setLoading(false); }
  };
  const cancelBrowse = () => { requestId.current++; setBrowsing(false); setLoading(false); setError(""); };
  return <>
    <Popover trigger="click" placement="topLeft" open={open} onOpenChange={next => { setOpen(next); if (next) { setPath(value); setError(""); } }} content={<div className="ws-folder-popover">
      <strong>{s("workspace")}</strong><Input.Search aria-label={s("directoryPath")} value={path} placeholder={s("directoryPath")} enterButton={<CheckOutlined />} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPath(event.target.value)} onSearch={(next: string) => void choose(next.trim())} loading={loading} />
      {error && <Alert type="error" showIcon message={error} />}
      <Button block icon={<FolderOpenOutlined />} disabled={loading} onClick={() => { setOpen(false); setBrowsing(true); void read(path || ""); }}>{s("browse")}</Button>
      <Button block type="text" onClick={() => void choose("")} disabled={loading}>{s("defaultFolder")}</Button>
      {recent.length > 0 && <><small>{s("recentDirectories")}</small>{recent.slice(0, 5).map(item => <Button key={item} type="text" block title={item} disabled={loading} onClick={() => void choose(item)}><FolderOutlined /><span className="ws-folder-label">{item}</span></Button>)}</>}
      {!available && <Alert type="info" message={s("bridgeRequired")} />}
    </div>}><Button type="text" size="small" disabled={disabled} icon={<FolderOutlined />} className="ws-workspace-trigger" aria-label={s("chooseDirectory")} title={value || s("defaultWorkspace")}><span>{value ? value.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || value : s("defaultWorkspace")}</span></Button></Popover>
    <Modal title={s("chooseDirectory")} open={browsing} onCancel={cancelBrowse} onOk={() => void choose(path.trim())} okText={s("useDirectory")} cancelText={s("cancel")} confirmLoading={loading} okButtonProps={{ disabled: !path.trim() || loading }} width={480} zIndex={1200} className="ws-modal">
      <div className="ws-folder-navigation"><Button aria-label={s("parentDirectory")} icon={<ArrowUpOutlined />} disabled={!listing?.parent || loading} onClick={() => { if (listing?.parent) void read(listing.parent); }} /><Input.Search aria-label={s("directoryPath")} value={path} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPath(event.target.value)} onSearch={(next: string) => void read(next)} loading={loading} enterButton={<ReloadOutlined />} /></div>
      {error && <Alert type="error" showIcon message={error} action={<Button size="small" onClick={() => void read(path)}>{s("retry")}</Button>} />}
      {(!error || listing) && <List className="ws-folder-list" loading={loading} dataSource={listing?.directories ?? []} locale={{ emptyText: loading ? null : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={s("noDirectories")} /> }} renderItem={item => <List.Item><Button type="text" block icon={<FolderOutlined />} onClick={() => void read(item.path)}>{item.name}</Button></List.Item>} />}
      {listing?.nextOffset != null && <Button block disabled={loading} onClick={() => void read(listing.path, true)}>{s("more")}</Button>}
    </Modal>
  </>;
}
