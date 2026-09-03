#!/bin/bash
set -euo pipefail

for manifest in \
  "${XDG_CONFIG_HOME:-$HOME/.config}/google-chrome/NativeMessagingHosts/ai.webagentmate.bridge.json" \
  "${XDG_CONFIG_HOME:-$HOME/.config}/chromium/NativeMessagingHosts/ai.webagentmate.bridge.json" \
  "${XDG_CONFIG_HOME:-$HOME/.config}/microsoft-edge/NativeMessagingHosts/ai.webagentmate.bridge.json"; do
  [[ ! -f "$manifest" ]] || mv "$manifest" "$manifest.disabled"
done
binary="${XDG_DATA_HOME:-$HOME/.local/share}/webagentmate/bin/webagentmate-bridge"
[[ ! -f "$binary" ]] || mv "$binary" "$binary.disabled"
echo "WebAgentMate Native Messaging host disabled. Local conversation data was preserved."
