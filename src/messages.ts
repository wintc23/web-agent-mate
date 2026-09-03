export type BackgroundRequest =
  | { type: "auth:status" }
  | { type: "auth:connect" }
  | { type: "auth:disconnect" }
  | { type: "auth:verify" }
  | { type: "page:extract" }
  | { type: "chat:complete"; prompt: string; page: PageContext; history: ChatMessage[]; conversationId?: string };

export interface PageContext { title: string; url: string; text: string; selection: string; }
export interface ChatMessage { role: "user" | "assistant"; content: string; }

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
  | { ok: false; error: string };
