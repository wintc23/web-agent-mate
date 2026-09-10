import * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { workspaceTheme } from "./workspace-theme";
import { ExportOutlined } from "@ant-design/icons";
import { agentPageUrl, openAgentPage } from "./agent/page";
import { PlusOutlined, MenuOutlined, SettingOutlined, CloseOutlined, SendOutlined, StopOutlined, DownOutlined, CodeOutlined, CloudOutlined, InfoCircleOutlined, DeleteOutlined, EditOutlined, DownloadOutlined, ForkOutlined, ReloadOutlined, LoadingOutlined, CheckOutlined } from "@ant-design/icons";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LANGUAGE_OPTIONS, resolveLanguage, translate, type LanguagePreference, type TranslationKey } from "./locales";
import type { AuthStatus, AgentAdapter, BackgroundRequest, BackgroundResponse, RemoteModel } from "./messages";
import { DEFAULT_CONFIG, aborted, configTransition, requiresBridge, type AgentConfig, type Entry, type PermissionMode, type RunContext, type Session, type UserRequest } from "./agent/protocol";
import { enqueueMessage, takeQueuedMessage, removeQueuedMessage, preserveInterruptedReply } from "./agent/message-queue";
import { autoAllows } from "./agent/permissions";
import { SessionStore, applyEvent, claimRun, checkRun, matchesSession, reconcileSessions, LEASE_MS } from "./agent/sessions";
import { legacyOwnerIsGone, recoverRun, replyToRun, stopRun, withRunLock } from "./agent/run-coordination";
import { serializeSession } from "./agent/session-backup";
import { agentErrorText } from "./agent/error-text";
import { readProviderIssue } from "./agent/provider-error";
import { ProviderNotice } from "./provider-notice";
import { runAgent } from "./agent/runner";
import { BridgeSetup } from "./bridge-setup";
import { workspaceText, phaseText } from "./workspace-i18n";
import "./workspace.css";
import { Alert, Button, Collapse, ConfigProvider, Drawer, Dropdown, Empty, Form, Input, Modal, Segmented, Select, Space, Tooltip, Typography } from "antd";
import type { TextAreaRef } from "antd/es/input/TextArea";
import { MoreOutlined, SearchOutlined, SafetyOutlined, ThunderboltOutlined, ArrowUpOutlined } from "@ant-design/icons";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import zhTW from "antd/locale/zh_TW";
import jaJP from "antd/locale/ja_JP";
import deDE from "antd/locale/de_DE";
import ptBR from "antd/locale/pt_BR";
import { AgentAvatar, ConnectionPanel, LocalConnectionPanel, WorkspacePicker, connectionError } from "./workspace-controls";
import { SettingsSections, type SettingsTab } from "./workspace-settings";
import { AgentConfigDialog } from "./agent-config-dialog";
import { ElicitationForm } from "./elicitation-form";
import { codexThreadSeed, type NativeControl } from "./agent/codex";
import { codexText } from "./codex-i18n";

