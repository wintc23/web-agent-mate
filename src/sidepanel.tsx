import * as React from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent
} from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  CloudOutlined,
  CodeOutlined,
  DownOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  LoadingOutlined,
  PlusOutlined,
  ReadOutlined,
  ReloadOutlined,
  RobotOutlined,
  SendOutlined,
  SettingOutlined,
  StopOutlined,
  TranslationOutlined,
  UnorderedListOutlined
} from "@ant-design/icons";
import "./style.css";
import { Workspace } from "./Workspace";
import type {
  AgentAction,
  AgentAdapter,
  AgentAdapterId,
  AgentResult,
  AuthStatus,
  BackgroundRequest,
  BackgroundResponse,
  ChatMessage,
  ExecutionLocation,
  OrcaModel,
  PageContext,
  RemoteModel,
  ResponseLanguage,
  RunPortRequest,
  RunPortResponse
} from "./messages";
import {
  LANGUAGE_OPTIONS,
  resolveLanguage,
  translate,
  type LanguagePreference,
  type SupportedLanguage,
  type TranslationKey
} from "./locales";

const LANGUAGE_STORAGE_KEY = "language_preference";
const THEME_STORAGE_KEY = "theme_preference";
const AGENT_STORAGE_KEY = "act_provider";
const LEGACY_AGENT_STORAGE_KEY = "agent_adapter";
const DRAFT_STORAGE_KEY = "conversation_draft";
const ORCA_MODEL_STORAGE_KEY = "orcarouter_model";
const LOCATION_STORAGE_KEY = "execution_location";
const PROMPT_HISTORY_STORAGE_KEY = "prompt_history";

const FALLBACK_REMOTE_MODELS: RemoteModel[] = [
  { id: "orcarouter/free", name: "Orca Free", free: true },
  { id: "orcarouter/auto", name: "Orca Auto", free: false }
];

type ThemePreference = "system" | "light" | "dark";
type AppView = "chat" | "settings";
type SettingsTab = "settings" | "about";
type ModelDialogReason = "free-limit" | "free-prompt" | null;
type MessageStatus = "running" | "waiting_approval" | "completed" | "stopped" | "failed";
type Notice = { text: string; kind: "info" | "success" | "error" } | null;

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: MessageStatus;
  source?: string;
  model?: OrcaModel;
  responseLanguage?: ResponseLanguage;
  agent?: AgentResult;
}

interface ActiveOperation {
  requestId: string;
  messageId: string;
  source: string;
  phase: "running" | "stopping" | "approval";
  taskId?: string;
}

