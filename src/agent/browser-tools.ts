import { aborted, type RunContext, type ToolDefinition, type ToolOutput } from "./protocol";
import { validateToolArguments } from "./schema";

const str = { type: "string" };
const num = { type: "integer" };
export function defineTool(name: string, description: string, properties: Record<string, unknown>, required: string[] = []): ToolDefinition {
  return { name, description, parameters: { type: "object", properties, required, additionalProperties: false } };
}
export const BROWSER_TOOLS: ToolDefinition[] = [
  defineTool("browser_tabs", "List open HTTP(S) tabs, titles and IDs. Choose the relevant tab explicitly.", {}),
  defineTool("browser_read", "Read visible page text and stable element IDs from a tab. Use offset to read a long page. No passwords or field values are returned.", { tabId: num, offset: num }, ["tabId"]),
  defineTool("browser_navigate", "Navigate an existing tab or open a new HTTP(S) tab. Navigation requires user approval.", { url: str, tabId: num }, ["url"]),
  defineTool("browser_act", "Operate an element from browser_read. A click/fill/select requires approval. snapshot and elementId must match the latest read; stale targets fail. Password/payment/file fields are blocked.", { tabId: num, snapshot: str, action: { enum: ["click", "fill", "select", "scroll"] }, elementId: str, value: str, direction: { enum: ["up", "down"] } }, ["tabId", "snapshot", "action"]),
  defineTool("browser_screenshot", "Capture the visible region of the active tab, after approval. Requires a vision-capable model to interpret the returned image.", { tabId: num }, ["tabId"]),
  defineTool("browser_wait", "Wait briefly before checking a dynamic page again (maximum 5 seconds).", { milliseconds: num }, ["milliseconds"]),
  defineTool("ask_user", "Ask a necessary clarifying question and wait for a reply. Do not ask the user to choose answering versus acting.", { question: str }, ["question"]),
  defineTool("update_plan", "Show a short task plan or progress update in the conversation.", { plan: str }, ["plan"]),
  defineTool("create_document", "Create a downloadable text/Markdown/CSV artifact in the conversation. Does not write to disk automatically.", { filename: str, content: str }, ["filename", "content"])
];

function textArg(args: Record<string, unknown>, name: string, max = 40_000): string {
  if (typeof args[name] !== "string" || (args[name] as string).length > max) throw new Error(`Invalid ${name}`);
  return args[name] as string;
}
function tabId(args: Record<string, unknown>): number {
  if (!Number.isInteger(args.tabId) || Number(args.tabId) < 0) throw new Error("Invalid tabId");
  return Number(args.tabId);
}
export function safeUrl(value: string): string {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Only HTTP(S) URLs without embedded credentials are allowed");
  return url.href;
}

export async function executeBrowserTool(name: string, args: Record<string, unknown>, id: string, context: RunContext): Promise<ToolOutput> {
  aborted(context.signal);
  validateToolArguments(BROWSER_TOOLS, name, args);
  const approval = async (detail: string) => {
    const answer = await context.ask({ id, kind: "approval", title: name, detail });
    aborted(context.signal);
    if (answer !== "allow") throw new Error("User denied this operation. Do not try another route to perform it.");
  };
  if (name === "ask_user") return { text: await context.ask({ id, kind: "question", title: textArg(args, "question", 4000), detail: "" }) };
  if (name === "update_plan") return { text: textArg(args, "plan", 4000) };
  if (name === "create_document") return { text: JSON.stringify({ filename: textArg(args, "filename", 180).replace(/[\\/]/g, "_"), content: textArg(args, "content") }) };
  if (name === "browser_tabs") {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    return { text: JSON.stringify(tabs.filter(tab => /^https?:/.test(tab.url ?? "")).map(tab => ({ id: tab.id, title: tab.title, url: tab.url, active: tab.active }))) };
  }
  if (name === "browser_wait") {
    const ms = Number(args.milliseconds);
    if (!Number.isFinite(ms) || ms < 0 || ms > 5000) throw new Error("Wait must be between 0 and 5000 ms");
    await new Promise<void>((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); reject(new Error("RUN_CANCELLED")); };
      const timer = setTimeout(() => { context.signal.removeEventListener("abort", cancel); resolve(); }, ms);
      context.signal.addEventListener("abort", cancel, { once: true });
    });
    return { text: "Wait completed. Read the page to observe its current state." };
  }
  if (name === "browser_navigate") {
    const url = safeUrl(textArg(args, "url", 8192));
    await approval(JSON.stringify({ url, tabId: args.tabId }));
    const tab = args.tabId === undefined ? await chrome.tabs.create({ url }) : await chrome.tabs.update(tabId(args), { url });
    return { text: JSON.stringify({ tabId: tab.id, url, status: "Navigation requested; read the page to verify completion." }) };
  }
  const target = await chrome.tabs.get(tabId(args));
  safeUrl(target.url ?? "");
  if (name === "browser_screenshot") {
    if (!target.active) throw new Error("Only the active tab can be captured");
    await approval(`Capture visible page: ${target.url}`);
    const active = (await chrome.tabs.query({ active: true, windowId: target.windowId }))[0];
    if (active?.id !== target.id || active.url !== target.url) throw new Error("Active tab changed; request a fresh screenshot");
    return { text: `Screenshot of ${target.url}`, image: await chrome.tabs.captureVisibleTab(target.windowId, { format: "jpeg", quality: 35 }) };
  }
  if (name === "browser_read") {
    const offset = Number(args.offset ?? 0);
    if (!Number.isInteger(offset) || offset < 0) throw new Error("Invalid text offset");
    const snapshot = crypto.randomUUID();
    const [result] = await chrome.scripting.executeScript({ target: { tabId: target.id! }, func: readPageSnapshot, args: [snapshot, offset] });
    if (!result?.result) throw new Error("Page unavailable");
    return { text: JSON.stringify(result.result) };
  }
  if (name === "browser_act") {
    if (!["click", "fill", "select", "scroll"].includes(String(args.action))) throw new Error("Invalid browser action");
    textArg(args, "snapshot", 100);
    if (args.action !== "scroll") {
      const [preview] = await chrome.scripting.executeScript({ target: { tabId: target.id! }, func: pageAction, args: [args, true] });
      if (!preview?.result || preview.result.error) throw new Error(preview?.result?.error ?? "Target unavailable");
      await approval(JSON.stringify({ url: target.url, action: args.action, target: preview.result, value: args.value }));
    }
    aborted(context.signal);
    const current = await chrome.tabs.get(target.id!);
    if (current.url !== target.url) throw new Error("Page changed while waiting for approval");
    const [result] = await chrome.scripting.executeScript({ target: { tabId: target.id! }, func: pageAction, args: [args, false] });
    if (!result?.result || result.result.error) throw new Error(result?.result?.error ?? "Action failed");
    return { text: JSON.stringify(result.result) };
  }
  throw new Error(`Unknown browser tool: ${name}`);
}

