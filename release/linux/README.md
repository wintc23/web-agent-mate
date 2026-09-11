# Linux packaging

The release workflow builds Linux x64 DEB/RPM packages and a complete Bridge ZIP. All contain the private Node executable, agent runtime and licenses; no separate Node.js installation is needed.

System packages install under `/opt/webagentmate-bridge`. ZIP installation uses the current user's WebAgentMate data directory and registers Chrome, Chromium and Edge with one exact extension origin. Neither method creates a global `node` command or modifies the user's PATH. See [installer development](../../docs/INSTALLER-DEVELOPMENT.md).
