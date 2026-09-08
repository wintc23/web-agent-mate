import type { ToolOutput } from "./protocol";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const fields = Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`);
    return "{" + fields.join(",") + "}";
  }
  return JSON.stringify(value) ?? "null";
}

// A per-run heuristic, independent of context compaction and provider tool IDs.
// Keep a small window; changed arguments, results or images count as progress.
export class LoopGuard {
  private failures = 0;
  private recent: Array<{ input: string; text: string; image?: string }> = [];

  observe(name: string, args: Record<string, unknown>, output: ToolOutput): string | undefined {
    this.failures = output.isError ? this.failures + 1 : 0;
    if (this.failures >= 8) return "AGENT_CONSECUTIVE_FAILURES";
    if (!output.isError && ["process_read", "shell_start"].includes(name)) {
      try {
        const process = JSON.parse(output.text);
        // A live process can legitimately produce no new output for a long time.
        if (process.done === false && typeof process.processId === "string") {
          this.recent = [];
          return;
        }
      } catch { /* Non-process results still participate in loop detection. */ }
    }
    const input = { ...args };
    if (name === "browser_act") delete input.snapshot;
    let text = output.text;
    if (["browser_read", "shell_start"].includes(name)) {
      try {
        const result = JSON.parse(text);
        if (name === "browser_read") delete result.snapshot;
        else delete result.processId;
        text = canonical(result);
      } catch { /* Preserve plain-text errors and outputs. */ }
    }
    this.recent.push({ input: `${name}:${canonical(input)}`, text, image: output.image });
    if (this.recent.length > 12) this.recent.shift();
    if (this.recent.length < 12) return;
    for (let period = 1; period <= 4; period++) {
      if (this.recent.slice(period).every((item, index) => {
        const previous = this.recent[index];
        return item.input === previous.input && item.text === previous.text && item.image === previous.image;
      })) return "AGENT_NO_PROGRESS";
    }
  }
}
