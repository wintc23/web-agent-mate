import type { ToolOutput } from "../../src/agent/protocol";

type ContentBlock = { type?: string; text?: string; resource?: { text?: string } };
const MAX_VISIBLE_TEXT = 300_000; // Includes a 40k document even after JSON escaping.
function visibleText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((block: ContentBlock) => {
    if (!block || typeof block !== "object") return "";
    if (["text", "inputText"].includes(block.type ?? "") && typeof block.text === "string") return block.text;
    if (block.type === "resource" && typeof block.resource?.text === "string") return block.resource.text;
    // Images remain in the native model's tool result; omit their base64 from UI history.
    return "";
  }).filter(Boolean).join("\n");
}
function bounded(text: string): string {
  return text.length <= MAX_VISIBLE_TEXT ? text : text.slice(0, MAX_VISIBLE_TEXT) + "\n[Tool output truncated for display.]";
}

export function codexToolOutput(item: {
  type: string; status?: string; success?: boolean | null; exitCode?: number | null;
  aggregatedOutput?: string | null; contentItems?: unknown; changes?: unknown; action?: unknown;
  result?: { content?: unknown; structuredContent?: unknown; isError?: boolean } | null;
  error?: { message?: string } | null;
}): ToolOutput {
  const text = item.aggregatedOutput ?? visibleText(item.contentItems ?? item.result?.content);
  const fallback = item.error?.message ?? JSON.stringify(item.result?.structuredContent ?? item.changes ?? item.action ?? { status: item.status });
  return { text: bounded(text || fallback), isError: item.success === false || Boolean(item.error) || item.result?.isError === true ||
    ["failed", "declined"].includes(item.status ?? "") || (item.type === "commandExecution" && item.exitCode !== undefined && item.exitCode !== null && item.exitCode !== 0) };
}
export function claudeToolOutput(block: { content?: unknown; is_error?: boolean }): ToolOutput {
  return { text: bounded(visibleText(block.content)), isError: block.is_error === true };
}
