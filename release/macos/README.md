# macOS packaging

The release workflow builds x64 and ARM64 DMGs and complete Bridge ZIPs. Every package includes the private Node executable, agent runtime, licenses and installer code. Users do not install Node.js separately.

Installation uses the current user's `Library/Application Support/WebAgentMate` directory and registers the exact extension origin for Chrome. Node stays inside that directory; global PATH, Node installations and shell profiles are untouched. DMGs require Developer ID signing and Apple notarization for public release. See [installer development](../../docs/INSTALLER-DEVELOPMENT.md).
