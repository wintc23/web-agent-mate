import type {
  AgentAction,
  AgentAdapter,
  AgentAdapterId,
  AgentResult,
  AuthStatus,
  BackgroundRequest,
  BackgroundResponse,
  ChatMessage,
  OrcaModel,
  PageContext,
  RemoteModel,
  ResponseLanguage,
  RunPortRequest,
  RunPortResponse
} from "./messages";
import { parseOrcaCallback, orcaKeyFromExchange, validateOrcaKey } from "./orca-auth";
import { orcaFailure } from "./agent/provider-error";

const ORCA_AUTH_URL = "https://www.orcarouter.ai/auth";
const ORCA_TOKEN_URL = "https://www.orcarouter.ai/api/v1/auth/keys";
const ORCA_DISCOVERY_URL = "https://www.orcarouter.ai/.well-known/openid-configuration";
const ORCA_MODELS_URL = "https://api.orcarouter.ai/v1/models";
const ORCA_KEY_CHECK_URL = "https://api.orcarouter.ai/v1/generation?id=webagentmate-connection-check";
const ORCA_DEFAULT_MODEL: OrcaModel = "orcarouter/free";
const STORAGE_KEY = "orcarouter_api_key";
const VERIFIED_AT_KEY = "orcarouter_verified_at";
const NATIVE_HOST = "ai.webagentmate.bridge";
const NATIVE_PROTOCOL_VERSION = 1;
const NATIVE_TIMEOUT_MS = 3000;
const NETWORK_TIMEOUT_MS = 15000;

interface NativeResponse<T = unknown> {
  id: string;
  ok: boolean;
  result?: T;
  error?: { code?: string; detail?: string };
}

type AgentTaskStatus = AgentResult["status"];

interface AgentTaskState {
  taskId: string;
  goal: string;
  pageUrl: string;
  adapter: AgentAdapterId;
  status: AgentTaskStatus;
  stepCount: number;
  maxSteps: number;
  history: ChatMessage[];
  conversationId?: string;
}

const AGENT_TASK_STORAGE_PREFIX = "agent_task:";

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  void restrictStorageAccess();
});
chrome.runtime.onStartup.addListener(() => void restrictStorageAccess());
void restrictStorageAccess();

chrome.runtime.onMessage.addListener(
  (request: BackgroundRequest, _sender, sendResponse: (response: BackgroundResponse) => void) => {
    void (async () => {
      try {
        sendResponse(await handleMessage(request));
      } catch (error) {
        sendResponse({ ok: false, error: readableError(error) });
      }
    })();
    return true;
  }
);

interface ActivePortRun {
  requestId: string;
  controller: AbortController;
  cancelled: boolean;
  taskId?: string;
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "webagentmate-run") return;

  let active: ActivePortRun | undefined;
  let connected = true;

  const post = (message: RunPortResponse) => {
    if (!connected) return;
    try {
      port.postMessage(message);
    } catch {
      // The side panel can close while a request is being cancelled.
    }
  };

  const cancelActive = async (requestId?: string) => {
    const current = active;
    if (!current || (requestId && current.requestId !== requestId)) return;
    current.cancelled = true;
    current.controller.abort();
    if (current.taskId) {
      try {
        await cancelAgentTask(current.taskId);
      } catch {
        // The running branch still rejects late actions after the abort signal.
      }
    }
  };

  port.onMessage.addListener((rawMessage: unknown) => {
    const message = rawMessage as RunPortRequest;
    if (message.type === "run:cancel") {
      void cancelActive(message.requestId);
      return;
    }
    if (active) {
      post({ type: "run:error", requestId: message.requestId, error: "RUN_ALREADY_ACTIVE" });
      return;
    }

    const current: ActivePortRun = {
      requestId: message.requestId,
      controller: new AbortController(),
      cancelled: false,
      taskId: message.type === "run:agent:approve" ? message.taskId : undefined
    };
    active = current;
    post({ type: "run:started", requestId: message.requestId, taskId: current.taskId });

    void (async () => {
      try {
        if (message.type === "run:agent") {
          if (message.location !== "local" || message.adapter === "orcarouter") throw new Error("LOCAL_ENGINE_REQUIRES_BRIDGE");
          const data = await startAgent(
            message.goal,
            message.adapter,
            message.model,
            message.responseLanguage,
            message.history,
            message.conversationId,
            current.controller.signal,
            (taskId) => {
              current.taskId = taskId;
              post({ type: "run:started", requestId: message.requestId, taskId });
            }
          );
          if (current.cancelled) throw new Error("RUN_CANCELLED");
          post({ type: "run:result", requestId: message.requestId, kind: "agent", data });
          return;
        }
        const data = await approveAgent(
          message.taskId,
          message.action,
          message.model,
          message.responseLanguage,
          current.controller.signal
        );
        if (current.cancelled) throw new Error("RUN_CANCELLED");
        post({ type: "run:result", requestId: message.requestId, kind: "agent", data });
      } catch (error) {
        if (current.cancelled || current.controller.signal.aborted || readableError(error).includes("AGENT_CANCELLED")) {
          post({ type: "run:cancelled", requestId: message.requestId });
        } else {
          post({ type: "run:error", requestId: message.requestId, error: readableError(error) });
        }
      } finally {
        if (active === current) active = undefined;
      }
    })();
  });

  port.onDisconnect.addListener(() => {
    connected = false;
    void cancelActive();
  });
});

