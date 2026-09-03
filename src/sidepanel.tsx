import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { createRoot } from "react-dom/client";
import { Alert, Button, Card, ConfigProvider, Descriptions, Empty, Flex, Input, Select, Space, Spin, Tag, Typography } from "antd";
import { CheckCircleOutlined, CloudServerOutlined, DisconnectOutlined, FileSearchOutlined, LinkOutlined, ReloadOutlined, SendOutlined } from "@ant-design/icons";
import "antd/dist/reset.css";
import "./style.css";
import type { AuthStatus, BackgroundRequest, BackgroundResponse, ChatMessage, PageContext } from "./messages";
import {
  LANGUAGE_OPTIONS,
  resolveLanguage,
  translate,
  type LanguagePreference,
  type SupportedLanguage,
  type TranslationKey
} from "./locales";

const LANGUAGE_STORAGE_KEY = "language_preference";

type Notice = { text: string; kind: "info" | "success" | "error" } | null;

function App(): JSX.Element {
  const [preference, setPreference] = useState<LanguagePreference>("auto");
  const [language, setLanguage] = useState<SupportedLanguage>(() => resolveLanguage("auto"));
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [page, setPage] = useState<PageContext | null>(null);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const t = useCallback(
    (key: TranslationKey, params: Record<string, string | number> = {}) => translate(language, key, params),
    [language]
  );

  const refresh = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await send({ type: "auth:status" });
      if (!response.ok) throw new Error(response.error);
      setStatus(response.data as AuthStatus);
    } catch (error) {
      setNotice({ text: t(errorMessageKey(readableError(error))), kind: "error" });
    } finally {
      setBusy(false);
    }
  }, [t]);

  useEffect(() => {
    document.documentElement.lang = language.replace("_", "-");
  }, [language]);

  useEffect(() => {
    void (async () => {
      const stored = await chrome.storage.local.get(LANGUAGE_STORAGE_KEY);
      const next = isLanguagePreference(stored[LANGUAGE_STORAGE_KEY]) ? stored[LANGUAGE_STORAGE_KEY] : "auto";
      setPreference(next);
      setLanguage(resolveLanguage(next));
    })();
  }, []);

  useEffect(() => void refresh(), [refresh]);

  const runAction = async (type: "auth:connect" | "auth:disconnect") => {
    setBusy(true);
    setNotice({ text: t(type === "auth:connect" ? "openingOrca" : "disconnecting"), kind: "info" });
    try {
      const response = await send({ type });
      if (!response.ok) throw new Error(response.error);
      setStatus(response.data as AuthStatus);
      setNotice({ text: t(type === "auth:connect" ? "orcaConnected" : "keyDeleted"), kind: "success" });
    } catch (error) {
      setNotice({ text: t(errorMessageKey(readableError(error))), kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setNotice({ text: t("readingModels"), kind: "info" });
    try {
      const response = await send({ type: "auth:verify" });
      if (!response.ok) throw new Error(response.error);
      const data = response.data as { modelCount: number };
      setNotice({ text: t("modelsFound", { count: data.modelCount }), kind: "success" });
    } catch (error) {
      setNotice({ text: t(errorMessageKey(readableError(error))), kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  const readPage = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await send({ type: "page:extract" });
      if (!response.ok) throw new Error(response.error);
      const next = response.data as PageContext;
      setPage(next);
      setNotice({ text: t("pageReady", { title: next.title }), kind: "success" });
    } catch (error) {
      setNotice({ text: t(errorMessageKey(readableError(error))), kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  const ask = async (preset?: TranslationKey) => {
    const question = preset ? t(preset) : prompt.trim();
    if (!page) return setNotice({ text: t("pageNotReady"), kind: "info" });
    if (!question) return;
    setBusy(true);
    setNotice(null);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setPrompt("");
    try {
      const response = await send({ type: "chat:complete", prompt: question, page, history: messages, conversationId });
      if (!response.ok) throw new Error(response.error);
      const data = response.data as { content: string; conversationId?: string };
      setMessages([...nextMessages, { role: "assistant", content: data.content }]);
      setConversationId(data.conversationId);
    } catch (error) {
      setNotice({ text: t(errorMessageKey(readableError(error))), kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  const statusCopy = status
    ? !status.bridgeInstalled
      ? t(status.connected ? "connectedNoBridge" : "disconnectedNoBridge")
      : status.connected
        ? t("connectedWithBridge", { version: status.bridgeVersion ?? "" })
        : t("readyWithBridge")
    : t("readingStatus");

  const languageOptions = useMemo(
    () => LANGUAGE_OPTIONS.map((option) => ({
      value: option.value,
      label: option.value === "auto" ? `${t("languageAuto")} (${option.label})` : option.label
    })),
    [t]
  );

  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#147a4c", borderRadius: 12, fontFamily: "Inter, system-ui, sans-serif" } }}>
      <main className="shell">
        <Flex align="center" justify="space-between" gap={16} className="app-header">
          <Flex align="center" gap={12}>
            <img className="brand-mark" src="/icons/icon-48.png" alt="" />
            <div><Typography.Title level={4}>WebAgentMate</Typography.Title><Typography.Text type="secondary">{t("connectionExperiment")}</Typography.Text></div>
          </Flex>
          <Select aria-label={t("language")} value={preference} options={languageOptions} onChange={async (next: LanguagePreference) => {
            setPreference(next);
            setLanguage(resolveLanguage(next));
            await chrome.storage.local.set({ [LANGUAGE_STORAGE_KEY]: next });
          }} />
        </Flex>

        <Card className="chat-card" title={t("chat")} extra={<Button size="small" icon={<FileSearchOutlined />} loading={busy} onClick={() => void readPage()}>{t("readPage")}</Button>}>
          {page && <Typography.Text type="secondary" ellipsis title={page.title}>{t("pageReady", { title: page.title })}</Typography.Text>}
          <Flex gap={8} wrap className="quick-actions">
            {(["summary", "keyPoints", "explain", "translatePage"] as TranslationKey[]).map((key) => <Button key={key} size="small" disabled={busy || !page} onClick={() => void ask(key)}>{t(key)}</Button>)}
          </Flex>
          <div className="message-list" aria-live="polite">
            {messages.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("pageNotReady")} /> : messages.map((item, index) => (
              <div key={index} className={`chat-message ${item.role}`}><Typography.Paragraph>{item.content}</Typography.Paragraph></div>
            ))}
            {busy && messages.length > 0 && <Spin size="small" />}
          </div>
          <Flex gap={8} align="flex-end">
            <Input.TextArea value={prompt} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setPrompt(event.target.value)} placeholder={t("askPlaceholder")} autoSize={{ minRows: 2, maxRows: 5 }} onPressEnter={(event: KeyboardEvent<HTMLTextAreaElement>) => { if (!event.shiftKey) { event.preventDefault(); void ask(); } }} />
            <Button type="primary" aria-label={t("send")} icon={<SendOutlined />} loading={busy} disabled={!prompt.trim() || !page} onClick={() => void ask()} />
          </Flex>
        </Card>

        <Card className="connection-card" title={t("connection")}>
          <Flex justify="space-between" align="flex-start" gap={12}>
            <Space direction="vertical" size={1}>
              <Typography.Text className="eyebrow">{t("modelService")}</Typography.Text>
              <Typography.Title level={3}>OrcaRouter</Typography.Title>
            </Space>
            {busy && !status ? <Spin size="small" /> : <Tag color={status?.connected ? "success" : "default"} icon={status?.connected ? <CheckCircleOutlined /> : undefined}>{status?.connected ? t("connected") : status ? t("notConnected") : t("checking")}</Tag>}
          </Flex>

          <Typography.Paragraph type="secondary" className="status-copy">{statusCopy}</Typography.Paragraph>
          {notice && <Alert role="status" aria-live="polite" showIcon type={notice.kind} message={notice.text} closable onClose={() => setNotice(null)} />}

          <Flex gap={10} className="actions" vertical>
            {!status?.connected ? (
              <Button type="primary" size="large" icon={<LinkOutlined />} loading={busy} onClick={() => void runAction("auth:connect")}>{t("connectOrca")}</Button>
            ) : (
              <Flex gap={10}>
                <Button type="primary" block icon={<ReloadOutlined />} loading={busy} onClick={() => void verify()}>{t("verify")}</Button>
                <Button block danger icon={<DisconnectOutlined />} disabled={busy} onClick={() => void runAction("auth:disconnect")}>{t("disconnect")}</Button>
              </Flex>
            )}
          </Flex>
        </Card>

        <Alert className="privacy-note" icon={<CloudServerOutlined />} showIcon type="info" message={t("privacyTitle")} description={t("privacyCopy")} />

        <Card size="small" title={t("developerInfo")} className="developer-card">
          <Descriptions column={1} size="small">
            <Descriptions.Item label={t("callbackUrl")}><Typography.Text copyable>{status?.callbackUrl ?? "—"}</Typography.Text></Descriptions.Item>
            <Descriptions.Item label={t("authorizationProtocol")}>OAuth 2.0 + PKCE (S256)</Descriptions.Item>
          </Descriptions>
        </Card>
      </main>
    </ConfigProvider>
  );
}

function send(request: BackgroundRequest): Promise<BackgroundResponse> {
  return chrome.runtime.sendMessage(request) as Promise<BackgroundResponse>;
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorMessageKey(error: string): TranslationKey {
  if (error.includes("AUTH_CANCELLED")) return "errorAuthCancelled";
  if (error.includes("AUTH_STATE_INVALID")) return "errorAuthState";
  if (error.includes("AUTH_CODE_MISSING")) return "errorAuthCode";
  if (error.includes("AUTH_EXCHANGE_FAILED")) return "errorAuthExchange";
  if (error.includes("AUTH_CREDENTIAL_REJECTED") || error.includes("AUTH_NOT_CONNECTED")) return "errorCredential";
  if (error.includes("PROVIDER_") || error.includes("Failed to fetch")) return "errorProvider";
  return "errorGeneric";
}

function isLanguagePreference(value: unknown): value is LanguagePreference {
  return LANGUAGE_OPTIONS.some((option) => option.value === value);
}

createRoot(document.getElementById("root")!).render(<App />);