const store = new SessionStore();
const LOCAL_MODELS: RemoteModel[] = [{ id: "orcarouter/free", name: "Orca Free", free: true }, { id: "orcarouter/auto", name: "Orca Auto", free: false }];
const message = async (request: BackgroundRequest): Promise<any> => {
  const response = await chrome.runtime.sendMessage(request) as BackgroundResponse;
  if (!response?.ok) throw new Error(response?.error ?? "BACKGROUND_UNAVAILABLE");
  return response.data;
};
function download(name: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
interface Pending extends UserRequest { sessionId: string; resolve: (value: string) => void }
interface OwnedRun { id: string; sessionId: string; controller: AbortController; nextMessageId?: string; stopped?: boolean; claimed?: boolean; control?: NativeControl; steering?: boolean }
function checkLiveRun(session: Session, run: OwnedRun) {
  checkRun(session, run.id);
  if (session.activeRun!.stopRequested) {
    run.nextMessageId = session.activeRun!.nextMessageId;
    run.stopped = !run.nextMessageId;
    run.controller.abort();
  }
  aborted(run.controller.signal);
}

export function Workspace(): React.JSX.Element {
  const [pageMode] = useState(() => new URLSearchParams(location.search).get("view") === "page");
  const [openingPage, setOpeningPage] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState("");
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [managingSession, setManagingSession] = useState(false);
  const [notice, setNotice] = useState<string | { kind: "connectionRequired" }>("");
  const [settings, setSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("models");
  const [preference, setPreference] = useState<LanguagePreference>("auto");
  const [theme, setTheme] = useState("system");
  const [componentTheme, setComponentTheme] = useState(() => workspaceTheme(false));
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState(false);
  const [auth, setAuth] = useState<AuthStatus>();
  const [adapters, setAdapters] = useState<AgentAdapter[]>([]);
  const [models, setModels] = useState<RemoteModel[]>(LOCAL_MODELS);
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<AgentConfig>({ ...DEFAULT_CONFIG });
  const [pending, setPending] = useState<Pending[]>([]);
  const [answer, setAnswer] = useState("");
  const [active, setActive] = useState<string>();
  const [renameId, setRenameId] = useState("");
  const [title, setTitle] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const owner = useRef(crypto.randomUUID());
  const textarea = useRef<TextAreaRef>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const settingsTitle = useRef<HTMLHeadingElement>(null);
  const stream = useRef<HTMLElement>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [changingPermission, setChangingPermission] = useState(false);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const runRef = useRef<OwnedRun>();
  const runQueuedRef = useRef<(sessionId: string, messageId?: string) => Promise<void>>(async () => undefined);
  const sendingRef = useRef(false);
  const closingRef = useRef(false);
  const startingRef = useRef(false);
  const pendingRef = useRef<Pending[]>([]);
  const selectedRef = useRef("");
  const draftRef = useRef("");
  const savedDraftRef = useRef("");
  const syncRef = useRef<() => Promise<void>>(async () => undefined);
  const draftWrites = useRef(Promise.resolve());
  const previousDraft = useRef("");
  const language = resolveLanguage(preference);
  const t = (key: TranslationKey) => translate(language, key);
  const s = (key: Parameters<typeof workspaceText>[1]) => workspaceText(language, key);
  const c = (key: Parameters<typeof codexText>[1]) => codexText(language, key);
  const current = sessions.find(session => session.id === selected);
  const visible = sessions.filter(session => !session.archived);
  const matchedSessions = visible.filter(session => matchesSession(session, query));
  const sharedRequest = current?.activeRun?.stopRequested ? undefined : current?.activeRun?.requests?.find(item => current.activeRun?.replies?.[item.id] === undefined);
  const request = sharedRequest && current?.activeRun ? { ...sharedRequest, resolve: (value: string) => {
    const sessionId = current.id, runId = current.activeRun!.id;
    void update(sessionId, item => replyToRun(item, runId, sharedRequest.id, value), false).catch(fail);
  } } : undefined;
  const queuedMessages = current?.queuedMessages ?? [];
  const permissionMode = current?.config.permissionMode ?? "ask";
  const permissionButtonLabel = s("permissionButton").replace("{mode}", permissionMode === "auto" ? s("permissionAutomatic") : s("permissionAsk"));
  const [connectionBefore, connectionAfter] = s("connectRequired").split("{settings}");
  const history = current?.entries.filter(entry => entry.kind === "user").map(entry => entry.text) ?? [];

  const replaceSession = (next: Session) => setSessions(items => [...items.filter(item => item.id !== next.id), next].sort((a, b) => b.updatedAt - a.updatedAt));
  const update = async (id: string, mutate: (session: Session) => void, touch = true) => {
    const next = await store.update(id, mutate, touch); replaceSession(next); return next;
  };
  const fail = (error: unknown) => setNotice(String(error instanceof Error ? error.message : error));
  const openSettings = (tab: SettingsTab = "models") => { setSettingsTab(tab); setSettings(true); };
  const closeSettings = () => {
    setSettings(false);
    requestAnimationFrame(() => settingsButton.current?.focus());
  };
  const flushDraft = () => {
    const id = selectedRef.current; const value = draftRef.current;
    if (!id || value === savedDraftRef.current) return draftWrites.current;
    const previous = draftWrites.current;
    const write = (async () => {
      await previous;
      const base = savedDraftRef.current;
      let incoming: string | undefined;
      try {
        await update(id, session => {
          if (session.draft !== base && session.draft !== value) { incoming = session.draft; throw new Error(s("draftConflict")); }
          session.draft = value;
        }, false);
      } catch (error) {
        if (incoming !== undefined && selectedRef.current === id) savedDraftRef.current = incoming;
        throw error;
      }
      if (selectedRef.current === id) savedDraftRef.current = value;
    })();
    draftWrites.current = write.catch(fail);
    return write;
  };
  const select = async (session: Session) => {
    await flushDraft();
    session = await store.get(session.id);
    replaceSession(session);
    selectedRef.current = session.id; draftRef.current = session.draft; savedDraftRef.current = session.draft;
    setSelected(session.id); setDraft(session.draft); setHistoryCursor(null); setAnswer(""); setIsAtBottom(true);
    await chrome.storage.local.set({ active_session_v2: session.id });
    setSessionOpen(false); textarea.current?.focus();
  };
  const create = async () => {
    const session = await store.create(current?.config); replaceSession(session); await select(session);
  };
  const manageSession = async (action: () => Promise<void>) => {
    setSessionError(""); setManagingSession(true);
    try { await action(); }
    catch (error) {
      const code = error instanceof Error ? error.message : String(error);
      setSessionError(code === "INVALID_SESSION_BACKUP" ? s("invalidBackup") : code === "SESSION_BACKUP_TOO_LARGE" ? s("backupTooLarge") : code === "SESSION_BUSY" ? s("sessionBusy") : code);
    } finally { setManagingSession(false); }
  };
  const forkSession = async (id: string) => {
    await flushDraft();
    const session = await store.fork(id);
    replaceSession(session); await select(session); setSettings(false);
  };
  const exportSession = async (id: string) => {
    await flushDraft();
    const session = await store.get(id);
    download(`${session.title || "conversation"}.json`, serializeSession(session), "application/json");
  };
  const refresh = async () => {
    const results = await Promise.allSettled([
      (async () => setAuth(await message({ type: "auth:status" })))(),
      (async () => setAdapters((await message({ type: "agents:list" })).adapters))(),
      (async () => { const result = await message({ type: "models:list" }); setModels(result.models.length ? result.models : LOCAL_MODELS); })()
    ]);
    for (const result of results) if (result.status === "rejected") fail(result.reason);
  };
  const checkBridge = async () => {
    const results = await Promise.allSettled([
      (async () => setAuth(await message({ type: "auth:status" })))(),
      (async () => setAdapters((await message({ type: "agents:list" })).adapters))()
    ]);
    for (const result of results) if (result.status === "rejected") fail(result.reason);
  };
  useEffect(() => {
    closingRef.current = false;
    void (async () => {
      try {
        const saved = await chrome.storage.local.get(["active_session_v2", "language_preference", "theme_preference", "conversation_draft"]);
        if (LANGUAGE_OPTIONS.some(option => option.value === saved.language_preference)) setPreference(saved.language_preference);
        if (["system", "light", "dark"].includes(saved.theme_preference)) setTheme(saved.theme_preference);
        let list = await store.list();
        if (!list.some(session => !session.archived)) list = [await store.create(undefined, { draft: typeof saved.conversation_draft === "string" ? saved.conversation_draft : "" }), ...list];
        setSessions(list);
        const requestedSession = pageMode ? new URLSearchParams(location.search).get("session") : null;
        const initial = list.find(session => session.id === requestedSession && !session.archived) ?? list.find(session => session.id === saved.active_session_v2 && !session.archived) ?? list.find(session => !session.archived)!;
        selectedRef.current = initial.id; draftRef.current = initial.draft; savedDraftRef.current = initial.draft; setSelected(initial.id); setDraft(initial.draft);
        await chrome.storage.local.set({ active_session_v2: initial.id }); setReady(true);
        await refresh();
      } catch (error) { fail(error); }
    })();
    const close = () => { closingRef.current = true; runRef.current?.controller.abort(); void flushDraft().catch(fail); };
    window.addEventListener("pagehide", close);
    return () => { window.removeEventListener("pagehide", close); close(); };
  }, []);
  useEffect(() => {
    if (ready && pageMode && selected) window.history.replaceState(null, "", agentPageUrl(selected));
  }, [ready, pageMode, selected]);
  useLayoutEffect(() => {
    document.documentElement.lang = language.replace("_", "-");
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const isDark = theme === "system" ? media.matches : theme === "dark";
      document.documentElement.dataset.theme = isDark ? "dark" : "light";
      document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", isDark ? "dark" : "light");
      setComponentTheme(workspaceTheme(isDark));
    };
    apply(); media.addEventListener("change", apply); return () => media.removeEventListener("change", apply);
  }, [theme, language]);
  useEffect(() => { if (isAtBottom) stream.current?.scrollTo({ top: stream.current.scrollHeight }); }, [current?.entries, pending, selected]);
  useEffect(() => { if (settings) settingsTitle.current?.focus(); }, [settings]);
  useEffect(() => { const timer = setTimeout(() => { if (ready) void flushDraft().catch(fail); }, 200); return () => clearTimeout(timer); }, [draft, selected, ready]);
  syncRef.current = async () => {
    const selectionAtStart = selectedRef.current;
    let list = await store.list();
    const running = runRef.current;
    if (running) {
      const session = list.find(item => item.id === running.sessionId);
      if (running.claimed && session?.activeRun?.id !== running.id) running.controller.abort();
      else if (session?.activeRun?.stopRequested) { running.nextMessageId = session.activeRun.nextMessageId; running.stopped = !running.nextMessageId; running.controller.abort(); }
      else for (const question of [...pendingRef.current]) {
        const reply = session?.activeRun?.replies?.[question.id];
        if (reply !== undefined) question.resolve(reply);
      }
      if (session?.activeRun?.id === running.id && !session.activeRun.stopRequested && running.control && !running.steering) {
        const message = session.queuedMessages?.find(item => item.delivery === "steer");
        if (message) {
          running.steering = true;
          void (async () => {
            try {
              await update(session.id, item => {
                checkLiveRun(item, running);
                const queued = item.queuedMessages?.find(item => item.id === message.id);
                if (!queued || queued.delivery !== "steer") throw new Error("QUEUED_MESSAGE_NOT_FOUND");
                queued.delivery = "sending";
              }, false);
              await running.control!(message.id, message.text);
            } catch (error) {
              await update(session.id, item => {
                const queued = item.queuedMessages?.find(item => item.id === message.id);
                if (queued?.delivery === "sending") queued.delivery = "uncertain";
              }, false).catch(fail);
              if (!running.controller.signal.aborted) fail(error);
            } finally { running.steering = false; }
          })();
        }
      }
    }
    const abandoned = list.filter(item => item.activeRun && item.id !== running?.sessionId);
    const legacyGone = abandoned.some(item => !item.activeRun?.coordinated) && await legacyOwnerIsGone();
    for (const item of abandoned) await recoverRun(store, item, s("restartNotice"), legacyGone);
    if (abandoned.length) list = await store.list();
    if (closingRef.current || selectionAtStart !== selectedRef.current) return;
    setSessions(previous => reconcileSessions(previous, list));
    const selectedSession = list.find(item => item.id === selectedRef.current && !item.archived);
    if (selectedSession) {
      if (draftRef.current === savedDraftRef.current && selectedSession.draft !== savedDraftRef.current) {
        draftRef.current = selectedSession.draft; savedDraftRef.current = selectedSession.draft; setDraft(selectedSession.draft);
      }
    } else {
      const next = list.find(item => !item.archived) ?? await store.create();
      selectedRef.current = ""; await select(next);
    }
  };
  useEffect(() => {
    if (!ready) return;
    let disposed = false, syncing = false, dirty = false;
    const reload = () => {
      dirty = true;
      if (syncing) return;
      syncing = true;
      void (async () => {
        try { while (dirty && !disposed) { dirty = false; await syncRef.current(); } }
        catch (error) { if (!disposed) fail(error); }
        finally { syncing = false; }
      })();
    };
    let scheduled: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = store.subscribe(() => {
      if (!scheduled) scheduled = setTimeout(() => { scheduled = undefined; reload(); }, 30);
    });
    // Notifications synchronize live changes; polling also detects a crashed panel.
    const timer = setInterval(reload, 1000);
    window.addEventListener("focus", reload); reload();
    return () => { disposed = true; unsubscribe(); clearInterval(timer); clearTimeout(scheduled); window.removeEventListener("focus", reload); };
  }, [ready]);

  const ask: RunContext["ask"] = async (question) => {
    const running = runRef.current;
    if (!running) throw new Error("RUN_CANCELLED");
    aborted(running.controller.signal);
    const session = await store.get(running.sessionId);
    aborted(running.controller.signal);
    if (autoAllows(session.config.permissionMode, question)) {
      await update(session.id, item => { checkRun(item, running.id); item.entries.push({ id: crypto.randomUUID(), kind: "notice", text: `${s("autoApproved")}: ${question.title}`, status: "completed" }); });
      aborted(running.controller.signal);
      return "allow";
    }
    return new Promise<string>((resolve, reject) => {
      const id = crypto.randomUUID();
      const remove = () => { pendingRef.current = pendingRef.current.filter(item => item.id !== id); setPending([...pendingRef.current]); };
      const cancel = () => { remove(); reject(new Error("RUN_CANCELLED")); };
      const entry: Pending = { ...question, id, sessionId: running.sessionId, resolve: value => {
        remove();
        void (async () => {
          try {
            await update(running.sessionId, item => {
              checkRun(item, running.id); aborted(running.controller.signal);
              if (item.activeRun!.stopRequested) throw new Error("RUN_CANCELLED");
              item.activeRun!.requests = item.activeRun!.requests?.filter(request => request.id !== id);
              delete item.activeRun!.replies?.[id];
            }, false);
            aborted(running.controller.signal); resolve(value);
          } catch (error) { reject(error); }
          finally { running.controller.signal.removeEventListener("abort", cancel); }
        })();
      } };
      running.controller.signal.addEventListener("abort", cancel, { once: true });
      pendingRef.current.push(entry); setPending([...pendingRef.current]);
      void update(running.sessionId, item => {
        checkRun(item, running.id); aborted(running.controller.signal);
        (item.activeRun!.requests ??= []).push({ ...question, id });
      }, false).catch(error => { running.controller.signal.removeEventListener("abort", cancel); remove(); reject(error); });
    });
  };
  const executeQueued = async (sessionId: string, messageId: string | undefined, coordinated: boolean): Promise<boolean | string> => {
    if (runRef.current || closingRef.current) return false;
    const run: OwnedRun = { id: crypto.randomUUID(), sessionId, controller: new AbortController() };
    runRef.current = run; setActive(sessionId); setNotice(""); setIsAtBottom(true);
    let claimed = false;
    let completed = false;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let timedOut = false;
    const limit = setTimeout(() => { timedOut = true; run.controller.abort(); }, 15 * 60_000);
    try {
      let text = "";
      const session = await update(sessionId, item => {
        aborted(run.controller.signal);
        if (coordinated && item.activeRun?.coordinated) { preserveInterruptedReply(item); item.activeRun = undefined; }
        claimRun(item, run.id, owner.current);
        item.activeRun!.coordinated = coordinated;
        text = takeQueuedMessage(item, messageId).text;
      });
      claimed = true;
      run.claimed = true;
      if (session.config.engine !== "claude") clearTimeout(limit);
      heartbeat = setInterval(() => { void update(session.id, item => { checkRun(item, run.id); if (item.activeRun!.stopRequested) { run.nextMessageId = item.activeRun!.nextMessageId; run.stopped = !run.nextMessageId; run.controller.abort(); } item.activeRun!.heartbeat = Date.now(); }, false).catch(() => run.controller.abort()); }, 10_000);
      const context: RunContext = { signal: run.controller.signal, ask,
        emit: async event => { aborted(run.controller.signal); await update(session.id, item => { checkLiveRun(item, run); applyEvent(item, event); }); } };
      const credentials = session.config.engine === "builtin" ? await chrome.storage.local.get("orcarouter_api_key") : {};
      const apiKey = credentials.orcarouter_api_key;
      const catalog = models.find(model => model.id === session.config.model);
      session.config = { ...session.config, contextLength: catalog?.contextLength, supportsVision: catalog?.supportsVision, supportsTools: catalog?.supportsTools };
      await runAgent(session, text, context, apiKey, { onControl: control => { run.control = control; } });
      await update(session.id, item => { checkLiveRun(item, run); item.activeRun = undefined; for (const message of item.queuedMessages ?? []) if (message.delivery === "sending") message.delivery = "uncertain"; for (const entry of item.entries) if (entry.status === "running") entry.status = entry.kind === "tool" ? "interrupted" : "completed"; });
      completed = true;
    } catch (error) {
      const text = timedOut ? agentErrorText(language, "RUN_TIME_LIMIT") : run.controller.signal.aborted ? s(run.nextMessageId ? "redirected" : "stopped") : agentErrorText(language, error);
      const providerIssue = !timedOut && !run.controller.signal.aborted ? readProviderIssue(error) : undefined;
      if (claimed) await update(run.sessionId, item => {
        checkRun(item, run.id); item.activeRun = undefined;
        for (const message of item.queuedMessages ?? []) if (message.delivery === "sending") message.delivery = "uncertain";
        preserveInterruptedReply(item);
        for (const entry of item.entries) if (entry.status === "running") entry.status = "interrupted";
        item.entries.push({ id: crypto.randomUUID(), kind: "notice", text, providerIssue, status: run.controller.signal.aborted ? "interrupted" : "failed" });
      }).catch(error => { if (!String(error).includes("RUN_OWNERSHIP_LOST")) fail(error); });
      else fail(text.includes("SESSION_BUSY") ? s("sessionBusy") : text);
    } finally {
      clearInterval(heartbeat); clearTimeout(limit);
      run.controller.abort(); if (runRef.current === run) runRef.current = undefined;
      setActive(undefined);
      if (!closingRef.current && selectedRef.current === sessionId) textarea.current?.focus();
    }
    // Only this live runner continues its queue. Opening a panel or recovering a
    // crashed run never silently executes saved messages.
    if (!closingRef.current && !run.stopped && (completed || run.nextMessageId)) {
      const latest = await store.get(sessionId).catch(() => undefined);
      const nextId = run.nextMessageId;
      if (latest?.queuedMessages?.some(item => nextId ? item.id === nextId : !item.delivery)) return nextId ?? true;
    }
    return false;
  };
  const runQueued = async (sessionId: string, messageId?: string) => {
    if (startingRef.current || runRef.current || closingRef.current) return;
    startingRef.current = true;
    try {
      let next = messageId;
      while (!closingRef.current) {
        const followup = await withRunLock(sessionId, coordinated => executeQueued(sessionId, next, coordinated));
        if (!followup) break;
        next = typeof followup === "string" ? followup : undefined;
      }
    } finally { startingRef.current = false; }
  };
  runQueuedRef.current = runQueued;
  const submit = async (value = draft, immediately = false) => {
    if (!current || !ready || !value.trim() || sendingRef.current) return;
    if (value.trim().length > 50_000) { setNotice(s("messageTooLong")); return; }
    if (requiresBridge(current.config) && !auth?.runtimeV2) { setNotice(s("bridgeRequired")); return; }
    if (current.config.engine === "builtin" && !auth?.connected) { setNotice({ kind: "connectionRequired" }); return; }
    const sessionId = current.id;
    sendingRef.current = true; setSending(true);
    let queuedId: string | undefined;
    try {
      await flushDraft();
      await update(sessionId, item => {
        const queued = enqueueMessage(item, value);
        queuedId = queued.id;
        if (immediately && item.config.engine === "codex" && item.activeRun?.nativeTurnId && !item.activeRun.stopRequested) queued.delivery = "steer";
        if (selectedRef.current === sessionId && draftRef.current === value) item.draft = "";
      });
      if (selectedRef.current === sessionId && draftRef.current === value) { draftRef.current = ""; savedDraftRef.current = ""; setDraft(""); setHistoryCursor(null); }
    } catch (error) { setNotice(String(error).includes("MESSAGE_QUEUE_FULL") ? s("queueFull") : agentErrorText(language, error)); }
    finally { sendingRef.current = false; setSending(false); }
    if (!queuedId) return;
    const latest = await store.get(sessionId);
    if (immediately && latest.activeRun && latest.config.engine !== "codex") await update(sessionId, item => stopRun(item, latest.activeRun!.id, queuedId), false);
    else if (!latest.activeRun && !runRef.current) void runQueuedRef.current(sessionId).catch(fail);
  };
  const sendQueuedNow = async (messageId: string) => {
    if (!current) return;
    const latest = await store.get(current.id);
    if (latest.activeRun && latest.config.engine === "codex") await update(current.id, item => {
      checkRun(item, latest.activeRun!.id);
      const queued = item.queuedMessages?.find(item => item.id === messageId);
      if (!queued || queued.delivery === "sending") return;
      if (!item.activeRun!.nativeTurnId || item.activeRun!.stopRequested) throw new Error("CODEX_TURN_NOT_ACTIVE");
      queued.delivery = "steer";
    }, false);
    else if (latest.activeRun) await update(current.id, item => stopRun(item, latest.activeRun!.id, messageId), false);
    else if (!runRef.current) void runQueuedRef.current(current.id, messageId).catch(fail);
  };
  const editQueued = async (messageId: string) => {
    if (!current) return;
    const sessionId = current.id;
    await flushDraft();
    const next = await update(sessionId, item => {
      const message = removeQueuedMessage(item, messageId);
      item.draft = [item.draft, message.text].filter(Boolean).join("\n\n");
    });
    if (selectedRef.current === sessionId) { draftRef.current = next.draft; savedDraftRef.current = next.draft; setDraft(next.draft); textarea.current?.focus(); }
  };
  const changePermission = async (mode: PermissionMode) => {
    if (!current || changingPermission) return;
    const sessionId = current.id;
    setChangingPermission(true);
    try {
      await update(sessionId, item => {
        item.config.permissionMode = mode;
        const run = item.activeRun;
        if (!run || run.stopRequested) return;
        for (const question of run.requests ?? []) if (autoAllows(mode, question) && run.replies?.[question.id] === undefined) {
          replyToRun(item, run.id, question.id, "allow");
          item.entries.push({ id: crypto.randomUUID(), kind: "notice", text: `${s("autoApproved")}: ${question.title}`, status: "completed" });
        }
      });
    } catch (error) { fail(error); }
    finally { setChangingPermission(false); }
  };
  const openConfig = () => { if (!current) return; setConfig({ ...current.config }); setConfigOpen(true); };
  const persistConfig = async (next: AgentConfig) => {
    if (!current) return;
    if (current.activeRun) throw new Error(s("sessionBusy"));
    next = configTransition(current.config, next);
    const changeEngine = current.config.engine !== next.engine || current.config.location !== next.location || current.config.workspace !== next.workspace;
    if (changeEngine && current.entries.length) {
      await flushDraft();
      const session = await store.fork(current.id, next);
      replaceSession(session); await select(session);
    } else await update(current.id, item => { item.config = { ...next }; });
  };
  const recover = async () => {
    if (!current) return;
    await recoverRun(store, await store.get(current.id), s("restartNotice"), await legacyOwnerIsGone());
    await syncRef.current();
  };
  const stopCurrent = async () => {
    if (!current?.activeRun) { runRef.current?.controller.abort(); return; }
    const latest = await store.get(current.id);
    if (latest.activeRun?.id !== current.activeRun.id) { replaceSession(latest); return; }
    await update(current.id, item => stopRun(item, current.activeRun!.id), false);
    if (runRef.current?.sessionId === current.id) { runRef.current.stopped = true; runRef.current.nextMessageId = undefined; runRef.current.controller.abort(); }
    await recover();
  };
  const onKey = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    const input = event.currentTarget;
    if (input.selectionStart === input.selectionEnd && history.length && !event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
      if (event.key === "ArrowUp" && !input.value.slice(0, input.selectionStart).includes("\n")) {
        event.preventDefault(); if (historyCursor === null) previousDraft.current = draft;
        const next = Math.max(0, (historyCursor ?? history.length) - 1); setHistoryCursor(next); setDraft(history[next]); draftRef.current = history[next]; return;
      }
      if (event.key === "ArrowDown" && !input.value.slice(input.selectionEnd).includes("\n") && historyCursor !== null) {
        event.preventDefault(); const next = historyCursor + 1; const value = next >= history.length ? previousDraft.current : history[next];
        setHistoryCursor(next >= history.length ? null : next); setDraft(value); draftRef.current = value; return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(draft, event.ctrlKey || event.metaKey); }
  };
  const authAction = async (type: "auth:connect" | "auth:disconnect" | "auth:verify"): Promise<boolean> => {
    setBusy(true); setAuthError(""); setAuthSuccess(false);
    try {
      const result = await message({ type });
      setAuth(type === "auth:verify" ? await message({ type: "auth:status" }) : result);
      setAuthSuccess(type !== "auth:disconnect");
      if (type !== "auth:disconnect") setNotice(previous => typeof previous === "string" ? previous : "");
      return true;
    }
    catch (error) { setAuthError(connectionError(error, language)); return false; }
    finally { setBusy(false); }
  };
  const removeSession = async () => {
    try {
      await flushDraft(); await store.delete(deleteId); const list = await store.list(); setSessions(list);
      if (selected === deleteId) { const next = list.find(session => !session.archived) ?? await store.create(); replaceSession(next); selectedRef.current = ""; await select(next); }
      setDeleteOpen(false);
    } catch (error) { fail(error); }
  };
  const recentWorkspaces = [...new Set(visible.map(session => session.config.workspace).filter(Boolean))];
  const openPage = async () => {
    if (!selectedRef.current || openingPage) return;
    setOpeningPage(true);
    try { await flushDraft(); await openAgentPage(selectedRef.current); }
    catch (error) { fail(error); }
    finally { setOpeningPage(false); }
  };
  const header = <header className="ws-header"><div className="ws-header-left"><Tooltip title={s("sessions")}><Button type="text" icon={<MenuOutlined />} aria-label={s("sessions")} aria-expanded={sessionOpen} onClick={() => setSessionOpen(true)} /></Tooltip><AgentAvatar engine={current?.config.engine} /><strong title={current?.title}>{current?.title || "WebAgentMate"}</strong></div><Space size={0}>{!pageMode && <Tooltip title={s("openInPage")}><Button type="text" icon={<ExportOutlined />} aria-label={s("openInPage")} disabled={!ready} loading={openingPage} onClick={() => void openPage()} /></Tooltip>}<Tooltip title={t("newConversation")}><Button type="text" icon={<PlusOutlined />} aria-label={t("newConversation")} onClick={() => void create().catch(fail)} /></Tooltip><Tooltip title={t("settings")}><Button ref={settingsButton} type="text" icon={<SettingOutlined />} aria-label={t("settings")} onClick={() => openSettings()} /></Tooltip></Space></header>;

  return <ConfigProvider locale={{ en: enUS, zh_CN: zhCN, zh_TW: zhTW, ja: jaJP, de: deDE, pt_BR: ptBR }[language]} theme={componentTheme}>
    <div className={`ws-shell${pageMode ? " ws-page" : ""}${settings ? " ws-settings-open" : ""}`}>
    {settings ? <>
      <header className="ws-settings-header"><div><SettingOutlined aria-hidden="true" /><h1 ref={settingsTitle} tabIndex={-1} className="ws-settings-title">{t("settings")}</h1></div><Space size={2}>
        <Tooltip title={t("refresh")}><Button type="text" size="small" icon={<ReloadOutlined aria-hidden="true" />} loading={busy} aria-label={t("refresh")} onClick={() => void refresh()} /></Tooltip>
        <Tooltip title={t("back")}><Button type="text" size="small" icon={<CloseOutlined aria-hidden="true" />} aria-label={t("back")} onClick={closeSettings} /></Tooltip>
      </Space></header>
        <SettingsSections activeKey={settingsTab} onChange={setSettingsTab} label={t("settingsNavigation")} items={[
          { key: "models", label: s("settingsModels"), icon: <CloudOutlined aria-hidden="true" />, children: <>
            {authError && <Alert showIcon closable type="error" message={authError} onClose={() => setAuthError("")} />}
            {authSuccess && <Alert showIcon closable type="success" message={s("connectionSaved")} onClose={() => setAuthSuccess(false)} />}
            <ConnectionPanel auth={auth} busy={busy} onAction={authAction} s={s} labels={{ connect: t("connectOrca"), affiliateDisclosure: t("orcaAffiliateDisclosure"), verify: t("verify"), disconnect: t("disconnect"), connected: t("connected"), notConnected: t("notConnected") }} />
          </> },
          { key: "local", label: s("settingsLocal"), icon: <CodeOutlined aria-hidden="true" />, children: <LocalConnectionPanel language={language} auth={auth} adapters={adapters} onCheckBridge={checkBridge} s={s} labels={{ ready: t("ready"), unavailable: t("unavailable") }} /> },
          { key: "general", label: s("settingsGeneral"), icon: <SettingOutlined aria-hidden="true" />, children: <div className="ws-settings-card ws-appearance">
            <div className="ws-settings-row"><label htmlFor="settings-language">{t("language")}</label><Select id="settings-language" value={preference} options={LANGUAGE_OPTIONS.map(option => ({ value: option.value, label: option.label }))} onChange={value => { setPreference(value); void chrome.storage.local.set({ language_preference: value }); }} /></div>
            <div className="ws-settings-row"><span id="settings-theme-label">{t("theme")}</span><Segmented block aria-labelledby="settings-theme-label" value={theme} options={[{ value: "system", label: t("themeSystem") }, { value: "light", label: t("themeLight") }, { value: "dark", label: t("themeDark") }]} onChange={value => { setTheme(value); void chrome.storage.local.set({ theme_preference: value }); }} /></div>
          </div> },
          { key: "about", label: t("about"), icon: <InfoCircleOutlined aria-hidden="true" />, children: <>
            <section className="ws-about"><div className="ws-about-heading"><AgentAvatar size={38} /><div><h3>WebAgentMate</h3><small>{t("version")} {chrome.runtime.getManifest().version}</small></div></div><p>{t("aboutDescription")}</p>
              <Space wrap><Typography.Link href="https://github.com/wintc23/web-agent-mate" target="_blank" rel="noopener noreferrer">{s("projectLink")}</Typography.Link><Typography.Link href="https://github.com/wintc23/web-agent-mate/blob/main/PRIVACY.md" target="_blank" rel="noopener noreferrer">{s("privacyLink")}</Typography.Link></Space>
            </section>
            <section className="ws-settings-card ws-settings-privacy"><h3>{t("privacyTitle")}</h3><p>{t("privacyCopy")}</p></section>
          </> }
        ]} />
    </> : <>
      {header}
      <main className="ws-stream" ref={stream} onScroll={() => { const el = stream.current!; setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80); }} aria-label={t("conversation")}>
        {!current?.entries.length && <div className="ws-welcome"><AgentAvatar engine={current?.config.engine} size={52} /><h1>{t("welcomeTitle")}</h1><p>{t("welcomeBody")}</p></div>}
        {current?.entries.map(entry => {
          const issue = entry.kind === "notice" ? entry.providerIssue ?? readProviderIssue(entry.text) : undefined;
          return issue ? <ProviderNotice key={entry.id} issue={issue} language={language} actionable={current.entries.at(-1)?.id === entry.id && !current.activeRun && !active && !sending} onRetry={() => void submit(s("continue"))} onModel={openConfig} onConnection={() => openSettings("models")} onShorter={() => void create().catch(fail)} /> : <Message key={entry.id} entry={entry} engine={current.config.engine} detailsLabel={s("tools")} downloadLabel={s("artifact")} codexLabel={name => ["plan", "fileDiff", "reasoningSummary", "contextCompaction", "nativeSettings"].includes(name) ? c(name as Parameters<typeof c>[0]) : name} />;
        })}
        {current?.activeRun && active !== current.id && <Alert type="info" showIcon message={s(current.activeRun.coordinated ? "sessionSynced" : "checkingRun")} />}
        {(current?.activeRun || active === current?.id) && current && !request && <div className="ws-working" role="status"><AgentAvatar engine={current.config.engine} size={26} /><LoadingOutlined /> {current.activeRun?.stopRequested ? s("stopping") : current.activeRun?.phase ? phaseText(language, current.activeRun.phase) : s("running")}</div>}
        {request && <section className="ws-request" aria-label={request.kind === "approval" ? s("approval") : s("question")}><strong>{request.kind === "approval" ? s("approval") : s("question")}</strong><p>{request.title}</p>{request.detail && <Collapse ghost size="small" items={[{ key: "detail", label: s("tools"), children: <pre>{request.detail}</pre> }]} />}
          {request.kind === "elicitation" ? <ElicitationForm key={request.id} request={request} language={language} resolve={request.resolve} /> : request.kind === "approval" ? <Space wrap><Button type="primary" onClick={() => request.resolve("allow")}>{s("allow")}</Button><Button onClick={() => request.resolve("deny")}>{s("deny")}</Button></Space> : <form onSubmit={event => { event.preventDefault(); if (answer.trim()) { request.resolve(answer.trim()); setAnswer(""); } }}><Space wrap>{request.options?.map(option => <Button key={option} onClick={() => request.resolve(option)}>{option}</Button>)}</Space><Form.Item label={s("reply")}><Input.TextArea aria-label={s("reply")} value={answer} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setAnswer(event.target.value)} /></Form.Item><Button type="primary" htmlType="submit" disabled={!answer.trim()}>{s("reply")}</Button></form>}
        </section>}
      </main>
      <footer className="ws-composer-dock">
        {current?.config.engine === "codex" && current.codexUsage && <small className="ws-codex-usage">{c("usage")}: {current.codexUsage.total.totalTokens.toLocaleString()} · {c("context")}: {current.codexUsage.last.totalTokens.toLocaleString()}{current.codexUsage.modelContextWindow ? ` / ${current.codexUsage.modelContextWindow.toLocaleString()}` : ""}</small>}
        {!isAtBottom && <Button className="ws-latest" size="small" onClick={() => { setIsAtBottom(true); stream.current?.scrollTo({ top: stream.current.scrollHeight }); }}>{t("backToLatest")} ↓</Button>}
        {notice && <Alert className="ws-composer-notice" role="status" type="info" showIcon closable message={typeof notice === "string" ? notice : <>{connectionBefore}<button type="button" className="ws-inline-settings" onClick={() => openSettings("models")}>{t("settings")}</button>{connectionAfter}</>} onClose={() => setNotice("")} />}
        {current && requiresBridge(current.config) && !auth?.runtimeV2 && <div className="ws-composer-notice"><BridgeSetup s={s} language={language} onCheck={checkBridge} /></div>}
        {active && active !== selected && <Button type="text" block onClick={() => { const session = sessions.find(item => item.id === active); if (session) void select(session); }}>{s("workingElsewhere")} ↗</Button>}
        {queuedMessages.length > 0 && <section className="ws-queue" aria-label={s("queuedMessages")}>
          <div className="ws-queue-heading"><strong>{s("queuedMessages")} · {queuedMessages.length}</strong><span>{current?.activeRun ? s("queueHint") : s("queuePaused")}</span></div>
          <ol>{queuedMessages.map(message => <li key={message.id}><p>{message.text}{message.delivery && <small>{c(message.delivery === "uncertain" ? "uncertain" : message.delivery === "sending" ? "delivering" : "requested")}</small>}</p><Space size={0}>
            <Tooltip title={current?.activeRun ? current.config.engine === "codex" ? c("steer") : s("interruptSend") : s("sendNow")}><Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={message.delivery === "sending" || Boolean(active && active !== selected)} aria-label={current?.activeRun ? current.config.engine === "codex" ? c("steer") : s("interruptSend") : s("sendNow")} onClick={() => void sendQueuedNow(message.id).catch(fail)} /></Tooltip>
            <Tooltip title={s("editQueued")}><Button size="small" type="text" icon={<EditOutlined />} disabled={message.delivery === "sending" && !!current?.activeRun} aria-label={s("editQueued")} onClick={() => void editQueued(message.id).catch(fail)} /></Tooltip>
            <Tooltip title={s("removeQueued")}><Button size="small" type="text" icon={<CloseOutlined />} disabled={message.delivery === "sending" && !!current?.activeRun} aria-label={s("removeQueued")} onClick={() => { if (current) void update(current.id, item => { removeQueuedMessage(item, message.id); }).catch(fail); }} /></Tooltip>
          </Space></li>)}</ol>
        </section>}
        <form className="ws-composer" onSubmit={event => { event.preventDefault(); void submit(); }}>
          <Input.TextArea ref={textarea} variant="borderless" aria-label={t("agentPlaceholder")} placeholder={t("agentPlaceholder")} value={draft} autoSize={{ minRows: 3, maxRows: 9 }} disabled={!ready} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => { setDraft(event.target.value); draftRef.current = event.target.value; setHistoryCursor(null); }} onKeyDown={onKey} />
          <div className="ws-composer-bottom"><div className="ws-composer-selectors"><Button type="text" size="small" className="ws-route" disabled={!current || Boolean(current.activeRun)} onClick={openConfig} title={t("switchModel")} icon={<CodeOutlined />}><span>{current?.config.engine === "builtin" ? current.config.model : current?.config.engine === "codex" ? "Codex" : "Claude"}</span><DownOutlined /></Button>
          {current && requiresBridge(current.config) && <WorkspacePicker value={current.config.workspace} recent={recentWorkspaces} disabled={!!current.activeRun} available={!!auth?.runtimeV2} onChange={path => persistConfig({ ...current.config, workspace: path })} s={s} />}
          <Dropdown trigger={["click"]} open={permissionOpen} onOpenChange={setPermissionOpen} menu={{ selectable: true, selectedKeys: [permissionMode], items: [{ type: "group", label: s("permissionMode"), children: [
            { key: "ask", icon: <SafetyOutlined />, label: <div className="ws-permission-option"><strong>{s("permissionAsk")}</strong><small>{s("permissionAskHint")}</small></div> },
            { key: "auto", icon: <ThunderboltOutlined />, label: <div className="ws-permission-option"><strong>{s("permissionAuto")}</strong><small>{s("permissionAutoHint")}</small></div> }
          ] }], onClick: ({ key }) => { setPermissionOpen(false); void changePermission(key as PermissionMode); } }}><Button type="text" size="small" className={`ws-permission ${permissionMode === "auto" ? "is-auto" : ""}`} icon={<SafetyOutlined aria-hidden="true" />} aria-haspopup="menu" aria-expanded={permissionOpen} title={s(permissionMode === "auto" ? "permissionAutoHint" : "permissionAskHint")} disabled={!current || changingPermission}>{permissionButtonLabel}<DownOutlined aria-hidden="true" /></Button></Dropdown>
          </div><Space size={4}>
          {current?.config.engine === "codex" && current.activeRun?.nativeTurnId && <Tooltip title={c("steer")}><Button type="text" icon={<ArrowUpOutlined />} aria-label={c("steer")} disabled={!draft.trim() || sending || current.activeRun.stopRequested} onClick={() => void submit(draft, true)} /></Tooltip>}
          {(current?.activeRun || active === selected) && <Button htmlType="button" className="ws-stop" aria-label={t("cancelAgent")} title={t("cancelAgent")} icon={<StopOutlined />} disabled={current?.activeRun?.stopRequested} onClick={() => void stopCurrent().catch(fail)} />}
          <Button type="primary" htmlType="submit" className="ws-send" aria-label={s(active || current?.activeRun ? "enqueue" : "sendMessage")} title={s(active || current?.activeRun ? "enqueue" : "sendMessage")} icon={<SendOutlined />} loading={sending} disabled={!ready || !draft.trim()} />
          </Space></div>
        </form><small className="ws-input-hint">{current?.activeRun && current.config.engine === "codex" ? c("steerHint") : s(current?.activeRun ? "queueInputHint" : "inputHint")}</small>
      </footer>
    </>}
    <Drawer title={s("sessions")} placement="left" open={sessionOpen} onClose={() => setSessionOpen(false)} width="min(360px, calc(100vw - 28px))" rootClassName="ws-session-drawer">
      <div className="ws-session-toolbar"><Button type="primary" block icon={<PlusOutlined />} disabled={managingSession} onClick={() => void manageSession(create)}>{t("newConversation")}</Button></div>
      <Input allowClear prefix={<SearchOutlined />} aria-label={s("search")} placeholder={s("search")} value={query} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} />
      {sessionError && <Alert showIcon type="error" message={sessionError} />}
      {matchedSessions.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={s("empty")} />}
      <ul className="ws-session-list">{matchedSessions.map(session => <li key={session.id} className={selected === session.id ? "selected" : ""}>
        <Button type="text" className="ws-session-select" aria-current={selected === session.id ? "true" : undefined} disabled={managingSession} onClick={() => void manageSession(async () => { await select(session); setSettings(false); })}>
          <AgentAvatar engine={session.config.engine} size={24} /><span className="ws-session-description"><span className="ws-session-title"><strong title={session.title || t("newConversation")}>{session.title || t("newConversation")}</strong>{session.parentSessionId && <Tooltip title={`${s("branch")}: ${visible.find(parent => parent.id === session.parentSessionId)?.title || "—"}`}><ForkOutlined aria-label={`${s("branch")}: ${visible.find(parent => parent.id === session.parentSessionId)?.title || "—"}`} /></Tooltip>}</span><small>{session.config.engine === "builtin" ? session.config.model : session.config.engine} · {new Date(session.updatedAt).toLocaleDateString(language.replace("_", "-"))}{session.activeRun ? ` · ${s(session.activeRun.coordinated || Date.now() - session.activeRun.heartbeat < LEASE_MS ? "running" : "interrupted")}` : ""}</small></span>
        </Button>
        <Dropdown trigger={["click"]} menu={{ items: [{ key: "fork", label: s("fork"), icon: <ForkOutlined />, disabled: managingSession || !!(session.activeRun && (session.activeRun.coordinated || Date.now() - session.activeRun.heartbeat < LEASE_MS)) }, { key: "rename", label: s("rename"), icon: <EditOutlined /> }, { key: "export", label: s("export"), icon: <DownloadOutlined />, disabled: managingSession }, { type: "divider" }, { key: "remove", label: s("remove"), icon: <DeleteOutlined />, danger: true, disabled: !!(session.activeRun && (session.activeRun.coordinated || Date.now() - session.activeRun.heartbeat < LEASE_MS)) }], onClick: ({ key }) => { if (key === "fork") void manageSession(() => forkSession(session.id)); if (key === "export") void manageSession(() => exportSession(session.id)); if (key === "rename") { setRenameId(session.id); setTitle(session.title); setRenameOpen(true); } if (key === "remove") { setDeleteId(session.id); setDeleteOpen(true); } } }}><Button type="text" className="ws-session-more" icon={<MoreOutlined />} aria-label={`${s("actions")} ${session.title || t("newConversation")}`} /></Dropdown>
      </li>)}</ul>
    </Drawer>
    <Modal title={s("rename")} open={renameOpen} onCancel={() => setRenameOpen(false)} onOk={() => void update(renameId, session => { session.title = title.trim(); }).then(() => setRenameOpen(false)).catch(fail)} okButtonProps={{ disabled: !title.trim() }} okText={s("save")} cancelText={s("cancel")} zIndex={1100} className="ws-modal"><Form layout="vertical" component={false}><Form.Item label={s("title")}><Input autoFocus aria-label={s("title")} maxLength={120} value={title} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setTitle(event.target.value)} onPressEnter={() => { if (title.trim()) void update(renameId, session => { session.title = title.trim(); }).then(() => setRenameOpen(false)).catch(fail); }} /></Form.Item></Form></Modal>
    <Modal title={s("remove")} open={deleteOpen} onCancel={() => setDeleteOpen(false)} onOk={removeSession} okButtonProps={{ danger: true }} okText={s("remove")} cancelText={s("cancel")} zIndex={1100} className="ws-modal"><p>{s("deleteConfirm")}</p></Modal>
    <AgentConfigDialog open={configOpen} config={config} onChange={setConfig} onClose={() => setConfigOpen(false)} onSave={persistConfig}
      language={language} models={models} recentWorkspaces={recentWorkspaces} bridgeReady={!!auth?.runtimeV2} checkBridge={checkBridge}
      running={!!current?.activeRun} hasHistory={!!current?.entries.length}
      onImport={async thread => {
        await flushDraft();
        const session = await store.create(undefined, codexThreadSeed(thread, config));
        replaceSession(session); await select(session);
      }}
      onUseSkill={async skill => {
        await persistConfig(config);
        const value = `${draftRef.current}${draftRef.current ? "\n" : ""}$${skill.name} `;
        draftRef.current = value; setDraft(value); await flushDraft();
      }} />
    </div>
  </ConfigProvider>;
}

