# Chrome Web Store submission notes

Last updated: 2026-09-11

## Submission status and listing fields

**Status:** package and listing prepared locally; not submitted. An authenticated Chrome Web Store dashboard connection is still required. Do not describe the extension as available in the Store until the public listing is verified.

Prepared upload: `release/artifacts/webagentmate-chrome-0.6.0.zip` (515,101 bytes, 16 runtime files). SHA-256: `d5620a1626094ea550b19e06573a011d793b6277ebe66c9cc5219ab3e97b2528`. The archive has `manifest.json` at its root and excludes source, screenshots, documentation, source maps, credentials and desktop installers.

The portfolio page at https://wintc.top/products/webagentmate is live as a development preview. It currently links to source installation rather than an unverified Store URL.

| Field | Value |
| --- | --- |
| Name | WebAgentMate |
| Version | 0.6.0 |
| Short description | AI assistant for understanding and working with web pages. |
| Primary language | English (manifest default); Chinese listing copy below |
| Category | Productivity; match the available category in the dashboard |
| Homepage | https://wintc.top/products/webagentmate |
| Support | https://github.com/wintc23/web-agent-mate/issues |
| Privacy policy | https://github.com/wintc23/web-agent-mate/blob/main/PRIVACY.md |
| Distribution | Public, all available regions; publish automatically after approval |
| Publisher and contact email | Preserve the existing verified developer-account values; account not accessed in this run |
| Development extension ID | lmlkkallnnjijicmfmfdelnamcnhflfg; compare with the dashboard before submission |

### English detailed description

```text
Ask questions about the page you are reading, summarize or translate its content, and carry out browser tasks with WebAgentMate, an open-source AI assistant in your Chrome side panel.

OrcaRouter referral disclosure: browser sign-in includes WebAgentMate's referral code. If you register through this entry, later qualifying purchases may earn the developers a commission.

UNDERSTAND AND WORK WITH WEB PAGES
Summarize articles, explain selected passages, translate text, and extract useful information. Describe a task and let the agent choose supported page-reading, navigation, form and screenshot tools.

CHOOSE YOUR MODEL AND PERMISSIONS
Sign in to OrcaRouter and search models by provider. Availability, free usage and paid usage depend on the provider and your account. Permissions: Ask is the default for guarded actions. Choosing Permissions: Auto automatically approves those requests within the task. You can stop a running task at any time.

KEEP YOUR CONVERSATIONS
Search, rename, branch and export saved conversations. Drafts and progress are shared between the side panel and a dedicated conversation tab on the same device. Choose from six interface languages and system, light or dark themes.

OPTIONAL LOCAL CAPABILITIES
Built-in browser tasks work without additional desktop software. An optional Connector enables local files, commands, Codex and Claude Code. These capabilities are a developer preview in 0.6.0: matching public installers are not yet available, so local use requires the source-build instructions. Codex and Claude Code also require their own installation and sign-in.

GET STARTED
Open the extension from the Chrome toolbar, connect OrcaRouter in Settings, open the page you want to work with, and describe your task. Keep the initiating side panel or conversation tab open while the task runs.

PRIVACY
WebAgentMate does not operate an application server or include analytics SDKs. Conversations and preferences stay on this device. Task-relevant page content, messages, screenshots and, when enabled, local file or command content may be sent to the selected model provider. The extension does not continuously record your browsing. See the privacy policy for connection, referral and storage details.

Source and setup: https://github.com/wintc23/web-agent-mate
Support: https://github.com/wintc23/web-agent-mate/issues
```

### 简体中文详细说明