async function handleMessage(request: BackgroundRequest): Promise<BackgroundResponse> {
  switch (request.type) {
    case "auth:status":
      return { ok: true, data: await getStatus() };
    case "auth:connect":
      await connect();
      return { ok: true, data: await getStatus() };
    case "auth:key": {
      const key = validateOrcaKey(request.key);
      await verifyConnection(key);
      await chrome.storage.local.set({ [STORAGE_KEY]: key, [VERIFIED_AT_KEY]: Date.now() });
      return { ok: true, data: await getStatus() };
    }
    case "auth:disconnect":
      await chrome.storage.local.remove([STORAGE_KEY, VERIFIED_AT_KEY]);
      return { ok: true, data: await getStatus() };
    case "auth:verify": {
      const modelCount = await verifyConnection();
      await chrome.storage.local.set({ [VERIFIED_AT_KEY]: Date.now() });
      return { ok: true, data: { modelCount } };
    }
    case "page:extract":
      return { ok: true, data: await extractCurrentPage() };
    case "models:list":
      return { ok: true, data: { models: await listRemoteModels() } };
    case "agents:list":
      return { ok: true, data: { adapters: await listAgentAdapters() } };
    case "workspace:list":
      return { ok: true, data: await callNative<import("./messages").WorkspaceDirectory>("workspace.list", { path: request.path ?? "", offset: request.offset ?? 0 }) };
    case "agent:start":
      return { ok: true, data: await startAgent(request.goal, request.adapter, request.model, request.responseLanguage, []) };
    case "agent:approve":
      return { ok: true, data: await approveAgent(request.taskId, request.action, request.model, request.responseLanguage) };
    case "agent:cancel":
      await cancelAgentTask(request.taskId);
      return { ok: true, data: { taskId: request.taskId, status: "cancelled", message: "Task cancelled", stepCount: 0 } };
  }
}

async function listAgentAdapters(): Promise<AgentAdapter[]> {
  try {
    const result = await callNative<{ adapters: AgentAdapter[] }>("agents.adapters");
    return result.adapters;
  } catch {
    return (["codex", "claude", "coco"] as AgentAdapterId[]).map((id) => ({
      id, name: id === "codex" ? "Codex CLI" : id === "claude" ? "Claude Code" : "Coco CLI",
      kind: "local" as const, available: false, detail: "Bridge unavailable"
    }));
  }
}

