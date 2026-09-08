export type OrcaModel = string;
export type ExecutionLocation = "remote" | "local";
export type ResponseLanguage = "en" | "zh-CN" | "zh-TW" | "pt-BR" | "ja" | "de";

export interface RemoteModel {
  id: string;
  name: string;
  free: boolean;
  promptPricePerMillion?: number;
  completionPricePerMillion?: number;
  contextLength?: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
}

export type BackgroundRequest =
  | { type: "auth:status" }
  | { type: "auth:connect" }
  | { type: "auth:key"; key: string }
  | { type: "auth:disconnect" }
  | { type: "auth:verify" }
  | { type: "page:extract" }
  | { type: "models:list" }
  | { type: "agents:list" }
  | { type: "workspace:list"; path?: string; offset?: number }
  | { type: "agent:start"; goal: string; adapter: AgentAdapterId; model?: OrcaModel; responseLanguage?: ResponseLanguage }
  | { type: "agent:approve"; taskId: string; action: AgentAction; model?: OrcaModel; responseLanguage?: ResponseLanguage }
  | { type: "agent:cancel"; taskId: string };

export type RunPortRequest =
  | {
      type: "run:agent";
      requestId: string;
      goal: string;
      history: ChatMessage[];
      conversationId?: string;
      adapter: AgentAdapterId;
      model: OrcaModel;
      location: ExecutionLocation;
      responseLanguage: ResponseLanguage;
    }
  | {
      type: "run:agent:approve";
      requestId: string;
      taskId: string;
      action: AgentAction;
      model: OrcaModel;
      responseLanguage: ResponseLanguage;
    }
  | { type: "run:cancel"; requestId: string };

export type RunPortResponse =
  | { type: "run:started"; requestId: string; taskId?: string }
  | { type: "run:result"; requestId: string; kind: "agent"; data: AgentResult }
  | { type: "run:cancelled"; requestId: string }
  | { type: "run:error"; requestId: string; error: string };

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
  conversationId?: string;
}

export type AgentAdapterId = "orcarouter" | "codex" | "claude" | "coco";
export interface AgentAdapter {
  id: AgentAdapterId;
  name: string;
  kind: "cloud" | "local";
  available: boolean;
  detail?: string;
}

export interface AuthStatus {
  bridgeInstalled: boolean;
  runtimeV2?: boolean;
  bridgeVersion?: string;
  connected: boolean;
  verified: boolean;
  callbackUrl: string;
}

export type BackgroundResponse =
  | { ok: true; data: AuthStatus }
  | { ok: true; data: { modelCount: number } }
  | { ok: true; data: PageContext }
  | { ok: true; data: AgentResult }
  | { ok: true; data: { adapters: AgentAdapter[] } }
  | { ok: true; data: { models: RemoteModel[] } }
  | { ok: true; data: WorkspaceDirectory }
  | { ok: false; error: string };

export interface WorkspaceDirectory {
  path: string;
  parent: string | null;
  directories: Array<{ name: string; path: string }>;
  nextOffset: number | null;
}
