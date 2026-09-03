#!/bin/bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
cargo build --manifest-path "$project_dir/bridge/Cargo.toml" --release "$@"
echo "Bridge build completed."
