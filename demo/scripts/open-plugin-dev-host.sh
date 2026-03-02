#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if ! command -v code >/dev/null 2>&1; then
  echo "VS Code CLI 'code' not found. Install it from VS Code: Command Palette -> Shell Command: Install 'code' command in PATH."
  exit 1
fi

code --extensionDevelopmentPath "$ROOT_DIR/ide-plugin" "$ROOT_DIR"
