#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-3000}"

cd "$ROOT_DIR/guardian-web"
PORT="$PORT" npm run dev
