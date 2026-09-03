#!/bin/bash
set -euo pipefail

manifest="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/ai.webagentmate.bridge.json"
binary="$HOME/Library/Application Support/WebAgentMate/bin/webagentmate-bridge"

[[ ! -f "$manifest" ]] || mv "$manifest" "$manifest.disabled"
[[ ! -f "$binary" ]] || mv "$binary" "$binary.disabled"
echo "WebAgentMate Native Messaging host disabled. Local conversation data was preserved."
