# WebAgentMate release packaging

The source of truth for published archives is [`.github/workflows/release.yml`](../.github/workflows/release.yml). A `v*` tag builds the extension and four Bridge packages, then uploads them to GitHub Releases. A manual workflow run builds downloadable Actions artifacts without publishing a release.

```text
webagentmate-extension.zip
webagentmate-bridge-macos-x64.zip
webagentmate-bridge-macos-arm64.zip
webagentmate-bridge-windows-x64.zip
webagentmate-bridge-linux-x64.zip
```

Each v0.6 Bridge ZIP contains the native binary, the platform's installation and uninstallation scripts, `runtime/agent.mjs`, runtime dependency license notices, and the project's `LICENSE`. Users must extract the entire package and install Node.js 20+ separately. Unix ZIP extraction may require restoring executable permissions; see the [installation guide](../README.md#install-bridge).

The checked-in extension public key fixes the default ID at `lmlkkallnnjijicmfmfdelnamcnhflfg`. Installers register that exact origin by default. Forks using a different key must pass their extension ID explicitly to the installer (`-ExtensionId` in PowerShell). The installer accepts one exact ID; there is no interactive pairing flow or wildcard origin.

Generated local packages belong in the ignored `release/artifacts/` directory. `manifest.template.json` is reserved for future distribution metadata; the current GitHub workflow does not generate a release manifest, checksums, signed installers, or an auto-update feed.