```text
WebAgentMate 是开源 Chrome 网页助手。在网页旁提问、总结文章、翻译内容，或用对话描述希望完成的浏览器任务。

OrcaRouter 推广说明：浏览器登录会携带 WebAgentMate 的推广码。通过此入口注册，后续符合条件的消费可能为开发者带来佣金。

理解并处理网页
总结文章、解释选中文本、翻译和提取信息。智能体按任务选择网页读取、导航、表单和截图等工具。

选择模型与授权方式
登录 OrcaRouter 后，按提供商搜索和选择模型。模型可用性、免费额度和收费取决于对应服务与账户。默认“授权：询问”会对受保护操作逐次询问；主动选择“授权：自动”后，这些请求会在任务中自动获准。运行期间可随时停止。

保留会话与工作进度
搜索、改名、分支和导出本地会话。在侧边栏或独立会话标签页继续工作，同一设备上的草稿和进度保持同步。支持六种界面语言、跟随系统以及浅色和深色主题。

可选的本地能力
内置智能体处理网页无需额外桌面软件。连接助手可提供本地文件、命令、Codex 和 Claude Code 能力。0.6.0 的这些本地能力处于开发预览阶段：匹配的公开安装器尚未发布，当前需要按照源码构建说明配置。Codex 和 Claude Code 还需各自安装并登录。

开始使用
从 Chrome 工具栏打开扩展，在设置中登录 OrcaRouter，打开目标网页并描述任务。任务期间请保持发起任务的侧边栏或会话标签页打开。

隐私
WebAgentMate 不运营应用服务器，也不包含分析统计 SDK。会话和偏好保存在当前设备；任务相关网页、消息、截图，以及主动启用的本地文件或命令内容可能发送给所选模型服务。扩展不会持续记录浏览活动。连接、推广归因和存储详情见隐私说明。

源码与安装：https://github.com/wintc23/web-agent-mate
反馈与建议：https://github.com/wintc23/web-agent-mate/issues
```

### Prepared graphics

All screenshots below are actual captures of the unpacked 0.6.0 build in an isolated Chrome profile, with no user credentials or private conversations. Workspace screenshots show an unsent task draft. Model availability and prices reflect the live catalog at capture time.

| Asset | Path | Dimensions |
| --- | --- | --- |
| Store icon | `public/icons/icon-128.png` | 128 × 128 |
| English workspace | `docs/store-assets/workspace-en-1280x800.png` | 1280 × 800 |
| English sign-in and disclosure | `docs/store-assets/settings-en-1280x800.png` | 1280 × 800 |
| Chinese workspace | `docs/store-assets/workspace-zh-1280x800.png` | 1280 × 800 |
| Chinese model selection | `docs/store-assets/models-zh-1280x800.png` | 1280 × 800 |
| Chinese sign-in and disclosure | `docs/store-assets/settings-zh-1280x800.png` | 1280 × 800 |

### Data use form

Declare the following data processed to provide the requested task. Local storage still counts as handling data; absence of a developer-operated server does not mean no user data is processed.

| Data category | Actual scope |
| --- | --- |
| Authentication information | OrcaRouter credential obtained through browser authorization; stored locally and sent to OrcaRouter for authenticated requests. Extension does not collect the user's account password. |
| Personal communications | User prompts, AI replies and task-relevant communications explicitly supplied as page or file content. |
| Web history | Task-related current-page URLs/titles and navigation results; no access to Chrome's browsing-history database. |
| User activity | Requested tool actions and their local conversation logs; no general browsing or keystroke analytics. |
| Website content | Requested visible text, selected text, control metadata and authorized screenshots sent to the selected model provider. |

There is no separate collection of identity profiles, health records, payment details or precise location. User-selected task content may contain such information and is processed as part of that content. The extension does not sell user data, use it for purposes unrelated to its stated functionality, or use it for creditworthiness/lending decisions. Referral attribution is separately disclosed below and in the privacy policy.

## Single purpose

WebAgentMate helps users understand the webpage they are viewing and carry out requested browser tasks with their chosen AI agent. Guarded actions follow the user's permission mode: Ask by default, or Auto when explicitly selected.

## Referral disclosure for the public listing

Include this disclosure prominently in the public Store description and keep it visible in installation materials. Updating this file does not update the live listing.

OrcaRouter browser sign-in is a referral entry. If you register through it, later qualifying purchases may earn the WebAgentMate developers a commission under OrcaRouter's partner program.

Chinese copy:

OrcaRouter 浏览器登录是推广入口。通过此入口注册，后续符合条件的消费可能按照 OrcaRouter 合作计划为 WebAgentMate 开发者带来佣金。