function App(): JSX.Element {
  const [preference, setPreference] = useState<LanguagePreference>("auto");
  const [language, setLanguage] = useState<SupportedLanguage>(() => resolveLanguage("auto"));
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [systemDark, setSystemDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [agentAdapters, setAgentAdapters] = useState<AgentAdapter[]>([]);
  const [agentAdapter, setAgentAdapter] = useState<AgentAdapterId>("codex");
  const [remoteModels, setRemoteModels] = useState<RemoteModel[]>(FALLBACK_REMOTE_MODELS);
  const [orcaModel, setOrcaModel] = useState<OrcaModel>("orcarouter/free");
  const [location, setLocation] = useState<ExecutionLocation>("remote");
  const [view, setView] = useState<AppView>("chat");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("settings");
  const [modelPickerLocation, setModelPickerLocation] = useState<ExecutionLocation>("remote");
  const [modelDialogReason, setModelDialogReason] = useState<ModelDialogReason>(null);
  const [page, setPage] = useState<PageContext | null>(null);
  const [prompt, setPrompt] = useState("");
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [operation, setOperation] = useState<ActiveOperation>();
  const [notice, setNotice] = useState<Notice>(null);
  const [readingPage, setReadingPage] = useState(false);
  const [checkingConnections, setCheckingConnections] = useState(true);
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [showLatest, setShowLatest] = useState(false);

  const modelDialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsTitleRef = useRef<HTMLHeadingElement>(null);
  const streamRef = useRef<HTMLElement>(null);
  const portRef = useRef<chrome.runtime.Port>();
  const cancelRequestedRef = useRef(false);
  const stickToBottomRef = useRef(true);
  const historyDraftRef = useRef("");

  const dark = themePreference === "dark" || (themePreference === "system" && systemDark);
  const t = useCallback(
    (key: TranslationKey, params: Record<string, string | number> = {}) => translate(language, key, params),
    [language]
  );

  const refreshConnections = useCallback(async () => {
    setCheckingConnections(true);
    try {
      const [statusResponse, adaptersResponse, modelsResponse] = await Promise.all([
        send({ type: "auth:status" }),
        send({ type: "agents:list" }),
        send({ type: "models:list" })
      ]);
      if (!statusResponse.ok) throw new Error(statusResponse.error);
      setStatus(statusResponse.data as AuthStatus);
      if (adaptersResponse.ok) {
        const adapters = (adaptersResponse.data as { adapters: AgentAdapter[] }).adapters;
        setAgentAdapters(adapters);
        setAgentAdapter((current) => {
          const currentAdapter = adapters.find((adapter) => adapter.id === current);
          return currentAdapter?.available
            ? current
            : adapters.find((adapter) => adapter.available)?.id ?? currentAdapter?.id ?? adapters[0]?.id ?? "codex";
        });
      }
      if (modelsResponse.ok) {
        const models = mergeRemoteModels((modelsResponse.data as { models: RemoteModel[] }).models);
        setRemoteModels(models);
        setOrcaModel((current) => models.some((model) => model.id === current)
          ? current
          : models.find((model) => model.free)?.id ?? models[0]?.id ?? "orcarouter/free");
      }
    } catch (error) {
      setNotice({ text: displayError(error, t), kind: "error" });
    } finally {
      setCheckingConnections(false);
    }
  }, [t]);

  useEffect(() => {
    document.documentElement.lang = language.replace("_", "-");
  }, [language]);

  useEffect(() => {
    void (async () => {
      const stored = await chrome.storage.local.get([
        LANGUAGE_STORAGE_KEY,
        THEME_STORAGE_KEY,
        AGENT_STORAGE_KEY,
        LEGACY_AGENT_STORAGE_KEY,
        DRAFT_STORAGE_KEY,
        ORCA_MODEL_STORAGE_KEY,
        LOCATION_STORAGE_KEY,
        PROMPT_HISTORY_STORAGE_KEY
      ]);
      const nextLanguage = isLanguagePreference(stored[LANGUAGE_STORAGE_KEY])
        ? stored[LANGUAGE_STORAGE_KEY]
        : "auto";
      setPreference(nextLanguage);
      setLanguage(resolveLanguage(nextLanguage));
      if (isThemePreference(stored[THEME_STORAGE_KEY])) setThemePreference(stored[THEME_STORAGE_KEY]);
      const storedAgent = stored[AGENT_STORAGE_KEY] ?? stored[LEGACY_AGENT_STORAGE_KEY];
      if (isLocalAgentAdapterId(storedAgent)) setAgentAdapter(storedAgent);
      if (isOrcaModel(stored[ORCA_MODEL_STORAGE_KEY])) setOrcaModel(stored[ORCA_MODEL_STORAGE_KEY]);
      if (stored[LOCATION_STORAGE_KEY] === "remote" || stored[LOCATION_STORAGE_KEY] === "local") {
        setLocation(stored[LOCATION_STORAGE_KEY]);
      }
      if (typeof stored[DRAFT_STORAGE_KEY] === "string") setPrompt(stored[DRAFT_STORAGE_KEY]);
      if (Array.isArray(stored[PROMPT_HISTORY_STORAGE_KEY])) {
        setPromptHistory(stored[PROMPT_HISTORY_STORAGE_KEY]
          .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
          .slice(-50));
      }
    })();
  }, []);

  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const resolved = dark ? "dark" : "light";
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')?.setAttribute("content", resolved);
  }, [dark]);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      void chrome.storage.local.set({ [DRAFT_STORAGE_KEY]: prompt });
    }, 250);
    return () => globalThis.clearTimeout(timer);
  }, [prompt]);

  useEffect(() => void refreshConnections(), [refreshConnections]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream || !stickToBottomRef.current) return;
    stream.scrollTo({ top: stream.scrollHeight });
  }, [messages, operation]);

  useEffect(() => () => {
    portRef.current?.disconnect();
  }, []);

  const languageOptions = useMemo(
    () => LANGUAGE_OPTIONS.map((option) => ({
      value: option.value,
      label: option.value === "auto" ? `${t("languageAuto")} (${option.label})` : option.label
    })),
    [t]
  );

  const selectedAgent = agentAdapters.find((adapter) => adapter.id === agentAdapter);
  const selectedRemoteModel = remoteModels.find((model) => model.id === orcaModel);
  const selectedSource = location === "remote"
    ? selectedRemoteModel?.name ?? orcaModel
    : selectedAgent?.name ?? adapterName(agentAdapter);
  const sourceAvailable = location === "remote"
    ? Boolean(status?.connected && selectedRemoteModel)
    : Boolean(status?.bridgeInstalled && selectedAgent?.available);
  const health = getHealth(status, agentAdapters);
  const statusLabel = checkingConnections
    ? t("checking")
    : health === "ready"
      ? t("ready")
      : health === "partial"
        ? t("unverified")
        : t("notConnected");

  const openSettings = () => {
    setSettingsTab("settings");
    setView("settings");
    requestAnimationFrame(() => settingsTitleRef.current?.focus());
  };

  const closeSettings = () => {
    setView("chat");
    requestAnimationFrame(() => settingsButtonRef.current?.focus());
  };

  const openModelDialog = (reason: ModelDialogReason = null) => {
    setModelDialogReason(reason);
    setModelPickerLocation(location);
    const dialog = modelDialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  };

  const closeModelDialog = () => {
    setModelDialogReason(null);
    modelDialogRef.current?.close();
  };

  const updateMessage = (id: string, patch: Partial<ConversationMessage>) => {
    setMessages((current) => current.map((message) => message.id === id ? { ...message, ...patch } : message));
  };

  const restoreComposerFocus = () => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const readPage = async (): Promise<PageContext | undefined> => {
    if (readingPage) return page ?? undefined;
    setReadingPage(true);
    setNotice(null);
    try {
      const response = await send({ type: "page:extract" });
      if (!response.ok) throw new Error(response.error);
      const nextPage = response.data as PageContext;
      setPage(nextPage);
      return nextPage;
    } catch (error) {
      setNotice({ text: displayError(error, t), kind: "error" });
      return undefined;
    } finally {
      setReadingPage(false);
    }
  };

  const finishRun = (
    operationSnapshot: ActiveOperation,
    response: RunPortResponse
  ) => {
    if (response.type === "run:cancelled") {
      updateMessage(operationSnapshot.messageId, {
        content: t("requestStopped"),
        status: "stopped"
      });
      setOperation(undefined);
      restoreComposerFocus();
      return;
    }
    if (response.type === "run:error") {
      const freeLimit = response.error.includes("PROVIDER_FREE_UNAVAILABLE");
      const freePrompt = response.error.includes("PROVIDER_FREE_PROMPT_LIMIT");
      updateMessage(operationSnapshot.messageId, {
        content: displayError(new Error(response.error), t),
        status: "failed"
      });
      setOperation(undefined);
      if (freeLimit || freePrompt) {
        requestAnimationFrame(() => openModelDialog(freeLimit ? "free-limit" : "free-prompt"));
      } else {
        restoreComposerFocus();
      }
      return;
    }
    if (response.type !== "run:result") return;
    const result = response.data;
    const resultStatus: MessageStatus = result.status === "waiting_approval"
      ? "waiting_approval"
      : result.status === "cancelled"
        ? "stopped"
        : result.status === "failed"
          ? "failed"
          : "completed";
    updateMessage(operationSnapshot.messageId, {
      content: result.message,
      status: resultStatus,
      source: operationSnapshot.source,
      agent: result
    });
    if (result.conversationId) setConversationId(result.conversationId);
    if (result.status === "waiting_approval") {
      setOperation({
        ...operationSnapshot,
        phase: "approval",
        taskId: result.taskId
      });
    } else {
      setOperation(undefined);
      restoreComposerFocus();
    }
  };

  const runThroughPort = async (request: RunPortRequest): Promise<RunPortResponse> => {
    const port = chrome.runtime.connect({ name: "webagentmate-run" });
    portRef.current = port;
    return await new Promise<RunPortResponse>((resolve) => {
      let settled = false;
      const finish = (response: RunPortResponse) => {
        if (settled) return;
        settled = true;
        if (portRef.current === port) portRef.current = undefined;
        try {
          port.disconnect();
        } catch {
          // Already disconnected.
        }
        resolve(response);
      };
      port.onMessage.addListener((message: RunPortResponse) => {
        if (message.requestId !== request.requestId || message.type === "run:started") return;
        finish(message);
      });
      port.onDisconnect.addListener(() => {
        if (!settled) {
          finish({ type: "run:error", requestId: request.requestId, error: "RUN_CHANNEL_CLOSED" });
        }
      });
      port.postMessage(request);
      if (cancelRequestedRef.current) {
        port.postMessage({ type: "run:cancel", requestId: request.requestId } as RunPortRequest);
      }
    });
  };

  const submitPrompt = async (value = prompt) => {
    const text = value.trim();
    if (!text || operation) return;
    if (!sourceAvailable) {
      setNotice({ text: t("configureAI"), kind: "info" });
      openSettings();
      return;
    }

    const requestId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    const source = selectedSource;
    const responseLanguage = toResponseLanguage(language);
    const nextPromptHistory = promptHistory.at(-1) === text
      ? promptHistory
      : [...promptHistory, text].slice(-50);
    setPromptHistory(nextPromptHistory);
    void chrome.storage.local.set({ [PROMPT_HISTORY_STORAGE_KEY]: nextPromptHistory });
    setHistoryCursor(null);
    historyDraftRef.current = "";
    const history: ChatMessage[] = messages
      .filter((message) => message.status === "completed")
      .map((message) => ({ role: message.role, content: message.content }));
    const operationSnapshot: ActiveOperation = {
      requestId,
      messageId: assistantId,
      source,
      phase: "running"
    };

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: text, status: "completed" },
      {
        id: assistantId,
        role: "assistant",
        content: t("thinking"),
        status: "running",
        source,
        model: orcaModel,
        responseLanguage
      }
    ]);
    setPrompt("");
    setNotice(null);
    setOperation(operationSnapshot);
    cancelRequestedRef.current = false;
    stickToBottomRef.current = true;

    const response = await runThroughPort({
      type: "run:agent",
      requestId,
      goal: text,
      history,
      conversationId,
      adapter: location === "remote" ? "orcarouter" : agentAdapter,
      model: orcaModel,
      location,
      responseLanguage
    });
    finishRun(operationSnapshot, response);
  };

  const approveAgent = async (message: ConversationMessage) => {
    const result = message.agent;
    if (!result?.action || result.status !== "waiting_approval") return;
    const requestId = crypto.randomUUID();
    const operationSnapshot: ActiveOperation = {
      requestId,
      messageId: message.id,
      source: message.source ?? adapterName(agentAdapter),
      phase: "running",
      taskId: result.taskId
    };
    cancelRequestedRef.current = false;
    setOperation(operationSnapshot);
    updateMessage(message.id, { status: "running", content: t("taskRunning") });
    const response = await runThroughPort({
      type: "run:agent:approve",
      requestId,
      taskId: result.taskId,
      action: result.action,
      model: message.model ?? "orcarouter/free",
      responseLanguage: message.responseLanguage ?? toResponseLanguage(language)
    });
    finishRun(operationSnapshot, response);
  };

  const cancelApproval = async (message: ConversationMessage) => {
    const taskId = message.agent?.taskId;
    if (!taskId) return;
    setOperation((current) => current ? { ...current, phase: "stopping" } : current);
    try {
      const response = await send({ type: "agent:cancel", taskId });
      if (!response.ok) throw new Error(response.error);
      updateMessage(message.id, {
        content: t("requestStopped"),
        status: "stopped",
        agent: response.data as AgentResult
      });
    } catch (error) {
      updateMessage(message.id, { content: displayError(error, t), status: "failed" });
    } finally {
      setOperation(undefined);
      restoreComposerFocus();
    }
  };

  const stopActive = async () => {
    const current = operation;
    if (!current || current.phase === "stopping") return;
    cancelRequestedRef.current = true;
    setOperation({ ...current, phase: "stopping" });
    updateMessage(current.messageId, { content: t("stopping") });
    const port = portRef.current;
    if (port) {
      port.postMessage({ type: "run:cancel", requestId: current.requestId } as RunPortRequest);
      return;
    }
    if (current.taskId) {
      try {
        await send({ type: "agent:cancel", taskId: current.taskId });
      } finally {
        updateMessage(current.messageId, { content: t("requestStopped"), status: "stopped" });
        setOperation(undefined);
        restoreComposerFocus();
      }
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitPrompt();
  };

  const handlePromptChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(event.target.value);
    setHistoryCursor(null);
    historyDraftRef.current = event.target.value;
  };

  const recallPrompt = (direction: "older" | "newer") => {
    if (promptHistory.length === 0) return false;
    let nextCursor: number | null = historyCursor;
    let nextPrompt = prompt;
    if (direction === "older") {
      if (historyCursor === null) historyDraftRef.current = prompt;
      nextCursor = Math.max(0, (historyCursor ?? promptHistory.length) - 1);
      nextPrompt = promptHistory[nextCursor] ?? prompt;
    } else {
      if (historyCursor === null) return false;
      const candidate = historyCursor + 1;
      if (candidate >= promptHistory.length) {
        nextCursor = null;
        nextPrompt = historyDraftRef.current;
      } else {
        nextCursor = candidate;
        nextPrompt = promptHistory[candidate] ?? prompt;
      }
    }
    setHistoryCursor(nextCursor);
    setPrompt(nextPrompt);
    requestAnimationFrame(() => textareaRef.current?.setSelectionRange(nextPrompt.length, nextPrompt.length));
    return true;
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const native = event.nativeEvent;
    if (native.isComposing || native.keyCode === 229) return;
    const target = event.currentTarget;
    const hasCollapsedSelection = target.selectionStart === target.selectionEnd;
    if (
      event.key === "ArrowUp" &&
      hasCollapsedSelection &&
      caretIsOnFirstLine(target) &&
      recallPrompt("older")
    ) {
      event.preventDefault();
      return;
    }
    if (
      event.key === "ArrowDown" &&
      hasCollapsedSelection &&
      caretIsOnLastLine(target) &&
      recallPrompt("newer")
    ) {
      event.preventDefault();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !operation) {
      event.preventDefault();
      void submitPrompt();
    }
  };

  const handleStreamScroll = () => {
    const stream = streamRef.current;
    if (!stream) return;
    const distance = stream.scrollHeight - stream.scrollTop - stream.clientHeight;
    const atBottom = distance < 64;
    stickToBottomRef.current = atBottom;
    setShowLatest(!atBottom);
  };

  const scrollToLatest = () => {
    const stream = streamRef.current;
    if (!stream) return;
    stickToBottomRef.current = true;
    setShowLatest(false);
    stream.scrollTo({ top: stream.scrollHeight });
  };

  const selectAgent = async (next: AgentAdapterId) => {
    setAgentAdapter(next);
    await chrome.storage.local.set({
      [AGENT_STORAGE_KEY]: next,
      [LEGACY_AGENT_STORAGE_KEY]: next
    });
  };

  const selectRemoteModel = async (next: OrcaModel) => {
    setOrcaModel(next);
    setLocation("remote");
    await chrome.storage.local.set({
      [ORCA_MODEL_STORAGE_KEY]: next,
      [LOCATION_STORAGE_KEY]: "remote"
    });
    closeModelDialog();
    restoreComposerFocus();
  };

  const selectLocalAgent = async (next: AgentAdapterId) => {
    const adapter = agentAdapters.find((item) => item.id === next);
    if (!adapter?.available) return;
    await selectAgent(next);
    setLocation("local");
    await chrome.storage.local.set({ [LOCATION_STORAGE_KEY]: "local" });
    closeModelDialog();
    restoreComposerFocus();
  };

  const runConnectionAction = async (type: "auth:connect" | "auth:disconnect" | "auth:verify") => {
    setConnectionBusy(true);
    setNotice({
      text: t(type === "auth:connect" ? "openingOrca" : type === "auth:disconnect" ? "disconnecting" : "readingModels"),
      kind: "info"
    });
    try {
      const response = await send({ type });
      if (!response.ok) throw new Error(response.error);
      if (type === "auth:verify") {
        const data = response.data as { modelCount: number };
        setNotice({ text: t("modelsFound", { count: data.modelCount }), kind: "success" });
      } else {
        setStatus(response.data as AuthStatus);
        setNotice({ text: t(type === "auth:connect" ? "orcaConnected" : "keyDeleted"), kind: "success" });
      }
      await refreshConnections();
    } catch (error) {
      setNotice({ text: displayError(error, t), kind: "error" });
    } finally {
      setConnectionBusy(false);
    }
  };

  const changeTheme = async (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as ThemePreference;
    setThemePreference(next);
    await chrome.storage.local.set({ [THEME_STORAGE_KEY]: next });
  };

  const changeLanguage = async (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as LanguagePreference;
    setPreference(next);
    setLanguage(resolveLanguage(next));
    await chrome.storage.local.set({ [LANGUAGE_STORAGE_KEY]: next });
  };

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(undefined);
    setPrompt("");
    setNotice(null);
    closeSettings();
    restoreComposerFocus();
  };

  const handleModelDialogBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) closeModelDialog();
  };

  if (view === "settings") {
    return (
      <SettingsScreen
        titleRef={settingsTitleRef}
        activeTab={settingsTab}
        status={status}
        adapters={agentAdapters}
        selectedAgent={agentAdapter}
        checking={checkingConnections}
        busy={connectionBusy}
        themePreference={themePreference}
        languagePreference={preference}
        languageOptions={languageOptions}
        notice={notice}
        t={t}
        onBack={closeSettings}
        onTabChange={setSettingsTab}
        onDismissNotice={() => setNotice(null)}
        onRefresh={() => void refreshConnections()}
        onConnectionAction={(type) => void runConnectionAction(type)}
        onSelectAgent={(id) => void selectAgent(id)}
        onThemeChange={(event) => void changeTheme(event)}
        onLanguageChange={(event) => void changeLanguage(event)}
        onNewConversation={startNewConversation}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-symbol" aria-hidden="true">W</span>
          <h1>WebAgentMate</h1>
        </div>
        <div className="header-actions">
          <span className={`health-status health-${health}`} aria-label={`${t("connection")}: ${statusLabel}`}>
            <span className="health-dot" aria-hidden="true" />
            <span>{statusLabel}</span>
          </span>
          <button ref={settingsButtonRef} className="settings-button" type="button" onClick={openSettings}>
            <SettingOutlined aria-hidden="true" />
            <span>{t("settings")}</span>
          </button>
        </div>
      </header>

      <main className="conversation-region">
        <section
          className="conversation-stream"
          ref={streamRef}
          onScroll={handleStreamScroll}
          aria-label={t("chat")}
        >
          {notice && (
            <div className={`notice notice-${notice.kind}`}>
              <span>{notice.text}</span>
              <button type="button" onClick={() => setNotice(null)} aria-label={t("close")}>
                <CloseOutlined aria-hidden="true" />
              </button>
            </div>
          )}
          <div className="page-context-bar">
            <span className="page-context-icon" aria-hidden="true"><FileTextOutlined /></span>
            <span className="page-context-copy">
              <small>{t("pageContext")}</small>
              <strong>{page ? page.title : t("currentPage")}</strong>
            </span>
            <button className="text-button page-context-action" type="button" onClick={() => void readPage()} disabled={readingPage}>
              {readingPage
                ? <LoadingOutlined spin aria-hidden="true" />
                : page
                  ? <ReloadOutlined aria-hidden="true" />
                  : <ReadOutlined aria-hidden="true" />}
              <span>{page ? t("refresh") : t("readPage")}</span>
            </button>
          </div>
          {messages.length === 0 ? (
            <Welcome
              t={t}
              onSuggestion={(key) => {
                setPrompt(t(key));
                restoreComposerFocus();
              }}
            />
          ) : (
            <ol className="message-list">
              {messages.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  t={t}
                  onApprove={() => void approveAgent(message)}
                  onReject={() => void cancelApproval(message)}
                />
              ))}
            </ol>
          )}
        </section>
        {showLatest && (
          <button className="latest-button" type="button" onClick={scrollToLatest}>
            <DownOutlined aria-hidden="true" />
            {t("backToLatest")}
          </button>
        )}
      </main>

      <footer className="composer-dock">
        <form className="composer" onSubmit={handleSubmit}>
          <label className="visually-hidden" htmlFor="composer-input">{t("agentPlaceholder")}</label>
          <textarea
            id="composer-input"
            ref={textareaRef}
            value={prompt}
            rows={1}
            onChange={handlePromptChange}
            onKeyDown={handleComposerKeyDown}
            placeholder={t("agentPlaceholder")}
          />
          <div className="composer-toolbar">
            <div className="composer-options">
              <button
                className={`composer-switch model-switch${sourceAvailable ? "" : " source-unavailable"}`}
                type="button"
                onClick={() => openModelDialog()}
                aria-haspopup="dialog"
                disabled={Boolean(operation)}
                title={t("switchModel")}
              >
                {location === "remote" ? <CloudOutlined aria-hidden="true" /> : <CodeOutlined aria-hidden="true" />}
                <span>{location === "remote" ? t("remote") : t("local")} · {selectedSource}</span>
                <DownOutlined aria-hidden="true" />
              </button>
            </div>
            {operation ? (
              <button
                className="send-button stop-button"
                type="button"
                onClick={() => void stopActive()}
                disabled={operation.phase === "stopping"}
                aria-label={t("cancelAgent")}
                title={t("cancelAgent")}
              >
                {operation.phase === "stopping"
                  ? <LoadingOutlined spin aria-hidden="true" />
                  : <StopOutlined aria-hidden="true" />}
              </button>
            ) : (
              <button
                className="send-button"
                type="submit"
                disabled={!prompt.trim()}
                aria-label={sourceAvailable ? t("send") : t("configureAI")}
                title={sourceAvailable ? t("send") : t("configureAI")}
              >
                {sourceAvailable ? <SendOutlined aria-hidden="true" /> : <LinkOutlined aria-hidden="true" />}
              </button>
            )}
          </div>
        </form>
      </footer>

      <ModelPickerDialog
        dialogRef={modelDialogRef}
        location={modelPickerLocation}
        selectedModel={orcaModel}
        selectedAgent={agentAdapter}
        remoteModels={remoteModels}
        adapters={agentAdapters}
        reason={modelDialogReason}
        t={t}
        onClose={closeModelDialog}
        onBackdrop={handleModelDialogBackdrop}
        onLocationChange={setModelPickerLocation}
        onSelectModel={(next) => void selectRemoteModel(next)}
        onSelectAgent={(next) => void selectLocalAgent(next)}
      />

      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {notice?.kind !== "error" ? notice?.text : operation?.phase === "stopping" ? t("stopping") : ""}
      </div>
      <div className="visually-hidden" aria-live="assertive" aria-atomic="true">
        {notice?.kind === "error" ? notice.text : ""}
      </div>
    </div>
  );
}

