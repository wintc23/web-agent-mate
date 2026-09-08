# Chrome Web Store submission notes

Last updated: 2026-09-08

## Single purpose

WebAgentMate helps a user understand the webpage they are actively viewing and, after explicit confirmation, complete guarded page actions requested by the user.

## Permission justifications

- `sidePanel`: provides the primary assistant interface beside the page.
- `identity`: performs the user-initiated OrcaRouter OAuth 2.0 + PKCE flow.
- `storage`: stores language, theme, selected conversation and the user's OrcaRouter credential locally. Conversation messages, drafts, tool results and model/workspace settings persist in extension IndexedDB. There is no cross-device synchronization.
- `nativeMessaging`: connects to the required local Bridge for Codex, Claude Code, and the built-in local agent with file and command tools. Conversation management works without Bridge.
- `tabs`: identifies the active tab and obtains its title/URL when the user requests page reading.
- `scripting`: extracts visible text and identifies or operates visible controls after the user requests page reading or starts an Agent task. Click actions require confirmation.
- `<all_urls>`: supports reading and operating user-selected HTTP(S) pages across sites, and Chrome's `captureVisibleTab` requirement for screenshots. Screenshots and page changes require approval. The tool executor rejects file URLs and restricted browser pages; it does not scan tabs or capture pages without a user task.
- `https://www.orcarouter.ai/*`: starts and completes authorization.
- `https://api.orcarouter.ai/*`: verifies the connection and retrieves the model catalog. Inference requests are made by the local runtime.

## Remote code

No remote JavaScript or WebAssembly is executed. All extension code and UI libraries are included in the submitted package. Network responses are treated as data.

## Data handling

Web page text, selected text, URLs, visible control metadata, prompts, authentication information, and AI responses may be handled to provide the requested feature. WebAgentMate operates no application server in this release. All inference runs through the local Bridge runtime; the selected engine can connect to its cloud model provider. Conversations are persisted only on the current device. User-initiated JSON backups include chat, draft and tool content, without application connection settings or native session IDs. Import creates an independent conversation and does not run tools. The project does not sell data or use it for advertising. See `PRIVACY.md`.

## Reviewer flow

1. Install the extension and the Bridge with Node.js 20+. Click the toolbar icon to open the side panel. The Bridge is required for all agent tasks; saved conversations remain accessible without it.
2. In Settings, check the local Bridge connection. For the built-in agent, connect OrcaRouter using browser sign-in or an API key. Codex and Claude Code use their own installed CLIs and authentication.
3. Open the model/Agent dialog and choose Built-in, Codex or Claude Code. Choose a working directory and a model. There is no Remote/Local toggle.
4. Ask a question or request a page task. Review tool approval requests. Press Enter to send or use the stop button to cancel. Browser tool results travel back to the local agent through Native Messaging.
5. Open the current conversation in a dedicated page and verify that it fills the browser viewport. Drafts, replies, progress and stop controls synchronize with the side panel.
6. Verify that Settings contains connections and appearance. Use Back to return without losing the draft. OrcaRouter quota and rate errors show explanations and relevant action buttons; timed rate limits respect Retry-After.
7. In Conversations, create two chats with different drafts. Switch, reload, search, rename, branch, export and import. Legacy remote backups migrate to the local built-in engine without running queued tasks.

## Screenshot checklist

Refresh all store screenshots for 0.6.0. Include the Agent avatar, an in-progress request with the stop control, searchable provider/model cascades with Free/Paid labels, local engine and working-directory selection, the conversation drawer, inline action approval, and the dedicated Settings/About page in both light and dark themes.

## Version history

- 0.6.0 (development) — Added native Codex/Claude execution, an OrcaRouter agent loop in the local runtime, file/command tools, browser screenshots and artifacts, runtime fragmentation, timeouts and context compaction. Added persistent conversation management with search, independent branches, JSON backup import/export, native session isolation and protection against stale writes. Sending while OrcaRouter is disconnected keeps the conversation and draft visible. Refreshed controls with Agent avatars, a conversation drawer, searchable provider/model cascades, and a working-directory picker beside the composer. Settings focuses on connections and appearance, with browser sign-in and API key connection options. A catalog outage no longer discards a successful authorization. The conversation drawer reserves scrollbar space to prevent layout shifts when search or filtering changes the list length. Conversations now sync progress, drafts, pending replies and stop controls across windows on the same device. Closed-window runs recover without losing history or queued messages. Folder browsing connects directly to the local Bridge and offers clear errors with retry. Added native Codex reasoning, working-mode and permission settings; current-turn follow-up input; local Codex history import as independent branches; Skills and MCP discovery; interactive MCP forms and authorization; and native plans, file changes and token usage. Codex tasks are no longer stopped by the generic 15-minute task deadline. Built-in agents now default to no tool-call or whole-task time limit, with optional per-conversation budgets and detection of repeated failures or unchanged tool loops. Conversations can open in a dedicated browser tab with shared progress, drafts and controls. All agents now run locally via Bridge; removed Remote/Local switching and browser-only inference, with migration of legacy conversations. OrcaRouter failures now explain rate windows, input limits, account/key quotas and budgets, with actionable controls instead of raw error payloads.
- 0.4.0 — Rebuilt the side panel as one focused Agent conversation with automatic tool selection, Bridge-independent remote browser tools, Remote/Local switching, a dynamic Free/Paid catalog, prompt-history keys, interface-language answers, quota recovery, a dedicated Settings/About page, real cancellation, and inline approvals.
- 0.3.0 — Added local Codex/Claude/Coco Agent selection, verified OrcaRouter state, OAuth discovery, and actionable errors.
- 0.2.2 — Fixed a Side Panel startup failure caused by a missing React runtime import.
- 0.2.1 — Added built-in Agent tasks, guarded webpage actions, user approval, cancellation, and system/light/dark themes.
- 0.1.1 — Added contextual OrcaRouter chat and optional local conversation storage.
