export type BackgroundRequest =
  | { type: "auth:status" }
  | { type: "auth:connect" }
  | { type: "auth:disconnect" }
  | { type: "auth:verify" }
  | { type: "page:extract" }
  | { type: "chat:complete"; prompt: string; page: PageContext; history: ChatMessage[]; conversationId?: string }
  | { type: "agent:start"; goal: string }
  | { type: "agent:approve"; taskId: string; action: AgentAction }
  | { type: "agent:cancel"; taskId: string };

export interface PageContext { title: string; url: string; text: string; selection: string; }
export interface ChatMessage { role: "user" | "assistant"; content: string; }
export type AgentAction =
  | { name: "click"; elementId: string; reason: string }
  | { name: "fill"; elementId: string; value: string; reason: string }
  | { name: "select"; elementId: string; value: string; reason: string }
  | { name: "scroll"; direction: "up" | "down"; reason: string }
  | { name: "finish"; summary: string; reason: string };
export interface AgentResult {
  taskId: string;
  status: "running" | "waiting_approval" | "completed" | "cancelled" | "failed";
  message: string;
  action?: AgentAction;
  stepCount: number;
}

export interface AuthStatus {
  bridgeInstalled: boolean;
  bridgeVersion?: string;
  connected: boolean;
  callbackUrl: string;
}

export type BackgroundResponse =
  | { ok: true; data: AuthStatus }
  | { ok: true; data: { modelCount: number } }
  | { ok: true; data: PageContext }
  | { ok: true; data: { content: string; conversationId?: string } }
  | { ok: true; data: AgentResult }
  | { ok: false; error: string };