function Message({ entry, engine, detailsLabel, downloadLabel, codexLabel }: { entry: Entry; engine: AgentConfig["engine"]; detailsLabel: string; downloadLabel: string; codexLabel: (name: string) => string }) {
  if (entry.kind === "tool") {
    let document: { filename: string; content: string } | undefined;
    if ((entry.name ?? "").endsWith("create_document") && entry.status === "completed") { try { document = JSON.parse(entry.text); } catch { /* not a document */ } }
    return <div className={`ws-tool ${entry.status}`}><Collapse ghost size="small" items={[{ key: entry.id, label: <Space size={6}>{entry.status === "running" ? <LoadingOutlined /> : entry.status === "completed" ? <CheckOutlined /> : <CloseOutlined />}<span>{entry.name ? codexLabel(entry.name) : detailsLabel}</span></Space>, children: <>{entry.args !== undefined && <pre>{JSON.stringify(entry.args, null, 2)}</pre>}<pre>{entry.text}</pre></> }]} />{document?.filename && typeof document.content === "string" && <Button size="small" icon={<DownloadOutlined />} onClick={() => download(document!.filename, document!.content)}>{downloadLabel}</Button>}</div>;
  }
  return <article className={`ws-message ws-${entry.kind} ${entry.status}`}>
    {entry.kind === "assistant" && <AgentAvatar engine={engine} />}
    <div className="ws-markdown"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{ a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>, img: ({ alt }) => <span>{alt}</span> }}>{entry.text}</Markdown></div>
  </article>;
}
