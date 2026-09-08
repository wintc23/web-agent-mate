#!/bin/bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_dir"
npm run build:runtime
cargo build --manifest-path "$project_dir/bridge/Cargo.toml" --release "$@"
echo "Bridge build completed."
