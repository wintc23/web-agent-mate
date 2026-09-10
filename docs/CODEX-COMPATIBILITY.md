# Codex compatibility

Verified against the installed **Codex CLI 0.153.4** and its generated App Server protocol on 2026-09-08. The extension calls the real local Codex harness; it does not reproduce Codex's agent loop or route Codex through OrcaRouter.

| Capability | Current integration |
| --- | --- |
| Native tools, shell, patches, web search, local instructions | Executed by Codex. Local configuration, `AGENTS.md`, Skills, MCP, hooks and authentication remain owned by Codex. |
| Models and reasoning | Paged native model catalog, native supported reasoning levels, service tiers, execution/plan mode. Unselected settings inherit local Codex configuration. |
| Sandbox and approvals | Inherited by default, with explicit conversation overrides for read-only/workspace-write/full access and approval policy. Native command/file/permission requests are interactive. Browser permission control remains separate. |
| Running-turn input | `turn/steer` targets the active parent turn with `expectedTurnId`. Composer button or Ctrl/⌘+Enter adds instructions; Enter retains next-turn queuing. Commands work across extension windows. |
| Stop and delivery recovery | Shared stop controls, ordered acknowledgment after transcript persistence, no automatic retry of unconfirmed delivery. Closing the owner window still cancels its process and preserves the queue. |
| Native history | Search and paginate local Codex history, read turns, import as an independent branch. First send calls `thread/fork`; subsequent sends use `thread/resume`. Local conversation branching also preserves native history, including when changing the working directory. |
| Skills | Discover by workspace, show descriptions, explicitly invoke `$name` with native skill/path input, enable/disable through Codex configuration. |
| MCP | Discover configured servers and tools/resources; OAuth flow keeps the native callback listener alive while the user authorizes. Standard primitive MCP forms and authorization URLs are interactive, with submit/decline/cancel. |
| Progress | Stream text and command output; display native plans, reasoning summaries, diffs, context compaction, token/context usage, hook and subagent activity. Child completion cannot terminate the parent run. |
| Long tasks | Codex turns no longer have the extension's 15-minute total deadline or the generic runtime's 3-minute silent-output deadline. Startup/RPC calls remain bounded; Codex owns model retry and tool timeouts. |

## Limits

- A terminal window and an extension window do not share a live App Server process. Import intentionally forks the terminal's stored history. Extension windows share their own progress, replies, queue and controls on the same device.
- Each dispatched turn starts a local App Server and resumes its native thread. Closing the owning extension page stops the run; daemon-backed background execution and durable live reconnection are not implemented.
- Browser dynamic tools are registered when the extension creates a thread. A branch imported from an unrelated terminal thread retains that thread's tools; the current protocol cannot add new dynamic tools to a resumed/forked thread. Its native Codex tools remain available.
- This release does not replicate the entire Codex terminal UI: slash-command menus, arbitrary PTY input, image/audio attachments in the composer, dedicated review/rollback/manual compact controls, scheduled/background goals, account administration, plugin installation, and arbitrary settings editing do not have dedicated interfaces here.
- MCP OAuth and standard forms have protocol coverage; real OAuth consent requires a configured OAuth-capable MCP server and the user's account. The local verification server uses bearer-token authentication, so no real OAuth grant was claimed. Advanced nested `openai/form` schemas are shown as unsupported and can be declined/cancelled.
- Model/feature availability and restrictions remain controlled by the installed Codex version, account, provider and local policy. Native protocol errors are surfaced rather than reported as successful support.

## Validation

- `npm test`: protocol subprocess checks, settings/backup persistence, skill selection, MCP form validation, cross-window delivery and recovery tests.
- `npm run build` and `npm run build:runtime`.
- `node scripts/smoke-codex.cjs --turn` (opt-in real local account): native model/Skills/MCP catalogs, steer during a real browser-tool call, persisted native turn history, and a native fork recalling the original marker. Uses a temporary workspace and synthetic threads; it does not resume or modify existing user threads.
- Actual extension UI with Native Messaging for model metadata, Skills/MCP discovery and history import; two browser windows with controlled native events for cross-window steer/MCP forms and interruption recovery.

References: [Codex App Server](https://learn.chatgpt.com/docs/app-server), and `codex app-server generate-ts --experimental` from the installed version. Runtime adapter: `bridge/runtime/codex.ts`.

## Configuration UI modules

The composer’s engine control opens one dialog. Choosing Codex reveals Configuration, Skills, MCP and History. Configuration groups execution parameters separately from tool permissions. Switching tabs keeps pending conversation settings; closing discards them. Skill switches and MCP sign-in update local Codex immediately, as described beside those controls. Save and use skill applies the selected conversation configuration before inserting the skill. History import uses the selected Codex options and the source thread’s directory to create an independent conversation.

- `src/agent-config-dialog.tsx`: engine selection, dialog navigation, model catalogs and save/error state.
- `src/codex-settings.tsx`: Codex execution parameters and native tool permissions.
- `src/codex-capabilities.tsx`: skills, MCP and history requests; requests are cancelled when leaving their view.
- `src/elicitation-form.tsx`: MCP forms shared by capability management and active conversations.
- `src/Workspace.tsx`: conversation persistence, branching, history import and draft insertion.
