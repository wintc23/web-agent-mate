# Bridge installer development

These commands are for maintainers. Users download a graphical installer from **Settings → Local connection → Download Bridge** and do not install Node.js or run a command. See [the installation guide](BRIDGE-INSTALL.md).

## Build

Build on the target operating system and architecture. Development requires Node.js 20+, npm, Rust and the platform packaging tools. macOS additionally needs Xcode Command Line Tools; Windows needs NSIS; Linux needs `dpkg-deb` and `rpmbuild`.

```sh
npm ci
npm run build:runtime
cargo build --manifest-path bridge/Cargo.toml --release
```

Prepare the offline payload with one of these commands:

```sh
# macOS: use arm64 for Apple Silicon or x64 for Intel
node scripts/installer/prepare.cjs --platform darwin --arch arm64 --binary bridge/target/release/webagentmate-bridge --out build/installer-payload

# Windows x64
node scripts/installer/prepare.cjs --platform win32 --arch x64 --binary bridge/target/release/webagentmate-bridge.exe --out build/installer-payload

# Linux x64
node scripts/installer/prepare.cjs --platform linux --arch x64 --binary bridge/target/release/webagentmate-bridge --out build/installer-payload
```

Then run the corresponding packager:

```sh
node scripts/installer/macos.cjs build/installer-payload
node scripts/installer/windows.cjs build/installer-payload
node scripts/installer/linux.cjs build/installer-payload
```

Outputs are in `release/artifacts/`: two architecture-specific macOS DMGs, a Windows EXE, and Linux DEB/RPM packages. Each build produces only its own platform's files. The DMG contains an AppKit installer application; Windows uses a per-user NSIS wizard; Linux uses the system package installer and includes software-manager metadata. The release workflow also produces complete ZIPs using `node scripts/installer/archive.cjs build/installer-payload`. ZIPs include the same private Node; do not zip the bare Rust binary or runtime bundle by hand.

The payload contains the Rust Native Messaging host, the bundled JavaScript agent, a private Node executable, licenses and installer code. Native Messaging starts the host on demand. The installed host requires its private Node and launches it by absolute path. It preserves the caller's PATH so project commands keep using the user's selected Node. It does not install Node globally or change shell profiles, npm configuration or version-manager settings. Codex and Claude Code remain separate optional applications.

## Compatibility and runtime updates

The pinned runtime and SHA-256 checksums are in [`node-runtime.json`](../scripts/installer/node-runtime.json). `prepare.cjs` downloads from the official Node distribution over HTTPS, verifies the checksum before extraction, and caches the verified archive under `build/installer-cache/`. To update, review the official release, copy all four archive checksums from its `SHASUMS256.txt`, and rerun each platform's installation checks. Include the Node license with every payload.

The current Node 24 runtime requires macOS 13.5+. Windows packages target x64. Linux builds use Ubuntu 22.04 and require glibc 2.35+, with DEB packages for Ubuntu 22.04+/Debian 12+ and RPM packages for compatible Fedora systems. Windows ARM, Linux ARM and older Linux distributions do not currently have installers. Linux package selection defaults to DEB because Chrome's platform API does not report the distribution; users can select RPM from the download menu.

macOS and Windows install for the current account. Linux installs under `/opt/webagentmate-bridge` and registers system Native Messaging manifests. During migration, Linux changes only existing per-user manifests pointing at an older WebAgentMate installation; these changes run with that user's privileges and keep a backup. Uninstallation removes Bridge registration and program files while retaining conversations and user-created files.

## Signing and publication

`workflow_dispatch` builds development artifacts without publishing a GitHub Release. Pushing a version tag builds all platforms and publishes only after installer checks and signing requirements pass. Keep the tag, extension manifest version and installer version aligned: the download button requests the release matching the installed extension version and will report unavailable when that version's installer is absent.

Configure these repository Actions secrets for public macOS releases:

- `WAM_MAC_CERTIFICATE`: base64-encoded Developer ID Application P12 certificate.
- `WAM_MAC_CERTIFICATE_PASSWORD`: the P12 password.
- `WAM_MAC_SIGN_IDENTITY`: the complete Developer ID Application signing identity.
- `WAM_APPLE_ID`, `WAM_APPLE_TEAM_ID`, `WAM_APPLE_APP_PASSWORD`: Apple notarization credentials.

The macOS job imports the certificate into a temporary runner keychain, signs the embedded executables and application, signs the DMG, submits it to Apple, and staples the notarization ticket. Local builds can use `WAM_MAC_SIGN_IDENTITY` and a `WAM_NOTARY_PROFILE` already stored with `notarytool`. Without these, the output has an ad-hoc development signature and is not eligible for public release.

For Windows, configure `WAM_WINDOWS_CERTIFICATE_BASE64` and `WAM_WINDOWS_CERTIFICATE_PASSWORD` with a supported code-signing PFX. The workflow locates `signtool`, signs and timestamps the EXE, and verifies the result. A hardware- or cloud-backed certificate requires adapting the signing step to that provider. Local builds accept `WAM_WINDOWS_CERTIFICATE` as the PFX path and optionally `WAM_SIGNTOOL`/`WAM_MAKENSIS` as tool paths.

`check-release.cjs` requires all five graphical installers, the extension ZIP, macOS signing/notarization records, a Windows signing record, and four complete Bridge ZIPs with matching SHA-256 runtime-verification records. Unsigned development builds remain available as workflow artifacts. A signing certificate does not guarantee that Windows SmartScreen will immediately recognize a new publisher.

## Verify

```sh
npm test
npm run build
cargo test --manifest-path bridge/Cargo.toml
node scripts/installer/verify-payload.cjs build/installer-payload
node scripts/installer/archive.cjs build/installer-payload
```

`verify-payload.cjs` uses a temporary home and a PATH without user-installed Node, then exercises the actual Native Messaging hello exchange. On macOS, also test the payload inside the generated app:

```sh
node scripts/installer/verify-install.cjs 'build/installers/macos-arm64/image/WebAgentMate Connector.app/Contents/Resources/bridge'
```

Payload and extracted ZIP verification exercise the real Bridge with an empty PATH, with another Node selected for project commands, and with the bundled Node removed while a usable system Node exists. Missing bundles must fail instead of borrowing system Node.

Installation verification installs into an isolated account directory, starts the installed host and agent bundle, upgrades, unregisters, and checks that conversation data remains. Use `macos-x64` for Intel. CI runs these checks on both Mac architectures; Windows CI silently installs the EXE, checks the installed runtime, and uninstalls it. Linux CI builds both formats, checks their metadata, installs and removes the DEB, and checks the installed runtime. RPM installation and interactive installer prompts still require validation on their target desktop systems.

Before publishing, open the downloaded installers on clean target systems, complete their graphical flows, and verify **Check again** in Chrome. See [acceptance notes](ACCEPTANCE-v0.6.md) for which checks have actually run; the presence of CI configuration is not a completed platform test.
