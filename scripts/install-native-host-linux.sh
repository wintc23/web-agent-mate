#!/bin/bash
set -euo pipefail

extension_id="${1:-lmlkkallnnjijicmfmfdelnamcnhflfg}"
if [[ $# -gt 1 || ! "$extension_id" =~ ^[a-p]{32}$ ]]; then
  echo "Usage: $0 [chrome-extension-id]" >&2
  exit 2
fi
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
script_dir="$(cd "$(dirname "$0")" && pwd)"
source_binary="$script_dir/webagentmate-bridge"
if [[ ! -x "$source_binary" ]]; then
  source_binary="$project_dir/bridge/target/release/webagentmate-bridge"
fi
install_root="${XDG_DATA_HOME:-$HOME/.local/share}/webagentmate"
binary_dir="$install_root/bin"

if [[ ! -x "$source_binary" ]]; then
  if [[ -x "$project_dir/scripts/build-bridge.sh" ]]; then
    "$project_dir/scripts/build-bridge.sh"
  else
    echo "Bridge binary is missing. Download the release package for Linux." >&2
    exit 1
  fi
fi

mkdir -p "$binary_dir"
install -m 755 "$source_binary" "$binary_dir/webagentmate-bridge"

manifest_json="$(printf '{\n  "name": "ai.webagentmate.bridge",\n  "description": "WebAgentMate native bridge",\n  "path": "%s",\n  "type": "stdio",\n  "allowed_origins": ["chrome-extension://%s/"]\n}\n' "$binary_dir/webagentmate-bridge" "$extension_id")"

for manifest_dir in \
  "${XDG_CONFIG_HOME:-$HOME/.config}/google-chrome/NativeMessagingHosts" \
  "${XDG_CONFIG_HOME:-$HOME/.config}/chromium/NativeMessagingHosts" \
  "${XDG_CONFIG_HOME:-$HOME/.config}/microsoft-edge/NativeMessagingHosts"; do
  mkdir -p "$manifest_dir"
  printf '%s' "$manifest_json" > "$manifest_dir/ai.webagentmate.bridge.json"
  chmod 644 "$manifest_dir/ai.webagentmate.bridge.json"
done

echo "Installed WebAgentMate Bridge for extension: $extension_id"
