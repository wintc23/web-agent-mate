# WebAgentMate

English | [简体中文](README.zh-CN.md)

> **[Try OrcaRouter — referral link](https://www.orcarouter.ai/register?ref=ref_22606f54f9038927f996)**
>
> Registering through this link or WebAgentMate's browser sign-in may earn the developers a commission on later qualifying purchases. See [Privacy](PRIVACY.md).

[![CI](https://github.com/wintc23/web-agent-mate/actions/workflows/ci.yml/badge.svg)](https://github.com/wintc23/web-agent-mate/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Connect every web page to your AI agents.**

WebAgentMate is an open-source Chrome assistant that brings Codex, Claude Code, and an OrcaRouter-powered agent to the page you are viewing. Ask questions, summarize or translate a page, carry out browser tasks, and work with local files from a side panel or a dedicated conversation tab.

Your conversations stay on your device. The built-in agent runs browser tasks in the extension, without installing additional desktop software. An optional desktop Connector enables file/command tools and native Codex/Claude engines. The selected engine may send task content to its model provider.

**Project status:** `main` contains v0.6.0 development source. Published packages may be older; check the version on [GitHub Releases](https://github.com/wintc23/web-agent-mate/releases). To try the features described here, build the extension from source; for access to files and commands on your computer, build the Connector from the same checkout. See the [acceptance record](docs/ACCEPTANCE-v0.6.md) for completed checks and outstanding live-provider validation.

## What you can do

- **Read with context:** ask “Summarize this article in five points” or “Explain the selected paragraph in Chinese.”
- **Work across the page and your files:** ask an agent to extract information from the current page and save a Markdown report in the selected workspace.
- **Delegate browser steps:** ask an agent to navigate, fill supported fields, or capture a screenshot, then respond to the permission requests shown in the conversation.
- **Continue a longer task:** reopen saved chats, branch a conversation, or use a dedicated tab with more room for tool results and documents.

## Choose an engine

| Engine | Connection | What you need |
| --- | --- | --- |
| Codex | Your local Codex App Server, with its native tools and configuration | Codex CLI installed and authenticated |
| Claude Code | Your local Claude Code through the Claude Agent SDK | Claude Code CLI installed and authenticated |
| Built-in agent | Agent loop in the extension using OrcaRouter and browser tools; optional local execution for file/command tools | OrcaRouter browser sign-in in Settings |

Browser tasks with the built-in agent need only the extension and an OrcaRouter connection. Install the Connector to enable **Local files and commands** or select Codex/Claude. Its installers and complete ZIP packages include the required runtime; users do not install Node.js separately. Codex and Claude use their own authentication; OrcaRouter sign-in is only needed for the built-in engine. Model access, quotas, and charges depend on your provider. Details of the native Codex integration are in [Codex compatibility](docs/CODEX-COMPATIBILITY.md).

## Features

- Chrome Manifest V3 side panel built with React, TypeScript, Vite, and Ant Design controls
- Open the current conversation in a dedicated tab that fills the browser viewport, with shared drafts, progress, replies and stop controls
- One Agent composer with Enter-to-send, Shift+Enter for a new line, same-slot cancellation, and first/last-line Up/Down prompt history
- One compact model/Agent control for local Codex, Claude Code and the built-in OrcaRouter agent; selecting Codex opens Configuration, Skills, MCP and History in one dialog
- Persistent on-device conversations with independent drafts, model/workspace settings, messages and tool history
- Search conversations by title, message, model or workspace; rename, branch, delete and export backups
- Explicit, user-triggered extraction of page text and selected text
- Summarize, explain, translate, extract key points, or ask a custom question
- OrcaRouter OAuth 2.0 + PKCE with a live model catalog grouped into free and paid models; Orca Free is the default and pricing is shown when available
- Browser tools, page understanding, summarization, and translation are available to all three engines
- Optional desktop Connector for local files/commands and native agents; installer downloads, connection checks, and automatic updates in Settings
- Selectable Codex, Claude Code, and built-in OrcaRouter engines
- Built-in agent loop with validated tools, optional tool-call budgets (off by default), repeated-failure and unchanged-loop detection, cancellation, request deadlines, bounded connection retries, and conversation compaction
- Local file listing, numbered reads, search, exact edits, approved commands and process management
- System, light, and dark themes using a quiet indigo accent and neutral conversation canvas
- Settings with a vertical navigation rail and separate content area, grouped into Models, Local connection, General and About; narrow panels use icons with tooltips, and returning preserves the conversation and draft
- English, Simplified Chinese, Traditional Chinese, Portuguese (Brazil), Japanese, and German interface; answers follow the user's language and request
- OrcaRouter failures show actionable explanations, timed retry when provided, model/agent selection, shorter conversations, and quota or billing links
- Fixed extension identity for development and Web Store builds: `lmlkkallnnjijicmfmfdelnamcnhflfg`

The built-in agent defaults to browser execution: its extension page calls OrcaRouter directly and executes browser tools. Enabling local tools uses Native Messaging and the Bridge runtime; Codex and Claude always use Bridge. Browser tools still execute in the extension and return results to the selected agent. File and command tools run on the computer according to the selected engine's permissions. Model inference can still use cloud services; local execution does not imply offline models. OrcaRouter sign-in is needed only for the built-in agent. See the [v0.6 design](docs/PRD-v0.6.md) and [acceptance record](docs/ACCEPTANCE-v0.6.md) for scope and verification.

## Conversations

Clicking the Chrome toolbar icon while viewing an independent WebAgentMate page opens the current conversation in a new tab. The original page and its task remain open.

Open **Conversations** from the header to create or switch chats. Each conversation saves its own draft, messages, tool records, model, environment and working directory in the extension's IndexedDB. The selected conversation is restored after reopening the panel or browser. No account synchronization is used.

Use **Open in a separate page** in the header for a full-width, full-height browser tab. Reopening the same conversation focuses its existing tab. The page URL tracks the selected conversation and restores it on refresh. Opening a page preserves the current run in its originating panel; keep that panel open while it runs. Tasks started in the dedicated page continue if the sidebar is closed.

Built-in agents have no tool-count or whole-task time cap by default. Enable **Limit tool calls** in the conversation configuration for an optional budget. Eight consecutive tool failures or twelve calls repeating an unchanged sequence pause the run with saved results. Live local process polling is excluded from repetition detection. Review the results and send updated instructions to continue; individual model requests still have timeouts.

- Search includes user and assistant messages, model names and workspace paths. Existing browser and local conversations keep their selected environment, history and drafts. Enabling local capabilities resets automatic browser approval to per-operation approval.
- **Branch conversation** creates an independent copy. Changing the engine, local-tools setting or working directory also creates a branch, preserving the original. Codex branches fork the native thread; Claude branches begin an independent native session with visible conversation context. Regular continuation uses the saved native session ID.
- **Export** in a conversation’s action menu produces a JSON backup of the conversation, draft and continuation history. The conversation list does not include a backup-import button.
- Backups include chat and tool content, but exclude application connection settings and native session IDs. Branched chats cannot take ownership of an existing native session.
- Closing the panel stops its current run. Reopen the saved conversation to continue; interrupted tool calls are marked as having an unknown outcome and are not automatically replayed.
- A running conversation is protected against simultaneous execution in another window. Deleting a conversation removes the extension's history, draft and native session reference; native agent transcripts and generated files remain under their own storage.

## Build the extension

Prerequisites:

- Google Chrome 116 or newer with Developer mode enabled for loading an unpacked extension.
- Node.js 20 or newer and npm; CI uses Node.js 22.
- For building the optional Connector only: stable Rust and Cargo. Windows also needs the MSVC C++ build tools; macOS needs the Xcode Command Line Tools; Linux needs a C compiler and linker.
- The CLI and authentication for your chosen engine, as described above.

```bash
git clone https://github.com/wintc23/web-agent-mate.git
cd web-agent-mate
npm ci
npm run build
```

Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the generated `dist/` directory. Pin WebAgentMate to the toolbar. Connect OrcaRouter in Settings to start a browser task. Node/npm are build tools here, not runtime requirements for users loading the built extension. Install the optional Connector below to access files and commands on your computer.

## Install the Connector

Open **Settings → Local connection → Connect this computer** for **Download Connector**, **Installation guide**, and **Check again**. The same entry appears when local tools or a native engine needs the Connector. See the [installation guide](docs/BRIDGE-INSTALL.md).

### From source

Run these commands from the repository root after `npm ci`:

```bash
# macOS
./scripts/build-bridge.sh
./scripts/install-native-host-macos.sh

# Linux
./scripts/build-bridge.sh
./scripts/install-native-host-linux.sh
```

```powershell
# Windows PowerShell
npm run build:runtime
cargo build --manifest-path bridge/Cargo.toml --release
.\scripts\install-native-host-windows.ps1
```

The build script compiles both the Node runtime and the Rust Bridge, which together power the Connector. The installer copies them to a user-level directory and registers the `ai.webagentmate.bridge` Native Messaging host. Restart Chrome or reload the extension afterward.

### From a release package

For browser tasks, load `webagentmate-extension.zip` from a published release. For local capabilities, open **Settings → Local connection → Download Connector**. The button directly downloads the installer matching the extension version and operating system. The adjacent menu offers other platforms and Linux package formats.

| Platform | Installer | Open and install |
| --- | --- | --- |
| macOS Apple Silicon | `webagentmate-bridge-macos-arm64.dmg` | Open the DMG, open the installer app, click Install |
| macOS Intel | `webagentmate-bridge-macos-x64.dmg` | Open the DMG, open the installer app, click Install |
| Windows x64 | `webagentmate-bridge-windows-x64.exe` | Follow the installation wizard |
| Ubuntu / Debian x64 | `webagentmate-bridge-linux-x64.deb` | Open in the system software installer |
| Fedora x64 | `webagentmate-bridge-linux-x64.rpm` | Open in the system software installer |

All Connector packages include a private Node.js runtime and dependency licenses. The private runtime does not replace your existing Node or modify global PATH. Users do not run terminal commands or install Node.js. After installation, click **Check again** in the extension; Chrome starts the Connector when needed. macOS requires 13.5+; Linux packages target Ubuntu 22.04+/Debian 12+ and compatible glibc 2.35+ systems.

[Download v0.6.0](https://github.com/wintc23/web-agent-mate/releases/tag/v0.6.0), published on 2026-09-17, for all packages listed above. The macOS installers have no Developer ID signature or Apple notarization, and the Windows installer has no publisher signature; your operating system may ask you to confirm installation. Automatic updates retain signed manifests and SHA-256 verification. See [installer development](docs/INSTALLER-DEVELOPMENT.md) and the [user installation guide](docs/BRIDGE-INSTALL.md).

### First conversation

1. Open an ordinary HTTP(S) webpage and click the WebAgentMate toolbar icon.
2. Open **Settings → Models** and connect OrcaRouter for the built-in browser agent. Check Bridge only when you need local capabilities.
3. Open the model/Agent selector and choose an engine and model. For local tasks, enable **Local files and commands** and select a working directory.
4. Send a request such as “Summarize the current page.” Review any tool permission requests; use the stop control to cancel a run.
5. Use **Conversations** to return to saved chats, or **Open in a separate page** for a larger workspace.

The checked-in public manifest key keeps the development extension ID at `lmlkkallnnjijicmfmfdelnamcnhflfg`. Graphical installers derive the ID from that key at build time; rebuild the installers if your fork changes it. For the developer installation scripts, pass the ID shown on `chrome://extensions` as the first argument, or use `-ExtensionId` in PowerShell. This key is public identity material, not a signing private key.

## Local data and privacy

The OrcaRouter key and UI preferences are kept in `chrome.storage.local`, restricted to trusted extension contexts. Conversations and drafts persist in extension IndexedDB. Page and file content used by a task can be sent to its selected model provider. The built-in local runtime receives the OrcaRouter key for the current run; Bridge does not persist it or expose a localhost server. Native agents retain their own transcripts. See [PRIVACY.md](PRIVACY.md).

## Bridge protocol

The native host is `ai.webagentmate.bridge`. It currently supports:

- `bridge.hello`
- `conversations.create`, `conversations.list`, `conversations.get`, `conversations.delete`
- `messages.append`
- `storage.stats`
- `agents.start`, `agents.status`, `agents.record_step`, `agents.cancel`
- `agents.adapters`, `agents.plan_local`
- `runtime.open`, `runtime.send` for the v0.6 streamed agent protocol

Native Messaging frames are capped at 1 MiB. Larger runtime messages use ordered fragments with a 16 MiB reassembly limit and a 30-second incomplete-transfer deadline. The host manifest permits one explicitly configured extension ID, using the project's fixed ID by default.

## Development checks

```bash
npm run build
npm test
npm run build:runtime
cargo fmt --manifest-path bridge/Cargo.toml -- --check
cargo test --manifest-path bridge/Cargo.toml --locked
```

Tags matching `v*` build the extension and DMG/EXE/DEB/RPM installers plus developer ZIP archives. Publication checks macOS signing/notarization, Windows signing, and the signed Connector update manifest. `workflow_dispatch` builds development artifacts without publishing them.

Pull requests and pushes to `main` run the automated tests, extension/runtime builds, and Rust checks in GitHub Actions. These checks use synthetic data and do not need provider credentials. `npm run dev` starts Vite for UI development; rebuild `dist/` and reload the unpacked extension to test Chrome APIs.

With an authenticated local agent, opt-in live checks exercise its tools, saved context, cancellation and the actual Rust framing protocol. These checks make real model requests and may incur provider charges:

```bash
node scripts/smoke-runtime.cjs codex --turn
node scripts/smoke-runtime.cjs codex --cancel --bridge
node scripts/smoke-runtime.cjs codex --bridge --large
node scripts/smoke-runtime.cjs claude --turn
```

If Claude reports `CLAUDE_AUTH_REQUIRED`, run `claude auth login` in a terminal and retry. A cached login or successful model listing does not establish that a provider credential is still valid.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Connector not connected / native host not found | Run the installer for your OS and extension ID, then restart Chrome. Confirm the extension and Connector come from the same version. |
| `NODE_20_REQUIRED` | Reinstall the complete matching Connector package to restore its bundled runtime. Node.js is included. |
| `RUNTIME_BUNDLE_MISSING` or an update-Bridge prompt | Reinstall the complete matching Connector package. Maintainers using source builds should rebuild the runtime and Bridge, then rerun the source installer to prepare the complete payload. |
| Codex or Claude is unavailable | Confirm the selected CLI is installed, discoverable outside your shell initialization, and can complete an authenticated request in a terminal. |
| Page reading fails on `chrome://` or another restricted URL | Switch to a normal HTTP(S) page. Browser internal pages and file URLs are excluded. |
| A task stops when the sidebar closes | The page that started the run owns its connection. Start subsequent long tasks in the dedicated conversation tab and keep that tab open. |
| OrcaRouter reports a quota, key, or rate-limit error | Follow the error's connection, model, billing, or retry action. A model catalog response alone does not establish inference access. |

Connector installations with the new updater check for the release matching the extension version on startup, after an extension update, and every six hours while Chrome is running. The Connector verifies the project signature and package checksum, downloads the complete runtime, and switches versions after local tasks finish. Failed startup checks restore the previous version. Control this in **Settings → Local connection → Automatic Connector updates**. Existing installations without updater support need a one-time installation of the latest complete Connector.

To upgrade a source checkout, rebuild the extension and Bridge, rerun the installer, and reload the extension. For graphical installations, use the macOS installer’s Uninstall button, Windows Settings → Apps, or the Linux software manager. Source installations retain the `scripts/uninstall-native-host-*` scripts. Remove the extension separately in Chrome; see [PRIVACY.md](PRIVACY.md) for data deletion behavior.

## Project structure

```text
src/                 Side panel, dedicated conversation page, browser tools, local storage
public/              Manifest, icons, and Chrome locale messages
bridge/src/          Rust Native Messaging host, SQLite storage, runtime lifecycle
bridge/runtime/      Codex/Claude adapters and built-in local agent runtime
scripts/             Builds, installers, automated tests, and optional live checks
tests/               Protocol, conversation, permissions, and resilience tests
docs/                Design, acceptance records, and integration limits
.github/workflows/   CI checks and release packaging
```

The default built-in loop runs in the owning extension page, calls OrcaRouter over HTTPS, and stores checkpoints in IndexedDB. Local mode exchanges task events with the Rust host through Native Messaging; the host starts the Node runtime for the chosen engine. Bridge does not expose a localhost HTTP server.

## Contributing and support

Bug reports and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup and checks, and use [GitHub Issues](https://github.com/wintc23/web-agent-mate/issues) for reproducible bugs and feature requests. Include your OS, Chrome/Node versions, engine, and extension/Bridge versions; remove credentials and private page or chat content from logs.

Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Design and verification details live in the [v0.6 design](docs/PRD-v0.6.md), [acceptance record](docs/ACCEPTANCE-v0.6.md), and [Codex compatibility notes](docs/CODEX-COMPATIBILITY.md).

## License

WebAgentMate's source code is licensed under the [MIT License](LICENSE). Third-party dependencies retain their own licenses and terms; the Claude Agent SDK is subject to Anthropic's terms. Runtime packages include its supplied license notice and the Zod license under `runtime/licenses/`. Access to external model services is governed separately by the relevant provider.