// Functions injected into the ISOLATED world: no closure dependencies and no model-generated code.
function readPageSnapshot(snapshot: string, offset: number) {
  const state = globalThis as typeof globalThis & { __wamSnapshot?: { id: string; url: string; nodes: HTMLElement[]; fingerprints: string[] } };
  const nodes = Array.from(document.querySelectorAll<HTMLElement>("a[href],button,input,textarea,select,[role=button],[contenteditable=true]")).filter(node => {
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== "hidden";
  }).slice(0, 200);
  const fingerprint = (node: HTMLElement) => [node.tagName, node.textContent?.trim().slice(0, 120), node.getAttribute("href"), node.getAttribute("type"), node.getAttribute("aria-label")].join("|");
  state.__wamSnapshot = { id: snapshot, url: location.href, nodes, fingerprints: nodes.map(fingerprint) };
  const text = document.body?.innerText ?? "";
  return { title: document.title, url: location.href, snapshot, selection: getSelection()?.toString().slice(0, 4000), text: text.slice(offset, offset + 14000), offset, nextOffset: offset + 14000 < text.length ? offset + 14000 : null,
    elements: nodes.map((node, index) => ({ id: String(index), tag: node.tagName, type: node.getAttribute("type"), label: (node.getAttribute("aria-label") || node.innerText || node.getAttribute("placeholder") || "").slice(0, 140) })) };
}
function pageAction(args: Record<string, unknown>, preview: boolean): { error?: string; result?: string; label?: string; href?: string | null } {
  const state = (globalThis as typeof globalThis & { __wamSnapshot?: { id: string; url: string; nodes: HTMLElement[]; fingerprints: string[] } }).__wamSnapshot;
  if (!state || state.id !== args.snapshot || state.url !== location.href) return { error: "Stale snapshot; read the page again" };
  if (args.action === "scroll") { if (!preview) window.scrollBy({ top: (args.direction === "up" ? -1 : 1) * innerHeight * 0.8, behavior: "auto" }); return { result: "Scrolled; read again to verify" }; }
  const index = Number(args.elementId);
  if (!Number.isInteger(index)) return { error: "Invalid element ID" };
  const node = state.nodes[index];
  if (!node?.isConnected) return { error: "Element detached; read the page again" };
  const fingerprint = [node.tagName, node.textContent?.trim().slice(0, 120), node.getAttribute("href"), node.getAttribute("type"), node.getAttribute("aria-label")].join("|");
  if (fingerprint !== state.fingerprints[index]) return { error: "Element changed; read the page again" };
  const input = node as HTMLInputElement;
  if (input.disabled || input.readOnly || /password|file|hidden/i.test(input.type ?? "") || /cc-|password|one-time-code/.test(input.autocomplete ?? "")) return { error: "Protected or disabled field" };
  if (preview) return { label: (node.getAttribute("aria-label") || node.innerText || input.placeholder || node.tagName).slice(0, 200), href: node.getAttribute("href") };
  if (args.action === "click") node.click();
  else if (args.action === "fill" || args.action === "select") {
    if (typeof args.value !== "string" || args.value.length > 20000) return { error: "Invalid field value" };
    if (node instanceof HTMLSelectElement || node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
      if (node instanceof HTMLSelectElement && !Array.from(node.options).some(option => option.value === args.value)) return { error: "Option does not exist" };
      const prototype = node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(node, args.value);
      node.dispatchEvent(new Event("input", { bubbles: true })); node.dispatchEvent(new Event("change", { bubbles: true }));
    } else return { error: "Not a supported form field" };
  }
  return { result: "Action dispatched; read the page to verify the result" };
}
