# WebAgentMate release packaging

The source of truth is [`.github/workflows/release.yml`](../.github/workflows/release.yml). Every Connector distribution, including ZIPs, contains its own Node executable and runtime. Users do not install Node.js separately.

Graphical packages are macOS x64/ARM64 DMGs, a Windows x64 EXE, and Linux x64 DEB/RPM packages. ZIPs contain the same complete payload plus installation/uninstallation scripts:

```text
webagentmate-extension.zip
webagentmate-bridge-macos-x64.zip
webagentmate-bridge-macos-arm64.zip
webagentmate-bridge-windows-x64.zip
webagentmate-bridge-linux-x64.zip
```

Build ZIPs with `node scripts/installer/archive.cjs build/installer-payload` after preparing the payload as described in [installer development](../docs/INSTALLER-DEVELOPMENT.md). The archive builder extracts the ZIP and verifies the actual packaged Bridge and private Node before producing a checksum and runtime verification record. Public release checks require matching verification records for all four Bridge ZIPs and platform signing records for graphical installers. Never distribute a bare Bridge binary or an old ZIP missing its private Node.

The private Node is stored under `runtime/node/` inside the Connector installation. Bridge launches it by absolute path and preserves the caller's PATH for project commands. Installation and removal do not modify global Node, npm, version-manager configuration, shell profiles, or global PATH. Missing runtime files require reinstalling a complete package; the installed Bridge does not fall back to system Node.

The checked-in extension public key fixes the default ID at `lmlkkallnnjijicmfmfdelnamcnhflfg`. Installers register that exact origin by default. ZIP installers accept an explicit extension ID (`-ExtensionId` in PowerShell). There is no wildcard origin. Extract the entire ZIP before running its installer; no separate Node installation is needed.

A `v*` tag publishes only after all required builds and checks succeed. A manual workflow run creates development artifacts without publishing a release. Generated local packages belong in ignored `release/artifacts/`.

Connector 0.6.0 supports automatic updates using a signed `webagentmate-update.json` that binds the complete platform ZIPs. It waits for local tasks to finish before activation and restores the previous payload if startup checks fail. Older installations require a one-time installation of the new Connector. The update signature does not replace macOS Developer ID signing/notarization or Windows publisher signing; see [installer development](../docs/INSTALLER-DEVELOPMENT.md) for the required release credentials. `manifest.template.json` is a legacy template, not the signed automatic-update manifest.
