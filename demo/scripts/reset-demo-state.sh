#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STORE_FILE="$ROOT_DIR/guardian-web/.data/integration-store.json"

if [[ -f "$STORE_FILE" ]]; then
  rm "$STORE_FILE"
  echo "Removed $STORE_FILE"
else
  echo "No store file found; nothing to reset."
fi

echo "Demo state reset. Start guardian-web and it will reinitialize with mock baseline data."
