import { executeBrowserTool } from "./browser-tools";
import { aborted, assertConfig, type AgentConfig, type RunContext, type Session } from "./protocol";
import { encodeRuntimeMessage, RuntimeDecoder } from "./transport";
import type { CodexRequest, EngineModel, NativeControl } from "./codex";
export type { EngineModel } from "./codex";

interface NativeOptions { codexRequest?: CodexRequest; onResult?: (result: any) => void; onControl?: (control?: NativeControl) => void }
export function runNative(session: Session, prompt: string, context: RunContext, apiKey?: string, modelsOnly = false, options: NativeOptions = {}): Promise<EngineModel[]> {
  aborted(context.signal);
  assertConfig(session.config);
  const port = chrome.runtime.connectNative("ai.webagentmate.bridge");
  const send = (params: unknown, first = false) => {
    for (const [index, frame] of encodeRuntimeMessage(params).entries()) port.postMessage({ id: crypto.randomUUID(), protocolVersion: 1, method: first && index === 0 ? "runtime.open" : "runtime.send", params: frame });
  };
  return new Promise((resolve, reject) => {
    let settled = false;
    let disconnected = false;
    let queue = Promise.resolve();
    let models: EngineModel[] = [];
    const controls = new Map<string, { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
    const control: NativeControl = (id, text) => new Promise((resolve, reject) => {
      if (settled || disconnected || context.signal.aborted) return reject(new Error("BRIDGE_DISCONNECTED"));
      if (controls.has(id)) return reject(new Error("MESSAGE_DELIVERY_IN_PROGRESS"));
      const timer = setTimeout(() => { controls.delete(id); reject(new Error("CODEX_STEER_UNCERTAIN")); }, 50_000);
      controls.set(id, { resolve, reject, timer });
      try { send({ type: "control", id, text }); } catch (error) { controls.delete(id); clearTimeout(timer); reject(error); }
    });
    const toolsController = new AbortController();
    const toolContext: RunContext = { ...context, signal: toolsController.signal };
    const decoder = new RuntimeDecoder(Date.now, error => finish(error));
    let cancelTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true; clearTimeout(cancelTimer); clearTimeout(startupTimer);
      options.onControl?.();
      for (const item of controls.values()) { clearTimeout(item.timer); item.reject(error ?? new Error("CODEX_TURN_ENDED")); }
      controls.clear();
      toolsController.abort();
      decoder.dispose();
      context.signal.removeEventListener("abort", cancel);
      try { port.disconnect(); } catch { /* already closed */ }
      if (error) reject(error); else resolve(models);
    };
    const cancel = () => {
      toolsController.abort();
      try { send({ type: "cancel" }); } catch { /* disconnected */ }
      cancelTimer = setTimeout(() => finish(new Error("RUN_CANCELLED")), 3000);
    };
    const startupTimer = setTimeout(() => finish(new Error("BRIDGE_RUNTIME_TIMEOUT")), 60_000);
    context.signal.addEventListener("abort", cancel, { once: true });
    port.onDisconnect.addListener(() => {
      let detail = chrome.runtime.lastError?.message;
      try { decoder.finish(); } catch (error) { detail = (error as Error).message; }
      disconnected = true;
      toolsController.abort();
      // A host can close after flushing done while the last IndexedDB write is
      // still pending. Preserve that ordered output before settling the run.
      queue = queue.then(() => finish(new Error(context.signal.aborted ? "RUN_CANCELLED" : detail ?? "BRIDGE_DISCONNECTED")))
        .catch(error => finish(error instanceof Error ? error : new Error(String(error))));
    });
    const reply = (value: unknown) => {
      if (settled || disconnected) return;
      try { send(value); } catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
    };
    port.onMessage.addListener((frame: unknown) => {
      let message: any;
      try { message = decoder.push(frame); } catch (error) { finish(error as Error); return; }
      if (!message) return;
      clearTimeout(startupTimer);
      queue = queue.then(async () => {
        if (settled) return;
        if (message.ok === false) throw new Error(`${message.error?.code}: ${message.error?.detail ?? ""}`);
        if (message.type === "event") { aborted(context.signal); await context.emit(message.event); }
        if (message.type === "event" && message.event.type === "native_turn") options.onControl?.(control);
        if (message.type === "codex_result") options.onResult?.(message.result);
        if (message.type === "control_reply") {
          const item = controls.get(message.id);
          if (item) { controls.delete(message.id); clearTimeout(item.timer); message.error ? item.reject(new Error(message.error)) : item.resolve(); }
        }
        if (message.type === "models") models = message.models;
        if (!disconnected && (message.type === "ask" || message.type === "browser")) {
          // Don't hold the event queue while a user decides. Other progress is still rendered.
          void (async () => {
            try {
              aborted(toolsController.signal);
              const value = message.type === "ask" ? await context.ask(message.payload) : await executeBrowserTool(message.payload.name, message.payload.args, message.payload.id, toolContext);
              aborted(toolsController.signal); reply({ type: "reply", id: message.id, value });
            } catch (error) { reply({ type: "reply", id: message.id, error: String(error) }); }
          })();
        }
        if (message.type === "done") finish(context.signal.aborted ? new Error("RUN_CANCELLED") : undefined);
        if (message.type === "error" || message.type === "cancelled") finish(new Error(message.type === "cancelled" ? "RUN_CANCELLED" : message.error));
      }).catch(error => finish(error instanceof Error ? error : new Error(String(error))));
    });
    // Older runtimes ignore codexRequest. modelsOnly makes them perform a
    // harmless catalog read, never start an unintended model turn.
    try { send({ type: "start", payload: { config: session.config, prompt, history: session.history, nativeSessionId: session.nativeSessionId, nativeForkFromId: session.nativeForkFromId, apiKey, modelsOnly: modelsOnly || !!options.codexRequest, codexRequest: options.codexRequest } }, true); }
    catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
  });
}
export async function codexRequest<T = any>(config: AgentConfig, request: CodexRequest, context: RunContext): Promise<T> {
  let result: T | undefined;
  await runNative({ config: { ...config, location: "local", engine: "codex" }, history: [] } as unknown as Session, "", context, undefined, false, { codexRequest: request, onResult: value => { result = value; } });
  if (result === undefined) throw new Error("CODEX_OPERATION_UNAVAILABLE: Update the local bridge runtime.");
  return result;
}
export async function nativeModels(config: AgentConfig, signal: AbortSignal): Promise<EngineModel[]> {
  return runNative({ config, history: [] } as unknown as Session, "", { signal, emit: async () => undefined, ask: async () => "deny" }, undefined, true);
}
