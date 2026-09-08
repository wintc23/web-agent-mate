# Privacy

WebAgentMate has no WebAgentMate-operated application server in this release.

- The extension reads a page only after the user requests page reading or starts an Agent task.
- All agent runs pass through the local Bridge. The built-in runtime sends task context to OrcaRouter; Codex and Claude use their own configured model services. The extension contacts OrcaRouter directly only for sign-in, connection verification and the model catalog.
- The OrcaRouter API key is persisted in Chrome local extension storage, restricted to trusted extension contexts. The built-in local runtime receives the key when needed for a run; it does not persist it.
- Interface preferences and the selected conversation are stored in Chrome local extension storage. Conversation messages, drafts, tool inputs/results and model/workspace settings are stored in extension IndexedDB on the current device. There is no cross-device synchronization.
- Conversation export writes a user-requested JSON file containing chat, draft and tool history. It excludes application connection settings and native session IDs; any sensitive material already present in the chat or tool output remains part of the backup. Import restores an independent conversation and does not execute tools.
- Codex history import copies selected native transcript content into extension storage and creates an independent native branch on first send. Skill enable/disable actions update local Codex configuration. MCP form responses are supplied to the selected local MCP service; authorization opens the service's own page on explicit user action.
- Bridge maintains local SQLite task data and does not open a network port. Codex and Claude also retain their own native session records.
- WebAgentMate does not sell personal information or include analytics/advertising SDKs.
- The unified Agent sends page controls and visible text to the selected model so it can answer directly or choose a constrained browser action. Clicks require user approval; sensitive targets are blocked.
- A user-approved screenshot is sent to the selected model to interpret the visible page. Chrome requires the `<all_urls>` host permission for this capture capability; the executor limits its tools to HTTP(S) pages. Earlier conversation content may be sent to the same model to generate a continuation summary when its context budget is reached.
- Without Bridge, users can view and manage saved conversations and drafts, but cannot start an agent task. There is no browser-only model inference fallback.
- The Bridge runtime connects to Codex, Claude or the built-in OrcaRouter agent. Authorized file, command and browser tools can supply task-relevant content to the selected model provider. Local execution does not imply offline model inference.

Users can erase the Router key with **Disconnect**, remove an individual conversation's extension history and draft with **Delete**, and erase all extension preferences and conversations by deleting Chrome extension data. Exported files must be deleted separately. Deleting an extension conversation does not delete Codex/Claude transcripts or generated files; those remain in their respective local storage.