Before submission, confirm the direct-user-benefit basis and prominent-disclosure requirements in [Chrome's Affiliate Ads policy](https://developer.chrome.com/docs/webstore/program-policies/affiliate-ads/). A regular-weight disclosure immediately above the sign-in button identifies it as a referral entry and explains the commission in all six interface languages. There is no duplicate information tooltip. The public listing and installation materials must include the disclosure as well. Disclosure and a user click do not by themselves establish direct user benefit; see `docs/ORCAROUTER-PARTNER-REVIEW.md`.

## Permission justifications

- `sidePanel`: provides the primary assistant interface beside the page.
- `identity`: performs the user-initiated OrcaRouter OAuth 2.0 + PKCE flow.
- `storage`: stores language, theme, selected conversation and the user's OrcaRouter credential locally. Conversation messages, drafts, tool results and model/workspace settings persist in extension IndexedDB. There is no cross-device synchronization.
- `alarms`: schedules a compatible Connector update check every six hours while Chrome runs; the native Connector stores update preferences/progress and performs signed package verification, installation when idle, and rollback. The switch is in Settings → Local connection.
- `downloads`: starts a Bridge installer download after the user clicks Download Connector, clicks the folder control when Bridge is unavailable, or selects a platform. The extension checks the matching public release, downloads the exact project asset, and never opens or executes it automatically.
- `nativeMessaging`: connects to the optional local Bridge for Codex, Claude Code, and the built-in agent with local file and command tools enabled. Built-in browser tasks and conversation management work without Bridge.
- `tabs`: identifies the active tab and obtains its title/URL when the user requests page reading.
- `scripting`: extracts visible text and identifies or operates visible controls after the user requests page reading or starts an Agent task. Guarded actions request confirmation in Ask mode; choosing Auto authorizes these requests automatically within the task.
- `<all_urls>`: supports reading and operating user-selected HTTP(S) pages across sites, and Chrome's `captureVisibleTab` requirement for screenshots. Screenshots and guarded page changes follow the selected Ask/Auto permission mode. The tool executor rejects file URLs and restricted browser pages; it does not scan tabs or capture pages without a user task.
- `https://www.orcarouter.ai/*`: starts and completes authorization.
- `https://api.orcarouter.ai/*`: verifies the connection, retrieves the model catalog, and receives inference requests from the built-in browser agent. In local mode, the Bridge runtime makes inference requests.

## Remote code

No remote JavaScript or WebAssembly is executed. All extension code and UI libraries are included in the submitted package. Network responses are treated as data.

## Data handling

Web page text, selected text, URLs, visible control metadata, prompts, authentication information, and AI responses may be handled to provide the requested feature. WebAgentMate operates no application server in this release. The built-in browser loop calls OrcaRouter directly from the extension page. Local file/command mode and native engines use the Bridge runtime; the selected engine can connect to its cloud model provider. Conversations are persisted only on the current device. User-initiated JSON backups include chat, draft and tool content, without application connection settings or native session IDs. The conversation list does not provide a JSON backup-import entry. The project does not sell personal data or use page or conversation content for advertising. User-initiated browser sign-in sends the partner referral code to OrcaRouter for registration attribution and potential developer commission. See `PRIVACY.md`.

## Reviewer flow

1. Use Chrome 116 or newer. Install the extension and click the toolbar icon to open the side panel. Built-in browser tasks do not require additional desktop software. Local files/commands or Codex/Claude require the matching Connector. As of 2026-09-10, GitHub's latest published release is 0.2.2; the extension correctly reports unavailable downloads for 0.6.0. To test optional local capabilities before matching installers are published, follow the source-build instructions in README.md and docs/BRIDGE-INSTALL.md. Do not install an older Connector to test 0.6.0.
2. Settings opens on Models. For the built-in agent, connect OrcaRouter there using browser sign-in. Open Local to check or install Bridge when using local capabilities. Verify the regular-weight disclosure above the sign-in button identifies it as a referral entry and explains the commission without hovering or clicking. The explanation is also associated with the button for screen readers. Clicking the sign-in button opens an authorization URL with the partner referral code. Codex and Claude Code use their own installed CLIs and authentication.
3. Open the model/Agent dialog and choose Built-in, Codex or Claude Code. Selecting Codex exposes Configuration, Skills, MCP and History within the same dialog. Check that conversation changes are staged until saved, while skill switches and MCP sign-in apply immediately. Save and use skill applies the selected Codex configuration and inserts the skill into the draft. History import creates an independent branch. There is no separate Codex capabilities button in the composer. Built-in defaults to browser tools; enable **Local files and commands** to use Bridge and choose a working directory. Native engines always require Bridge. Check the download, installation-guide and recheck controls when Bridge is missing.
4. Ask a question or request a page task. When OrcaRouter is disconnected, click Settings in the connection reminder to open Models; the unsent draft is preserved. Verify that the permission button explicitly shows Permissions: Ask or Permissions: Auto, and its menu explains the two modes. Review tool approval requests. Press Enter to send or use the stop button to cancel. Browser tool results return directly to the browser loop or, for local mode, through Native Messaging.
5. Open the current conversation in a dedicated page and verify that it fills the browser viewport. Drafts, replies, progress and stop controls synchronize with the side panel.
6. Verify the left-hand Settings navigation and separate content area. Narrow side panels use labeled icon controls with tooltips; wider pages show icons and text. Check the four sections: Models, Local, General and About. General contains language and theme preferences; About contains the version, project link and privacy policy. Use the close button at the top right to return without losing the draft. OrcaRouter quota and rate errors show explanations and relevant action buttons; timed rate limits respect Retry-After.
7. In Conversations, create two chats with different drafts. Switch, reload, search, rename, branch and export. Check compact rows and full-row hover/selection styling in light and dark themes. Confirm that the backup-import entry is absent and that existing conversations retain their environment. Enabling local tools branches existing conversations and requires fresh approval.

## Screenshot checklist

Refresh all store screenshots for 0.6.0. Include the Agent avatar, an in-progress request with the stop control, searchable provider/model cascades with Free/Paid labels, local engine and working-directory selection, the conversation drawer, inline action approval, and the dedicated Settings/About page in both light and dark themes.

Capture the vertical Settings navigation in wide and narrow layouts, and the separate Local section with Bridge installation and connection checks. The Models screenshots should show the regular-weight referral and commission disclosure above the full-width OrcaRouter sign-in button in both light and dark themes. Refresh composer screenshots to show the explicit permission label and the clickable Settings connection reminder.

## Version history

- 0.6.0 (development, 2026-09-13) — Added automatic Connector updates with Ed25519 release signatures, full private-runtime packages, idle-only activation, rollback, and an update switch/status in all six languages. Added `alarms` for six-hour checks and updated PRIVACY.md. Older Connector installations require one installation of the new updater-capable package. Extension JavaScript remains bundled in the Chrome Web Store package; downloaded code runs only in the separately installed native host.

- 0.6.0 (development, 2026-09-11) — All Connector distributions include a private runtime, including ZIPs. Added extracted-package verification and publication checks. Project commands retain the existing PATH and Node selection; damaged installations require reinstalling the complete package.

- 0.6.0 (development, 2026-09-10) — Added shared browser-tool guidance for built-in, Claude and Codex agents, prioritizing WebAgentMate's own tools and avoiding Playwriter unless explicitly requested. Codex appends the guidance to inherited workspace instructions on start, resume and fork. Simplified referral copy in README, privacy, listing and portfolio to explain the actual commission relationship.

- 0.6.0 (development, 2026-09-10) — Removed manual OrcaRouter API-key entry and its background connection endpoint. Browser sign-in is the sole connection method; verification and disconnect remain available. Updated connection errors and current setup/privacy descriptions. Refresh Models settings screenshots.

- 0.6.0 (development, 2026-09-10) — Codex settings retain loaded lists and search text while switching tabs, show loading feedback on first access, and keep the dialog steady. Refresh Codex configuration screenshots.

- 0.6.0 (development, 2026-09-10) — Fixed the OrcaRouter model picker jumping back to the current provider during conversation synchronization, allowing reliable selection of DeepSeek and other providers' models. Unchanged session polls no longer refresh the conversation UI; actual changes still synchronize across windows.

- 0.6.0 (development, 2026-09-10) — User-facing setup now says Connect this computer and Download Connector, explains the files/commands it enables, and shows Connected / Not connected. Updated all six installation guides and the installer display names. Requires Chrome 116 or newer for the toolbar action. Clicking the Chrome toolbar icon from an independent WebAgentMate page opens that conversation in a new tab; other pages still open the sidebar. Refresh setup and installation screenshots.

- 0.6.0 (development, 2026-09-10) — The folder control downloads Bridge when it is unavailable, with progress and retry feedback. Installation instructions follow all six interface languages. Renamed the local settings section to Local connection. Removed the session list backup-import entry and made conversation rows more compact with consistent hover and selection backgrounds. Refresh settings and session-list screenshots before submission.

- 0.6.0 (development) — Added direct downloads of matching macOS DMG, Windows EXE and Linux DEB/RPM installers, platform selection, unavailable/retry feedback, and bundled Bridge runtimes so end users do not install Node.js or run commands. Public installer publication requires platform signing checks.

- 0.6.0 (development, 2026-09-09) — Grouped Codex configuration, skills, MCP servers and native history inside the Codex engine option. Clarified staged conversation settings and immediate local capability changes; preserved drafts and independent history import. Refresh Codex dialog and composer screenshots.

- 0.6.0 (development, 2026-09-09) — Simplified OrcaRouter sign-in with one regular-weight referral disclosure and a full-width button. Connection reminders link directly to Models settings while preserving drafts. The permission control visibly distinguishes Ask and Auto authorization; its menu explains both modes. Removed the duplicate referral tooltip.

- 0.6.0 (development, 2026-09-09) — Adopted a Rumy-style Settings layout: a compact title bar, a vertical navigation rail and a separate scrollable content area with grouped cards. Narrow panels use navigation icons with accessible names and tooltips; wider pages include text labels. General preferences use compact setting rows.

- 0.6.0 (development, 2026-09-09) — Split Settings into Models, Local, General and About in all six interface languages. Settings and provider connection actions open Models. Bridge setup is grouped under Local, with language and theme under General and project/privacy links under About. Switching sections preserves in-progress API-key input; Back preserves the conversation draft.

- 0.6.0 (development, 2026-09-09) — Added OrcaRouter registration referral attribution to browser sign-in, a referral label, a persistent commission explanation and a supplementary information tooltip in all six interface languages. The explanation is associated with the sign-in button for screen readers. Updated installation, privacy and Store disclosure copy. Manual API-key connection remains available. This does not certify compliance with Chrome's affiliate policy.
- 0.6.0 (development) — Added native Codex/Claude execution, an OrcaRouter agent loop in the local runtime, file/command tools, browser screenshots and artifacts, runtime fragmentation, timeouts and context compaction. Added persistent conversation management with search, independent branches, JSON backup import/export, native session isolation and protection against stale writes. Sending while OrcaRouter is disconnected keeps the conversation and draft visible. Refreshed controls with Agent avatars, a conversation drawer, searchable provider/model cascades, and a working-directory picker beside the composer. Settings focuses on connections and appearance, with browser sign-in and API key connection options. A catalog outage no longer discards a successful authorization. The conversation drawer reserves scrollbar space to prevent layout shifts when search or filtering changes the list length. Conversations now sync progress, drafts, pending replies and stop controls across windows on the same device. Closed-window runs recover without losing history or queued messages. Folder browsing connects directly to the local Bridge and offers clear errors with retry. Added native Codex reasoning, working-mode and permission settings; current-turn follow-up input; local Codex history import as independent branches; Skills and MCP discovery; interactive MCP forms and authorization; and native plans, file changes and token usage. Codex tasks are no longer stopped by the generic 15-minute task deadline. Built-in agents now default to no tool-call or whole-task time limit, with optional per-conversation budgets and detection of repeated failures or unchanged tool loops. Conversations can open in a dedicated browser tab with shared progress, drafts and controls. Built-in browser tasks now run directly in the extension without Bridge or Node.js. Local files/commands are optional; native engines still use Bridge. Settings includes download, installation-guide and connection-check controls. Existing conversation environments are preserved. OrcaRouter failures now explain rate windows, input limits, account/key quotas and budgets, with actionable controls instead of raw error payloads.
- 0.4.0 — Rebuilt the side panel as one focused Agent conversation with automatic tool selection, Bridge-independent remote browser tools, Remote/Local switching, a dynamic Free/Paid catalog, prompt-history keys, interface-language answers, quota recovery, a dedicated Settings/About page, real cancellation, and inline approvals.
- 0.3.0 — Added local Codex/Claude/Coco Agent selection, verified OrcaRouter state, OAuth discovery, and actionable errors.
- 0.2.2 — Fixed a Side Panel startup failure caused by a missing React runtime import.
- 0.2.1 — Added built-in Agent tasks, guarded webpage actions, user approval, cancellation, and system/light/dark themes.
- 0.1.1 — Added contextual OrcaRouter chat and optional local conversation storage.
