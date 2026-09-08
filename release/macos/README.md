# macOS packaging

The release workflow builds separate x64 and ARM64 ZIPs containing the Bridge,
Node runtime, license notices, and installer/uninstaller scripts. The installer
registers the exact extension origin for Chrome in the current user's Library.
Node.js 20+ is installed separately. The workflow does not currently sign or
notarize the binaries.