function Welcome({
  t,
  onSuggestion
}: {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  onSuggestion: (key: TranslationKey) => void;
}): JSX.Element {
  return (
    <div className="welcome">
      <span className="assistant-mark" aria-hidden="true">W</span>
      <div>
        <h2>{t("welcomeTitle")}</h2>
        <p>{t("welcomeBody")}</p>
        <div className="suggestion-list">
          {(["summary", "translatePage", "keyPoints"] as TranslationKey[]).map((key) => (
            <button key={key} type="button" onClick={() => onSuggestion(key)}>
              {key === "summary"
                ? <FileTextOutlined aria-hidden="true" />
                : key === "translatePage"
                  ? <TranslationOutlined aria-hidden="true" />
                  : <UnorderedListOutlined aria-hidden="true" />}
              <span>{t(key)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageItem({
  message,
  t,
  onApprove,
  onReject
}: {
  message: ConversationMessage;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  onApprove: () => void;
  onReject: () => void;
}): JSX.Element {
  if (message.role === "user") {
    return (
      <li className="message message-user">
        <p>{message.content}</p>
      </li>
    );
  }

  const waiting = message.status === "waiting_approval" && message.agent?.action;
  return (
    <li className={`message message-assistant message-${message.status}`}>
      <span className="assistant-mark" aria-hidden="true">W</span>
      <div className="assistant-content">
        {message.status === "running" && (
          <div className="run-label">
            <LoadingOutlined spin aria-hidden="true" />
            <span>{message.content}</span>
          </div>
        )}
        {message.status !== "running" && <p>{message.content}</p>}
        {waiting && (
          <div className="approval-block">
            <div className="approval-title">{t("approveAction")}</div>
            <code>{actionLabel(waiting)}</code>
            <p>{waiting.reason}</p>
            <div className="approval-actions">
              <button className="primary-button" type="button" onClick={onApprove}>{t("approve")}</button>
              <button className="secondary-button" type="button" onClick={onReject}>{t("rejectAndStop")}</button>
            </div>
          </div>
        )}
        {message.agent && message.status !== "running" && (
          <div className="message-meta">
            <span>{t("taskProgress", { count: message.agent.stepCount })}</span>
            {message.source && <span>{message.source}</span>}
          </div>
        )}
        {!message.agent && message.source && message.status === "completed" && (
          <div className="message-meta"><span>{message.source}</span></div>
        )}
      </div>
    </li>
  );
}

interface ModelPickerDialogProps {
  dialogRef: React.RefObject<HTMLDialogElement>;
  location: ExecutionLocation;
  selectedModel: OrcaModel;
  selectedAgent: AgentAdapterId;
  remoteModels: RemoteModel[];
  adapters: AgentAdapter[];
  reason: ModelDialogReason;
  t: (key: TranslationKey) => string;
  onClose: () => void;
  onBackdrop: (event: MouseEvent<HTMLDialogElement>) => void;
  onLocationChange: (location: ExecutionLocation) => void;
  onSelectModel: (model: OrcaModel) => void;
  onSelectAgent: (agent: AgentAdapterId) => void;
}

function ModelPickerDialog({
  dialogRef,
  location,
  selectedModel,
  selectedAgent,
  remoteModels,
  adapters,
  reason,
  t,
  onClose,
  onBackdrop,
  onLocationChange,
  onSelectModel,
  onSelectAgent
}: ModelPickerDialogProps): JSX.Element {
  const freeModels = remoteModels.filter((model) => model.free);
  const paidModels = remoteModels.filter((model) => !model.free);
  return (
    <dialog className="picker-dialog model-picker-dialog" ref={dialogRef} onClick={onBackdrop}>
      <div className="picker-panel">
        <header className="picker-header">
          <div>
            <h2>{t("chooseModel")}</h2>
            <p>{t("chooseModelDescription")}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={t("close")}>
            <CloseOutlined aria-hidden="true" />
          </button>
        </header>
        {reason && (
          <div className="quota-warning" role="status">
            <InfoCircleOutlined aria-hidden="true" />
            <div><strong>{t(reason === "free-limit" ? "freeLimitTitle" : "freePromptTitle")}</strong><p>{t(reason === "free-limit" ? "freeLimitCopy" : "freePromptCopy")}</p></div>
          </div>
        )}
        <div className="picker-tabs" aria-label={t("runLocation")}>
          <button type="button" className={location === "remote" ? "selected" : ""} onClick={() => onLocationChange("remote")} aria-pressed={location === "remote"}>
            <CloudOutlined aria-hidden="true" /><span>{t("remote")}</span>
          </button>
          <button type="button" className={location === "local" ? "selected" : ""} onClick={() => onLocationChange("local")} aria-pressed={location === "local"}>
            <CodeOutlined aria-hidden="true" /><span>{t("local")}</span>
          </button>
        </div>
        <div className="picker-scroll">
          {location === "remote" ? (
            <>
              <p className="picker-description">{t("remoteModelsDescription")}</p>
              <ModelGroup title={t("freeModels")} models={freeModels} selectedModel={selectedModel} onSelect={onSelectModel} t={t} />
              <ModelGroup title={t("paidModels")} models={paidModels} selectedModel={selectedModel} onSelect={onSelectModel} t={t} />
            </>
          ) : (
            <>
              <p className="picker-description">{t("localAgentsDescription")}</p>
              <div className="choice-list compact-choice-list">
                {adapters.length === 0 && <p className="empty-copy">{t("noLocalAgents")}</p>}
                {adapters.map((adapter) => (
                  <button
                    className={`choice-option${adapter.id === selectedAgent ? " selected" : ""}`}
                    type="button"
                    key={adapter.id}
                    onClick={() => adapter.available && onSelectAgent(adapter.id)}
                    aria-pressed={adapter.id === selectedAgent}
                    aria-disabled={!adapter.available}
                  >
                    <span className="choice-icon"><RobotOutlined aria-hidden="true" /></span>
                    <span className="choice-copy"><strong>{adapter.name}</strong><small>{adapter.detail || t(adapter.available ? "ready" : "unavailable")}</small></span>
                    <span className={`model-badge ${adapter.available ? "free-badge" : "offline-badge"}`}>{t(adapter.available ? "ready" : "unavailable")}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}

function ModelGroup({
  title,
  models,
  selectedModel,
  onSelect,
  t
}: {
  title: string;
  models: RemoteModel[];
  selectedModel: OrcaModel;
  onSelect: (model: OrcaModel) => void;
  t: (key: TranslationKey) => string;
}): JSX.Element | null {
  if (models.length === 0) return null;
  return (
    <section className="model-group">
      <h3>{title}</h3>
      <div className="choice-list compact-choice-list">
        {models.map((model) => (
          <button className={`choice-option${model.id === selectedModel ? " selected" : ""}`} type="button" key={model.id} onClick={() => onSelect(model.id)} aria-pressed={model.id === selectedModel}>
            <span className="choice-icon"><CloudOutlined aria-hidden="true" /></span>
            <span className="choice-copy"><strong>{model.name}</strong><small>{modelPriceLabel(model) ?? model.id}</small></span>
            <span className={`model-badge ${model.free ? "free-badge" : "paid-badge"}`}>{t(model.free ? "free" : "paid")}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

interface SettingsScreenProps {
  titleRef: React.RefObject<HTMLHeadingElement>;
  activeTab: SettingsTab;
  status: AuthStatus | null;
  adapters: AgentAdapter[];
  selectedAgent: AgentAdapterId;
  checking: boolean;
  busy: boolean;
  themePreference: ThemePreference;
  languagePreference: LanguagePreference;
  languageOptions: Array<{ value: LanguagePreference; label: string }>;
  notice: Notice;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  onBack: () => void;
  onTabChange: (tab: SettingsTab) => void;
  onDismissNotice: () => void;
  onRefresh: () => void;
  onConnectionAction: (type: "auth:connect" | "auth:disconnect" | "auth:verify") => void;
  onSelectAgent: (id: AgentAdapterId) => void;
  onThemeChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onLanguageChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onNewConversation: () => void;
}

function SettingsScreen({
  titleRef,
  activeTab,
  status,
  adapters,
  selectedAgent,
  checking,
  busy,
  themePreference,
  languagePreference,
  languageOptions,
  notice,
  t,
  onBack,
  onTabChange,
  onDismissNotice,
  onRefresh,
  onConnectionAction,
  onSelectAgent,
  onThemeChange,
  onLanguageChange,
  onNewConversation
}: SettingsScreenProps): JSX.Element {
  const statusCopy = status
    ? !status.bridgeInstalled
      ? t(status.connected ? "connectedNoBridge" : "disconnectedNoBridge")
      : status.connected
        ? t("connectedWithBridge", { version: status.bridgeVersion ?? "" })
        : t("readyWithBridge")
    : t("readingStatus");

  return (
    <div className="app-shell settings-shell">
      <header className="app-header settings-header">
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeftOutlined aria-hidden="true" /><span>{t("back")}</span>
        </button>
        <h1 ref={titleRef} tabIndex={-1}>{t("settings")}</h1>
        <span className="header-spacer" aria-hidden="true" />
      </header>
      <nav className="settings-nav" aria-label={t("settingsNavigation")}>
        <button type="button" onClick={() => onTabChange("settings")} aria-current={activeTab === "settings" ? "page" : undefined}>
          <SettingOutlined aria-hidden="true" /><span>{t("settings")}</span>
        </button>
        <button type="button" onClick={() => onTabChange("about")} aria-current={activeTab === "about" ? "page" : undefined}>
          <InfoCircleOutlined aria-hidden="true" /><span>{t("about")}</span>
        </button>
      </nav>
      <main className="settings-content">
        {notice && (
          <div className={`notice notice-${notice.kind}`}>
            <span>{notice.text}</span>
            <button type="button" onClick={onDismissNotice} aria-label={t("close")}><CloseOutlined aria-hidden="true" /></button>
          </div>
        )}
        {activeTab === "settings" ? (
          <>
            <section className="settings-card" aria-labelledby="connections-heading">
            <div className="section-heading-row">
              <h2 id="connections-heading">{t("connection")}</h2>
              <button className="text-button" type="button" onClick={onRefresh} disabled={checking || busy}>
                <ReloadOutlined aria-hidden="true" />
                {t("refresh")}
              </button>
            </div>
            <p className="section-description">{statusCopy}</p>

            <div className="source-row">
              <span className="source-icon"><CloudOutlined aria-hidden="true" /></span>
              <span className="source-copy">
                <strong>OrcaRouter</strong>
                <small>{status?.verified ? t("verified") : status?.connected ? t("unverified") : t("notConnected")}</small>
              </span>
              {!status?.connected ? (
                <button className="row-action" type="button" disabled={busy} onClick={() => onConnectionAction("auth:connect")}>
                  {t("connectOrca")}
                </button>
              ) : !status.verified ? (
                <button className="row-action" type="button" disabled={busy} onClick={() => onConnectionAction("auth:verify")}>
                  {t("verify")}
                </button>
              ) : <CheckOutlined className="row-check" aria-label={t("verified")} />}
            </div>

            <div className="source-row">
              <span className="source-icon"><CodeOutlined aria-hidden="true" /></span>
              <span className="source-copy">
                <strong>Bridge</strong>
                <small>{status?.bridgeInstalled ? status.bridgeVersion : t("unavailable")}</small>
              </span>
              <span className={`inline-status ${status?.bridgeInstalled ? "status-ready" : "status-offline"}`}>
                {status?.bridgeInstalled ? t("ready") : t("notConnected")}
              </span>
            </div>

            <div className="agent-list" aria-label={t("agentProvider")}>
              {adapters.filter((adapter) => adapter.kind === "local").map((adapter) => (
                <button
                  className={`source-row agent-row${adapter.id === selectedAgent ? " selected" : ""}`}
                  type="button"
                  key={adapter.id}
                  onClick={() => adapter.available && onSelectAgent(adapter.id)}
                  aria-pressed={adapter.id === selectedAgent}
                >
                  <span className="source-icon"><RobotOutlined aria-hidden="true" /></span>
                  <span className="source-copy">
                    <strong>{adapter.name}</strong>
                    <small>{adapter.detail || (adapter.available ? t("ready") : t("unavailable"))}</small>
                  </span>
                  <span className={`inline-status ${adapter.available ? "status-ready" : "status-offline"}`}>
                    {adapter.available ? t("ready") : t("unavailable")}
                  </span>
                </button>
              ))}
            </div>

              {status?.connected && (
              <button className="danger-text-button" type="button" disabled={busy} onClick={() => onConnectionAction("auth:disconnect")}>
                {t("disconnect")}
              </button>
            )}
          </section>

            <section className="settings-card" aria-labelledby="appearance-heading">
            <h2 id="appearance-heading">{t("appearance")}</h2>
            <label className="setting-field">
              <span>{t("theme")}</span>
              <select value={themePreference} onChange={onThemeChange}>
                <option value="system">{t("themeSystem")}</option>
                <option value="light">{t("themeLight")}</option>
                <option value="dark">{t("themeDark")}</option>
              </select>
            </label>
            <label className="setting-field">
              <span>{t("language")}</span>
              <select value={languagePreference} onChange={onLanguageChange}>
                {languageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </section>

            <section className="settings-card" aria-labelledby="conversation-heading">
              <h2 id="conversation-heading">{t("conversation")}</h2>
              <p className="section-description">{t("newConversationDescription")}</p>
              <button className="secondary-button full-width-button" type="button" onClick={onNewConversation}>
                <PlusOutlined aria-hidden="true" />{t("newConversation")}
              </button>
            </section>
          </>
        ) : (
          <>
            <section className="about-hero">
              <span className="brand-symbol" aria-hidden="true">W</span>
              <div><h2>WebAgentMate</h2><p>{t("aboutDescription")}</p></div>
            </section>
            <section className="settings-card" aria-labelledby="about-heading">
              <h2 id="about-heading">{t("about")}</h2>
              <dl className="about-list">
                <div><dt>{t("version")}</dt><dd>{extensionVersion()}</dd></div>
                <div><dt>{t("authorizationProtocol")}</dt><dd>OAuth 2.0 + PKCE (S256)</dd></div>
              </dl>
            </section>
            <section className="settings-card" aria-labelledby="privacy-heading">
              <h2 id="privacy-heading">{t("privacyTitle")}</h2>
              <p className="section-description">{t("privacyCopy")}</p>
            </section>
            <section className="settings-card" aria-labelledby="developer-heading">
              <h2 id="developer-heading">{t("developerInfo")}</h2>
              <dl className="about-list">
                <div><dt>{t("callbackUrl")}</dt><dd>{status?.callbackUrl ?? "—"}</dd></div>
              </dl>
            </section>
          </>
        )}
      </main>
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">{notice?.kind !== "error" ? notice?.text : ""}</div>
      <div className="visually-hidden" aria-live="assertive" aria-atomic="true">{notice?.kind === "error" ? notice.text : ""}</div>
    </div>
  );
}

function getHealth(status: AuthStatus | null, adapters: AgentAdapter[]): "ready" | "partial" | "offline" {
  if (!status) return "partial";
  const hasLocalAgent = status.bridgeInstalled && adapters.some((adapter) => adapter.kind === "local" && adapter.available);
  if (status.verified || hasLocalAgent) return "ready";
  if (status.connected || status.bridgeInstalled || hasLocalAgent) return "partial";
  return "offline";
}

function actionLabel(action: AgentAction): string {
  if (action.name === "scroll") return `scroll · ${action.direction}`;
  if (action.name === "finish") return "finish";
  return `${action.name} · ${action.elementId}`;
}

function adapterName(id: AgentAdapterId): string {
  if (id === "codex") return "Codex CLI";
  if (id === "claude") return "Claude Code";
  if (id === "coco") return "Coco CLI";
  return "OrcaRouter";
}

function send(request: BackgroundRequest): Promise<BackgroundResponse> {
  return chrome.runtime.sendMessage(request) as Promise<BackgroundResponse>;
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function displayError(error: unknown, t: (key: TranslationKey) => string): string {
  const raw = readableError(error).replace(/sk-orca-[A-Za-z0-9_-]+/g, "[redacted]");
  const detail = raw.includes(":") ? raw.slice(raw.indexOf(":") + 1).trim().slice(0, 240) : "";
  const summary = t(errorMessageKey(raw));
  return detail ? `${summary} (${detail})` : summary;
}

function errorMessageKey(error: string): TranslationKey {
  if (error.includes("AUTH_CANCELLED")) return "errorAuthCancelled";
  if (error.includes("AUTH_STATE_INVALID")) return "errorAuthState";
  if (error.includes("AUTH_CODE_MISSING")) return "errorAuthCode";
  if (error.includes("AUTH_EXCHANGE_FAILED")) return "errorAuthExchange";
  if (error.includes("AUTH_CREDENTIAL_REJECTED") || error.includes("AUTH_NOT_CONNECTED")) return "errorCredential";
  if (error.includes("PAGE_")) return "pageNotReady";
  if (error.includes("PROVIDER_RATE_LIMITED")) return "errorRateLimit";
  if (error.includes("PROVIDER_BALANCE_REQUIRED")) return "errorBalance";
  if (error.includes("PROVIDER_MODEL_UNAVAILABLE")) return "errorModel";
  if (error.includes("PROVIDER_FREE_PROMPT_LIMIT")) return "errorFreePrompt";
  if (error.includes("PROVIDER_FREE_UNAVAILABLE")) return "errorFreeUnavailable";
  if (error.includes("PROVIDER_ACCESS_DENIED")) return "errorAccess";
  if (error.includes("PROVIDER_") || error.includes("Failed to fetch")) return "errorProvider";
  return "errorGeneric";
}

function isLanguagePreference(value: unknown): value is LanguagePreference {
  return LANGUAGE_OPTIONS.some((option) => option.value === value);
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function isLocalAgentAdapterId(value: unknown): value is AgentAdapterId {
  return value === "codex" || value === "claude" || value === "coco";
}

function isOrcaModel(value: unknown): value is OrcaModel {
  return typeof value === "string"
    && value.length > 2
    && value.length <= 200
    && /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:/-]*$/i.test(value);
}

function mergeRemoteModels(models: RemoteModel[]): RemoteModel[] {
  const catalog = new Map<string, RemoteModel>();
  for (const model of [...FALLBACK_REMOTE_MODELS, ...models]) {
    if (isOrcaModel(model.id)) catalog.set(model.id, model);
  }
  return [...catalog.values()].sort((left, right) => {
    const preferred = (model: RemoteModel) => model.id === "orcarouter/free" ? 0 : model.free ? 1 : model.id === "orcarouter/auto" ? 2 : 3;
    const preference = preferred(left) - preferred(right);
    return preference || left.name.localeCompare(right.name);
  });
}

function modelPriceLabel(model: RemoteModel): string | undefined {
  if (model.free) return undefined;
  const prompt = formatModelPrice(model.promptPricePerMillion);
  const completion = formatModelPrice(model.completionPricePerMillion);
  return prompt || completion ? `$${prompt ?? "?"} / $${completion ?? "?"} per 1M` : undefined;
}

function formatModelPrice(value: number | undefined): string | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value);
}

function caretIsOnFirstLine(textarea: HTMLTextAreaElement): boolean {
  return !textarea.value.slice(0, textarea.selectionStart).includes("\n");
}

function caretIsOnLastLine(textarea: HTMLTextAreaElement): boolean {
  return !textarea.value.slice(textarea.selectionEnd).includes("\n");
}

function toResponseLanguage(language: SupportedLanguage): ResponseLanguage {
  const mapping: Record<SupportedLanguage, ResponseLanguage> = {
    en: "en",
    zh_CN: "zh-CN",
    zh_TW: "zh-TW",
    pt_BR: "pt-BR",
    ja: "ja",
    de: "de"
  };
  return mapping[language];
}

function extensionVersion(): string {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return "0.4.0";
  }
}

createRoot(document.getElementById("root")!).render(<Workspace />);