async function listRemoteModels(): Promise<RemoteModel[]> {
  const response = await fetchWithTimeout(ORCA_MODELS_URL, {});
  if (!response.ok) throw await providerError(response);
  const payload = await response.json() as { data?: unknown[] };
  if (!Array.isArray(payload.data)) throw new Error("PROVIDER_RESPONSE_INVALID");
  const models = payload.data.flatMap((value): RemoteModel[] => {
    if (!value || typeof value !== "object") return [];
    const item = value as Record<string, unknown>;
    if (typeof item.id !== "string" || !isRemoteModelId(item.id)) return [];
    const endpoints = Array.isArray(item.supported_endpoint_types)
      ? item.supported_endpoint_types.filter((entry): entry is string => typeof entry === "string")
      : [];
    const architecture = item.architecture && typeof item.architecture === "object"
      ? item.architecture as Record<string, unknown>
      : undefined;
    const rawOutputModalities = architecture?.output_modalities;
    const outputModalities = Array.isArray(rawOutputModalities)
      ? rawOutputModalities.filter((entry): entry is string => typeof entry === "string")
      : [];
    const free = isFreeCatalogModel(item.id, item.pricing);
    if (!free && endpoints.length > 0 && !endpoints.includes("openai")) return [];
    if (outputModalities.length > 0 && !outputModalities.includes("text")) return [];
    const pricing = item.pricing && typeof item.pricing === "object"
      ? item.pricing as Record<string, unknown>
      : undefined;
    return [{
      id: item.id,
      name: typeof item.name === "string" && item.name.trim() ? item.name.trim().slice(0, 160) : modelName(item.id),
      free,
      promptPricePerMillion: numericPrice(pricing?.prompt_per_million),
      completionPricePerMillion: numericPrice(pricing?.completion_per_million),
      contextLength: typeof item.context_length === "number" ? item.context_length : undefined,
      supportsVision: Array.isArray(architecture?.input_modalities) ? architecture.input_modalities.includes("image") : undefined,
      supportsTools: Array.isArray(item.supported_parameters) ? item.supported_parameters.includes("tools") : undefined
    }];
  });
  return models.sort((left, right) => {
    if (left.id === ORCA_DEFAULT_MODEL) return -1;
    if (right.id === ORCA_DEFAULT_MODEL) return 1;
    if (left.id === "orcarouter/auto") return left.free === right.free ? -1 : 1;
    if (right.id === "orcarouter/auto") return left.free === right.free ? 1 : -1;
    if (left.free !== right.free) return left.free ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
}

function agentTaskStorageKey(taskId: string): string {
  return `${AGENT_TASK_STORAGE_PREFIX}${taskId}`;
}

async function saveAgentTask(task: AgentTaskState): Promise<void> {
  await chrome.storage.session.set({ [agentTaskStorageKey(task.taskId)]: task });
}

async function storedAgentTask(taskId: string): Promise<AgentTaskState | undefined> {
  const key = agentTaskStorageKey(taskId);
  const stored = await chrome.storage.session.get(key);
  const value = stored[key];
  if (!value || typeof value !== "object") return undefined;
  return value as AgentTaskState;
}

async function createAgentTask(
  goal: string,
  pageUrl: string,
  adapter: AgentAdapterId,
  history: ChatMessage[],
  conversationId?: string
): Promise<AgentTaskState> {
  const taskId = adapter === "orcarouter"
    ? crypto.randomUUID()
    : (await callNative<{ taskId: string }>("agents.start", { goal, pageUrl, adapter })).taskId;
  const task: AgentTaskState = {
    taskId,
    goal,
    pageUrl,
    adapter,
    status: "running",
    stepCount: 0,
    maxSteps: 12,
    history: history.slice(-12),
    conversationId
  };
  await saveAgentTask(task);
  return task;
}

async function readAgentTask(taskId: string): Promise<AgentTaskState> {
  const stored = await storedAgentTask(taskId);
  if (!stored) throw new Error("AGENT_TASK_NOT_FOUND");
  if (stored.adapter === "orcarouter") throw new Error("LOCAL_ENGINE_REQUIRES_BRIDGE");
  const native = await callNative<Pick<AgentTaskState, "status" | "stepCount" | "maxSteps">>("agents.status", { taskId });
  const current = { ...stored, ...native };
  await saveAgentTask(current);
  return current;
}

async function recordAgentStep(
  taskId: string,
  action: AgentAction,
  result: string,
  status: Exclude<AgentTaskStatus, "cancelled">
): Promise<AgentTaskState> {
  const task = await readAgentTask(taskId);
  if (task.status === "cancelled") throw new Error("AGENT_CANCELLED");
  if (task.stepCount >= task.maxSteps) throw new Error("AGENT_STEP_LIMIT");
  if (task.adapter !== "orcarouter") {
    await callNative("agents.record_step", {
      taskId,
      action: JSON.stringify(action),
      result,
      status
    });
  }
  const updated: AgentTaskState = {
    ...task,
    status,
    stepCount: task.stepCount + 1
  };
  await saveAgentTask(updated);
  return updated;
}

async function cancelAgentTask(taskId: string): Promise<void> {
  const task = await storedAgentTask(taskId);
  if (!task) {
    await callNative("agents.cancel", { taskId });
    return;
  }
  if (task.adapter !== "orcarouter") {
    await callNative("agents.cancel", { taskId });
  }
  await saveAgentTask({ ...task, status: "cancelled" });
}

async function startAgent(
  goal: string,
  adapter: AgentAdapterId,
  model: OrcaModel = ORCA_DEFAULT_MODEL,
  responseLanguage: ResponseLanguage = "en",
  history: ChatMessage[] = [],
  conversationId?: string,
  signal?: AbortSignal,
  onTaskStarted?: (taskId: string) => void
): Promise<AgentResult> {
  if (!goal.trim()) throw new Error("AGENT_GOAL_REQUIRED");
  if (!isAgentAdapterId(adapter)) throw new Error("AGENT_ADAPTER_INVALID");
  if (adapter === "orcarouter") throw new Error("LOCAL_ENGINE_REQUIRES_BRIDGE");
  throwIfAborted(signal);
  const page = await observePage();
  throwIfAborted(signal);
  const task = await createAgentTask(goal.trim(), page.url, adapter, history, conversationId);
  onTaskStarted?.(task.taskId);
  if (signal?.aborted) {
    await cancelAgentTask(task.taskId);
    throw new Error("RUN_CANCELLED");
  }
  return runBuiltInAgent(task.taskId, goal.trim(), "Task started", adapter, model, responseLanguage, history, signal);
}

async function approveAgent(
  taskId: string,
  action: AgentAction,
  model: OrcaModel = ORCA_DEFAULT_MODEL,
  responseLanguage: ResponseLanguage = "en",
  signal?: AbortSignal
): Promise<AgentResult> {
  if (action.name === "finish") throw new Error("AGENT_ACTION_INVALID");
  throwIfAborted(signal);
  const task = await readAgentTask(taskId);
  if (task.status === "cancelled") throw new Error("RUN_CANCELLED");
  const outcome = await executePageAction(action);
  throwIfAborted(signal);
  await recordAgentStep(taskId, action, outcome, "running");
  return runBuiltInAgent(taskId, task.goal, outcome, task.adapter, model, responseLanguage, task.history, signal);
}

async function runBuiltInAgent(
  taskId: string,
  goal: string,
  previousResult: string,
  adapter: AgentAdapterId,
  model: OrcaModel,
  responseLanguage: ResponseLanguage,
  history: ChatMessage[],
  signal?: AbortSignal
): Promise<AgentResult> {
  for (let localStep = 0; localStep < 12; localStep += 1) {
    throwIfAborted(signal);
    const state = await readAgentTask(taskId);
    if (state.status === "cancelled") throw new Error("RUN_CANCELLED");
    if (state.stepCount >= state.maxSteps) throw new Error("AGENT_STEP_LIMIT");
    const observation = await observePage();
    throwIfAborted(signal);
    const action = await planAgentAction(goal, observation, previousResult, adapter, taskId, model, responseLanguage, history, signal);
    throwIfAborted(signal);
    if (action.name === "finish") {
      const completed = await recordAgentStep(taskId, action, action.summary, "completed");
      return { taskId, status: "completed", message: action.summary, stepCount: completed.stepCount, conversationId: state.conversationId };
    }
    if (requiresApproval(action)) {
      const waiting = await recordAgentStep(taskId, action, "Waiting for user approval", "waiting_approval");
      return { taskId, status: "waiting_approval", message: action.reason, action, stepCount: waiting.stepCount, conversationId: state.conversationId };
    }
    previousResult = await executePageAction(action);
    await recordAgentStep(taskId, action, previousResult, "running");
  }
  throw new Error("AGENT_STEP_LIMIT");
}

function requiresApproval(action: AgentAction): boolean {
  return action.name === "click";
}

interface PageObservation {
  title: string;
  url: string;
  text: string;
  elements: Array<{ id: string; tag: string; role: string; label: string; type: string; value: string; disabled: boolean }>;
}

async function observePage(): Promise<PageObservation> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("PAGE_UNAVAILABLE");
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const selector = "a[href],button,input,textarea,select,[role='button'],[contenteditable='true']";
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      }).slice(0, 120);
      const elements = nodes.map((node, index) => {
        const id = `wam-${index}`;
        node.dataset.webagentmateId = id;
        const input = node as HTMLInputElement;
        const label = node.getAttribute("aria-label") || node.getAttribute("title") ||
          (input.labels?.[0]?.innerText) || node.innerText || input.placeholder || input.name || "";
        return { id, tag: node.tagName.toLowerCase(), role: node.getAttribute("role") || "", label: label.trim().slice(0, 200), type: input.type || "", value: input.value?.slice(0, 200) || "", disabled: Boolean(input.disabled) };
      });
      return { title: document.title, url: location.href, text: document.body.innerText.slice(0, 20_000), elements };
    }
  });
  if (!injection?.result) throw new Error("PAGE_UNAVAILABLE");
  return injection.result;
}

