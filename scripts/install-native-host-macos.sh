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
install_root="$HOME/Library/Application Support/WebAgentMate"
binary_dir="$install_root/bin"
manifest_dir="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
manifest_path="$manifest_dir/ai.webagentmate.bridge.json"

if [[ ! -x "$source_binary" ]]; then
  if [[ -x "$project_dir/scripts/build-bridge.sh" ]]; then
    "$project_dir/scripts/build-bridge.sh"
  else
    echo "Bridge binary is missing. Download the release package for your Mac." >&2
    exit 1
  fi
fi

mkdir -p "$binary_dir" "$manifest_dir"
install -m 755 "$source_binary" "$binary_dir/webagentmate-bridge"
runtime_source="$project_dir/bridge/runtime-dist/agent.mjs"
if [[ -f "$script_dir/runtime/agent.mjs" ]]; then runtime_source="$script_dir/runtime/agent.mjs"; fi
if [[ ! -f "$runtime_source" ]]; then
  echo "Runtime bundle missing. Run npm run build:runtime before installing." >&2
  exit 1
fi
mkdir -p "$binary_dir/runtime"
install -m 644 "$runtime_source" "$binary_dir/runtime/agent.mjs"
if [[ -d "$(dirname "$runtime_source")/licenses" ]]; then cp -R "$(dirname "$runtime_source")/licenses" "$binary_dir/runtime/"; fi
if [[ -d "$(dirname "$runtime_source")/node" ]]; then cp -R "$(dirname "$runtime_source")/node" "$binary_dir/runtime/"; fi

temporary="$(mktemp "$manifest_dir/ai.webagentmate.bridge.XXXXXX")"
printf '{\n  "name": "ai.webagentmate.bridge",\n  "description": "WebAgentMate native bridge",\n  "path": "%s",\n  "type": "stdio",\n  "allowed_origins": ["chrome-extension://%s/"]\n}\n' \
  "$binary_dir/webagentmate-bridge" "$extension_id" > "$temporary"
chmod 644 "$temporary"
mv "$temporary" "$manifest_path"

echo "Installed WebAgentMate Bridge for extension: $extension_id"
echo "Restart Chrome or reload the extension before testing."
