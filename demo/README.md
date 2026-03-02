# Plugin + Dashboard Demo Kit

This folder is a ready demo runbook for showing the AI Governance VS Code plugin and the Guardian dashboard working together.

## What This Demo Shows

1. Low-risk plugin flow (no approval needed).
2. High-risk plugin flow (approval ticket appears on dashboard).
3. Reviewer approval on dashboard unblocks plugin apply.
4. Reviewer rejection on dashboard denies plugin action.
5. Incident mode blocks approval actions with a server-side warning.

## Prerequisites

- Node.js + npm installed.
- VS Code installed.
- Dependencies installed:
  - `cd guardian-web && npm ci`
  - `cd ide-plugin && npm ci`

## Start Services

1. Start dashboard/backend:

```bash
cd guardian-web
npm run dev
```

2. Confirm dashboard URL (usually `http://localhost:3000`).

3. Build plugin:

```bash
cd ide-plugin
npm run build
```

## Run Plugin In VS Code

Use one of these methods.

### Method A: Extension Development Host (recommended)

1. Open `ide-plugin/` in VS Code.
2. Press `F5` and run `Extension` debug target.
3. In the new Extension Development Host window, open the repository root.
4. Set workspace settings using `demo/vscode-settings.sample.json` values.

### Method B: CLI

```bash
code --extensionDevelopmentPath "$(pwd)/ide-plugin" "$(pwd)"
```

Run this command from repository root.

## Demo Script

Follow `demo/USECASES.md` from top to bottom.

## Reset Demo State

If dashboard data gets noisy, reset to clean mock baseline:

```bash
bash demo/scripts/reset-demo-state.sh
```

## Optional Automated Validation

After starting `guardian-web` dev server:

```bash
cd guardian-web
BASE_URL=http://localhost:3000 npm run test:integration
```

This verifies approve, reject, realtime decision events, incident blocking, and policy persistence.