async function planAgentAction(
  goal: string,
  observation: PageObservation,
  previousResult: string,
  adapter: AgentAdapterId,
  taskId: string,
  model: OrcaModel,
  responseLanguage: ResponseLanguage,
  history: ChatMessage[],
  signal?: AbortSignal
): Promise<AgentAction> {
  if (adapter === "orcarouter") throw new Error("LOCAL_ENGINE_REQUIRES_BRIDGE");
  const result = await callNative<{ content: string }>("agents.plan_local", {
    adapter, goal, previousResult, page: observation, taskId, responseLanguage, history: history.slice(-12)
  });
  throwIfAborted(signal);
  return parseAgentAction(result.content, observation);
}

function parseAgentAction(raw: string, observation: PageObservation): AgentAction {
  let parsed: unknown;
  try { parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { throw new Error("AGENT_RESPONSE_INVALID"); }
  return validateAgentAction(parsed, observation);
}

function validateAgentAction(value: unknown, observation: PageObservation): AgentAction {
  if (!value || typeof value !== "object") throw new Error("AGENT_ACTION_INVALID");
  const item = value as Record<string, unknown>;
  const name = item.name;
  const reason = typeof item.reason === "string" ? item.reason.slice(0, 500) : "Agent action";
  if (name === "finish" && typeof item.summary === "string") return { name, summary: item.summary.slice(0, 4000), reason };
  if (name === "scroll" && (item.direction === "up" || item.direction === "down")) return { name, direction: item.direction, reason };
  if ((name === "click" || name === "fill" || name === "select") && typeof item.elementId === "string") {
    const target = observation.elements.find((element) => element.id === item.elementId && !element.disabled);
    if (!target) throw new Error("AGENT_TARGET_INVALID");
    if (/password|credit|card|cvv|captcha|otp|verification|身份证|银行卡|验证码/i.test(`${target.type} ${target.label}`)) throw new Error("AGENT_SENSITIVE_TARGET");
    if (name === "click") return { name, elementId: item.elementId, reason };
    if (typeof item.value !== "string" || item.value.length > 5000) throw new Error("AGENT_VALUE_INVALID");
    return { name, elementId: item.elementId, value: item.value, reason } as AgentAction;
  }
  throw new Error("AGENT_ACTION_INVALID");
}

async function executePageAction(action: Exclude<AgentAction, { name: "finish" }>): Promise<string> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("PAGE_UNAVAILABLE");
  const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, args: [action], func: (next) => {
    if (next.name === "scroll") { window.scrollBy({ top: next.direction === "down" ? innerHeight * 0.8 : -innerHeight * 0.8, behavior: "smooth" }); return "Page scrolled"; }
    const node = document.querySelector<HTMLElement>(`[data-webagentmate-id="${CSS.escape(next.elementId)}"]`);
    if (!node) throw new Error("Target changed or disappeared");
    node.scrollIntoView({ block: "center", behavior: "smooth" });
    node.style.outline = "3px solid #147a4c";
    if (next.name === "click") { node.click(); return "Element clicked"; }
    const control = node as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    control.focus();
    const prototype = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(control, next.value); else control.value = next.value;
    control.dispatchEvent(new Event("input", { bubbles: true })); control.dispatchEvent(new Event("change", { bubbles: true }));
    return next.name === "select" ? "Option selected" : "Field filled";
  }});
  return injection?.result || "Action completed";
}

