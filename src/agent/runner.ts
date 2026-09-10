import { BROWSER_TOOLS, executeBrowserTool } from "./browser-tools";
import { runBuiltin } from "./loop";
import { runNative } from "./native";
import { aborted, assertConfig, builtinStepLimit, requiresBridge, type RunContext, type Session } from "./protocol";
import type { NativeControl } from "./codex";

// The owning extension page manages cancellation, approvals and checkpoints.
// Browser mode never connects to the native host or exposes file/shell tools.
export async function runAgent(session: Session, prompt: string, context: RunContext, apiKey?: string,
  options: { onControl?: (control?: NativeControl) => void; fetcher?: typeof fetch } = {}): Promise<void> {
  aborted(context.signal);
  assertConfig(session.config);
  if (requiresBridge(session.config)) {
    await runNative(session, prompt, context, apiKey, false, { onControl: options.onControl });
    return;
  }
  if (!apiKey?.trim()) throw new Error("ORCA_NOT_CONNECTED");
  await runBuiltin({
    apiKey, model: session.config.model, prompt, history: session.history,
    tools: BROWSER_TOOLS, maxSteps: builtinStepLimit(session.config), context,
    contextLength: session.config.contextLength, supportsVision: session.config.supportsVision,
    supportsTools: session.config.supportsTools, fetcher: options.fetcher,
    execute: (name, args, id) => executeBrowserTool(name, args, id, context)
  });
}
