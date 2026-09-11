#!/bin/bash
set -euo pipefail

extension_id="${1:-lmlkkallnnjijicmfmfdelnamcnhflfg}"
if [[ $# -gt 1 || ! "$extension_id" =~ ^[a-p]{32}$ ]]; then
  echo "Usage: $0 [chrome-extension-id]" >&2
  exit 2
fi
script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/.." && pwd)"
payload="$script_dir"

# Source checkouts are maintainer builds; downloaded packages are offline.
if [[ -f "$project_dir/bridge/Cargo.toml" ]]; then
  if [[ ! -x "$project_dir/bridge/target/release/webagentmate-bridge" || ! -f "$project_dir/bridge/runtime-dist/agent.mjs" ]]; then
    "$project_dir/scripts/build-bridge.sh"
  fi
  node "$project_dir/scripts/installer/prepare.cjs" --platform darwin --arch "$(node -p process.arch)" --binary "$project_dir/bridge/target/release/webagentmate-bridge" --out "$project_dir/build/installer-payload"
  payload="$project_dir/build/installer-payload"
fi
if [[ ! -f "$payload/runtime/node/bin/node" || ! -f "$payload/setup.cjs" || ! -f "$payload/bundle.json" ]]; then
  echo "Incomplete Connector package. Download and extract the complete package again." >&2
  exit 1
fi
# Some ZIP extractors discard executable permissions.
chmod u+x "$payload/runtime/node/bin/node" "$payload/webagentmate-bridge"
"$payload/runtime/node/bin/node" "$payload/setup.cjs" install "$payload" "$extension_id"
echo "Installed WebAgentMate Connector. Restart Chrome or reload the extension."