async function extractCurrentPage(): Promise<PageContext> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("PAGE_UNAVAILABLE");
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const selection = globalThis.getSelection?.()?.toString().trim() ?? "";
      const root = document.querySelector("article, main, [role='main']") ?? document.body;
      const clone = root.cloneNode(true) as HTMLElement;
      for (const node of clone.querySelectorAll("script, style, nav, footer, aside, noscript, svg")) node.remove();
      const text = (clone.innerText || clone.textContent || "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 60_000);
      return { title: document.title, url: location.href, text, selection };
    }
  });
  if (!result?.result?.text) throw new Error("PAGE_EMPTY");
  return result.result;
}

async function getStatus(): Promise<AuthStatus> {
  const callbackUrl = chrome.identity.getRedirectURL("orcarouter");
  const stored = await chrome.storage.local.get([STORAGE_KEY, VERIFIED_AT_KEY]);
  const connected = typeof stored[STORAGE_KEY] === "string" && stored[STORAGE_KEY].length > 0;
  const verified = connected && typeof stored[VERIFIED_AT_KEY] === "number";
  try {
    const hello = await callNative<{ version: string; runtimeV2?: boolean }>("bridge.hello");
    return {
      bridgeInstalled: true,
      bridgeVersion: hello.version,
      runtimeV2: hello.runtimeV2,
      connected,
      verified,
      callbackUrl
    };
  } catch {
    // A missing or unreachable host is a displayable state, not a broken side panel.
  }
  return {
    bridgeInstalled: false,
    connected,
    verified,
    callbackUrl
  };
}

