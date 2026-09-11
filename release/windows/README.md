# Windows packaging

The release workflow builds a signed Windows x64 EXE installer and a complete Bridge ZIP. Both include a private `runtime/node/node.exe`, the agent runtime and licenses; users do not install Node.js separately.

Installation stays under the current user's `%LOCALAPPDATA%/WebAgentMate` directory and registers the exact extension origin under the current user's Chrome, Chromium and Edge NativeMessagingHosts keys. It does not modify global Node or PATH. See [installer development](../../docs/INSTALLER-DEVELOPMENT.md).
