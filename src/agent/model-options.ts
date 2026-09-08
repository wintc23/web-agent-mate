import type { RemoteModel } from "../messages";

export interface ModelOption { value: string; label: string; children?: ModelOption[]; model?: RemoteModel }
const providers: Record<string, string> = { orcarouter: "OrcaRouter", openai: "OpenAI", codex: "Codex", anthropic: "Anthropic", google: "Google", deepseek: "DeepSeek", qwen: "Qwen", "meta-llama": "Meta", meta: "Meta", mistralai: "Mistral", xai: "xAI", "x-ai": "xAI", grok: "xAI", moonshotai: "Moonshot", kimi: "Kimi", minimax: "MiniMax", tencent: "Tencent", obsidian: "Obsidian", kling: "Kling", z_ai: "Z.ai", "z-ai": "Z.ai" };
export function modelProvider(id: string): string {
  if (id.includes("/")) return id.split("/")[0];
  if (/^(gpt|o[1-9]|chatgpt)/i.test(id)) return "openai";
  if (/^claude/i.test(id)) return "anthropic";
  if (/^gemini/i.test(id)) return "google";
  return id.split("-")[0];
}
export function modelOptions(models: RemoteModel[], selected: string): ModelOption[] {
  const catalog = models.some(model => model.id === selected) || !selected ? models : [...models, { id: selected, name: selected, free: false }];
  const groups = new Map<string, ModelOption>();
  for (const model of catalog) {
    const provider = modelProvider(model.id);
    if (!groups.has(provider)) groups.set(provider, { value: provider, label: providers[provider] ?? provider, children: [] });
    groups.get(provider)!.children!.push({ value: model.id, label: model.name.replace(/^[^:]+:\s*/, ""), model });
  }
  return [...groups.values()].sort((a, b) => a.value === "orcarouter" ? -1 : b.value === "orcarouter" ? 1 : a.label.localeCompare(b.label))
    .map(group => ({ ...group, children: group.children!.sort((a, b) => Number(b.model!.free) - Number(a.model!.free) || a.label.localeCompare(b.label)) }));
}
