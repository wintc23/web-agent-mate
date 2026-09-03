# WebAgentMate

**Connect every web page to your AI agents.**

WebAgentMate is a local-first Chrome side-panel assistant. It supports contextual chat and a Bridge-powered built-in Agent that can carry out guarded actions on the current page.

## Features

- Chrome Manifest V3 side panel built with React, TypeScript, Vite, and Ant Design
- Explicit, user-triggered extraction of page text and selected text
- Summarize, explain, translate, extract key points, or ask a custom question
- OrcaRouter OAuth 2.0 + PKCE; no WebAgentMate server is required
- Optional Rust Bridge with embedded SQLite; no Rust, SQLite, Node.js, or Python required for release users
- Built-in Agent loop with persistent tasks, step limits, cancellation, structured actions, and click approval
- System, light, and dark themes using the WebAgentMate electric mint and violet palette
- English, Simplified Chinese, Traditional Chinese, Portuguese (Brazil), Japanese, and German
- Fixed extension identity for development and Web Store builds: `lmlkkallnnjijicmfmfdelnamcnhflfg`

Local Codex, Claude, and Coco CLI adapters are the next Bridge milestone. The built-in Agent uses OrcaRouter and works without those CLIs. Arbitrary command execution is not enabled.

## Build the extension

Requires Node.js 20 or newer.

```bash
npm ci
npm run build
```

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `dist/`.

## Install Bridge

Release users download the ZIP matching their OS from GitHub Releases, extract it, and run the included installer. The ZIP contains the compiled Bridge, so development tools are unnecessary.

```bash
# macOS
./install-native-host-macos.sh

# Linux
./install-native-host-linux.sh

# Windows PowerShell
.\install-native-host-windows.ps1
```

Restart Chrome or reload the extension afterward. Source developers can build and install with:

```bash
./scripts/build-bridge.sh
./scripts/install-native-host-macos.sh  # or the Linux/Windows equivalent
```

On unsigned macOS development builds, Gatekeeper may require explicit approval. Production distribution should use Apple signing/notarization and Windows code signing.

## Local data and privacy

The OrcaRouter key is kept in `chrome.storage.local`, restricted to trusted extension contexts. Page material goes directly from the extension to OrcaRouter only after user action. Bridge never stores that key or opens a localhost port; it stores conversations in the OS application-data directory using SQLite. See [PRIVACY.md](PRIVACY.md).

## Bridge protocol

The native host is `ai.webagentmate.bridge`. It currently supports:

- `bridge.hello`
- `conversations.create`, `conversations.list`, `conversations.get`, `conversations.delete`
- `messages.append`
- `storage.stats`
- `agents.start`, `agents.status`, `agents.record_step`, `agents.cancel`

Native Messaging frames are capped at 1 MiB. The host manifest only permits the official extension ID.

## Development checks

```bash
npm run build
cargo fmt --manifest-path bridge/Cargo.toml -- --check
cargo test --manifest-path bridge/Cargo.toml
```

Tags matching `v*` build the extension plus macOS x64/ARM64, Windows x64, and Linux x64 Bridge packages, then attach them to a GitHub Release.

## License

[MIT](LICENSE)