async function connect(): Promise<void> {
  const callbackUrl = chrome.identity.getRedirectURL("orcarouter");
  const verifier = randomBase64Url(32);
  const challenge = await sha256Base64Url(verifier);
  const state = randomBase64Url(24);

  const endpoints = await discoverOAuthEndpoints();
  const authorizationUrl = new URL(endpoints.authorizationEndpoint);
  authorizationUrl.searchParams.set("callback_url", callbackUrl);
  authorizationUrl.searchParams.set("code_challenge", challenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("app_name", "WebAgentMate");
  authorizationUrl.searchParams.set("scope", "api");

  let redirectedTo: string | undefined;
  try {
    redirectedTo = await chrome.identity.launchWebAuthFlow({
      url: authorizationUrl.toString(),
      interactive: true
    });
  } catch (error) {
    throw new Error(`AUTH_WINDOW_FAILED:${readableError(error)}`);
  }

  if (!redirectedTo) throw new Error("AUTH_CANCELLED");

  const code = parseOrcaCallback(redirectedTo, callbackUrl, state);

  const response = await fetchWithTimeout(endpoints.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, code_verifier: verifier })
  });

  const payload = (await response.json().catch(() => null)) as
    | { key?: unknown; scope?: unknown; error?: unknown; message?: unknown }
    | null;

  if (!response.ok) {
    const detail = payload?.message ?? payload?.error ?? `HTTP ${response.status}`;
    throw new Error(`AUTH_EXCHANGE_FAILED:${String(detail)}`);
  }
  const key = orcaKeyFromExchange(payload);
  // A successful PKCE exchange already authenticates the new key. Do not lose
  // that single-use grant if an unrelated model catalog request is unavailable.
  await chrome.storage.local.set({ [STORAGE_KEY]: key, [VERIFIED_AT_KEY]: Date.now() });
}

async function discoverOAuthEndpoints(): Promise<{ authorizationEndpoint: string; tokenEndpoint: string }> {
  const response = await fetchWithTimeout(ORCA_DISCOVERY_URL, {});
  if (!response.ok) throw await providerError(response);
  const payload = await response.json() as { authorization_endpoint?: unknown; token_endpoint?: unknown };
  return {
    authorizationEndpoint: secureOrcaEndpoint(payload.authorization_endpoint, ORCA_AUTH_URL),
    tokenEndpoint: secureOrcaEndpoint(payload.token_endpoint, ORCA_TOKEN_URL)
  };
}

