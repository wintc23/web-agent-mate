# WebAgentMate release workspace

This directory contains versioned release configuration and packaging sources.
Generated binaries and installers belong in `release/artifacts/` and are ignored
by Git. CI uploads those files to GitHub Releases.

## Distribution modes

- Official store build: package the fixed Chrome Web Store extension ID in the
  Native Messaging manifest. Users install and connect without pairing.
- Open-source/development build: obtain `chrome.runtime.id` from the extension
  and pass it through the explicit Bridge pairing flow. The Bridge must show a
  confirmation before adding the origin.

Never ship a Native Messaging manifest with a wildcard origin. The host must
only permit exact `chrome-extension://<32-character-id>/` origins.

## Artifact layout

```text
release/artifacts/
├── webagentmate-bridge-macos-x64.tar.gz
├── webagentmate-bridge-macos-arm64.tar.gz
├── webagentmate-bridge-windows-x64.zip
├── webagentmate-bridge-linux-x64.tar.gz
└── checksums-sha256.txt
```

The release manifest is generated from `manifest.template.json`. Replace every
placeholder in CI, calculate SHA-256 after packaging, and upload the manifest
and artifacts together.
