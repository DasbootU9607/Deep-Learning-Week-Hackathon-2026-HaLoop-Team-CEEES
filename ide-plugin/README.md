# ide-plugin

`ide-plugin` is the VS Code extension for AI-assisted coding with governance guardrails.

Core behaviors:

- collects local coding context
- requests plan generation from backend
- evaluates risk locally
- requires approval for high-risk plans
- waits for approval decision via polling/SSE
- applies approved file changes
- supports rollback via Dead Man's Switch

## Prerequisites

- Node.js `22.x`
- npm
- VS Code `1.90+`

## Install

```bash
npm ci
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Run Extension Host

Option A:

1. Open `ide-plugin/` in VS Code.
2. Press `F5`.
3. Select `Extension` launch target.

Option B (from repo root):

```bash
code --extensionDevelopmentPath "$(pwd)/ide-plugin" "$(pwd)"
```

## Required VS Code Settings

Set these in workspace settings (extension host window):

```json
{
  "aiGov.backendUrl": "http://localhost:3000",
  "aiGov.apiKey": "",
  "aiGov.requestedBy": "demo-presenter",
  "aiGov.pollIntervalMs": 3000
}
```

Notes:

- `aiGov.backendUrl` accepts `http://localhost:3000` or `http://localhost:3000/api`.
- by default the extension points to `http://localhost:3000`, which matches the planned demo/testbench flow.
- if `aiGov.backendUrl` is empty, plugin tries local auto-detection.
- if backend is unreachable, plugin can fall back to local simulated approval.

## Commands

- `AI Gov: Open Chat`
- `AI Gov: Run Task`
- `AI Gov: Dead Man's Switch`

## Backend Endpoints Used

- `POST /generate-plan`
- `POST /approvals`
- `GET /approvals/:approvalId/decision`
- `GET /approvals/:approvalId/events`

## Troubleshooting

### "No backend approval service configured"

1. Confirm backend is running at `http://localhost:3000`.
2. Check `aiGov.backendUrl` in workspace settings.
3. Reload extension host window.
4. Rebuild plugin (`npm run build`) and retry.

### Webview says bundle missing

Run:

```bash
npm run build
```