async function verifyConnection(key?: string): Promise<number> {
  const stored = key ? null : await chrome.storage.local.get(STORAGE_KEY);
  const apiKey = key ?? stored?.[STORAGE_KEY];
  if (typeof apiKey !== "string") throw new Error("AUTH_NOT_CONNECTED");
  const keyCheck = await fetchWithTimeout(ORCA_KEY_CHECK_URL, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  if (keyCheck.status !== 404 && !keyCheck.ok) throw await providerError(keyCheck);
  // The public catalog is independent of credential validity.
  return 0;
}

async function restrictStorageAccess(): Promise<void> {
  await Promise.all([
    chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }),
    chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })
  ]);
}

async function callNative<T = Record<string, unknown>>(
  method: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const id = crypto.randomUUID();
  let response: NativeResponse<T>;
  try {
    response = (await withTimeout(
      chrome.runtime.sendNativeMessage(NATIVE_HOST, {
        id,
        protocolVersion: NATIVE_PROTOCOL_VERSION,
        method,
        params
      }) as Promise<NativeResponse<T>>,
      method === "agents.plan_local" || method === "chats.complete_local" ? 125_000 : NATIVE_TIMEOUT_MS,
      "BRIDGE_TIMEOUT"
    )) as NativeResponse<T>;
  } catch (error) {
    throw new Error(`无法连接 WebAgentMate Bridge：${readableError(error)}`);
  }
  if (!response || response.id !== id) throw new Error("Bridge 返回了无效响应");
  if (!response.ok) {
    throw new Error(`${response.error?.code ?? "BRIDGE_REQUEST_FAILED"}:${response.error?.detail ?? ""}`);
  }
  if (response.result === undefined) throw new Error("Bridge 响应缺少结果");
  return response.result;
}

async function providerError(response: Response): Promise<Error> {
  if (response.status === 401) return new Error("AUTH_CREDENTIAL_REJECTED");
  return orcaFailure(response.status, await response.text().catch(() => ""), response.headers.get("Retry-After"));
}

function secureOrcaEndpoint(value: unknown, fallback: string): string {
  const url = new URL(typeof value === "string" ? value : fallback);
  if (url.hostname !== "www.orcarouter.ai" || url.port || url.username || url.password) {
    throw new Error("AUTH_DISCOVERY_INVALID");
  }
  if (url.protocol === "http:") url.protocol = "https:";
  if (url.protocol !== "https:") throw new Error("AUTH_DISCOVERY_INVALID");
  return url.toString();
}

function isRemoteModelId(value: string): boolean {
  return value.length <= 200 && /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value) && !value.includes("://");
}

function isAgentAdapterId(value: string): value is AgentAdapterId {
  return value === "orcarouter" || value === "codex" || value === "claude" || value === "coco";
}

function isFreeModelId(id: string): boolean {
  return id === "orcarouter/free" || id.endsWith("-free");
}

function isFreeCatalogModel(id: string, value: unknown): boolean {
  if (isFreeModelId(id)) return true;
  if (!value || typeof value !== "object") return false;
  const pricing = value as Record<string, unknown>;
  const knownPrices = [pricing.request, pricing.prompt, pricing.completion]
    .filter((price) => price !== undefined)
    .map(numericPrice);
  return knownPrices.length > 0 && knownPrices.every((price) => price === 0);
}

function numericPrice(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function modelName(id: string): string {
  if (id === "orcarouter/free") return "Orca Free";
  if (id === "orcarouter/auto") return "Orca Auto";
  return id;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  externalSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  const abortFromExternal = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (externalSignal?.aborted) throw new Error("RUN_CANCELLED");
    if (controller.signal.aborted) throw new Error("PROVIDER_TIMEOUT");
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("RUN_CANCELLED");
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, code: string): Promise<T> {
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = globalThis.setTimeout(() => reject(new Error(code)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) globalThis.clearTimeout(timer);
  }
}

function randomBase64Url(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return bytesToBase64Url(bytes);
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function readableError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
