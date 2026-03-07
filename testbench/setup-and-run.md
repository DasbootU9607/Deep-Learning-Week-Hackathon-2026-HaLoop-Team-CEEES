# Testbench Setup And Run Guide

This document is the step-by-step setup and execution flow for graders.

## 1. System Prerequisites

Required on all operating systems:

- `git`
- Node.js `22.x`
- `npm`
- VS Code `1.90+`

Required for shell-based integration checks:

- `bash`
- `curl`
- `jq`
- `uuidgen`

Optional:

- VS Code CLI `code` in PATH

## 2. Verify Tooling

Run:

```bash
node -v
npm -v
git --version
code --version
curl --version
jq --version
uuidgen
```

If `code` is unavailable, launch the extension host manually from VS Code (`F5`).

## 3. Clone And Install

From repository root:

```bash
cd guardian-web && npm ci
cd ../ide-plugin && npm ci
cd ..
npm install @prisma/client
```

This final command installs the local Prisma client dependency needed for the testbench flow.

## 4. Start Backend And Dashboard

Terminal A:

```bash
cd guardian-web
npm run dev
```

Expected: Next.js app starts at `http://localhost:3000`.

Health check:

```bash
curl -sS http://localhost:3000/api/incident
```

Expected response includes `isIncidentMode`.

## 5. Build And Start IDE Plugin

Terminal B:

```bash
cd ide-plugin
npm run build
```

Then run extension host by either:

1. VS Code manual path
- Open `ide-plugin/` in VS Code
- Press `F5`
- Select `Extension` launch target

2. CLI path

```bash
code --extensionDevelopmentPath "$(pwd)" "$(pwd)/.."
```

## 6. Configure Plugin Settings (Inside Extension Host Window)

Add/update workspace settings:

```json
{
  "aiGov.backendUrl": "http://localhost:3000",
  "aiGov.apiKey": "",
  "aiGov.requestedBy": "grader",
  "aiGov.pollIntervalMs": 3000
}
```

Notes:

- `aiGov.backendUrl` can be `http://localhost:3000` or `http://localhost:3000/api`.
- The plugin normalizes both forms automatically.

## 7. Run Automated Validation

### 7.1 Backend lint + production build

```bash
cd guardian-web
npm run lint
npm run build
```

Expected:

- lint has zero errors
- build completes successfully

### 7.2 Plugin build + tests

```bash
cd ../ide-plugin
npm run build
npm test
```

Expected:

- build succeeds
- vitest passes all tests

### 7.3 End-to-end approval integration script

Ensure backend server is still running, then:

```bash
cd ../guardian-web
BASE_URL=http://localhost:3000 npm run test:integration
```

Expected final line:

`Integration checks passed: policy persistence, approval allow/deny, realtime events, and incident blocking all work.`

## 8. Reset State Between Test Runs

From repository root:

```bash
bash demo/scripts/reset-demo-state.sh
```

If needed, remove SQLite mirror:

- `guardian-web/.data/backend-mirror.sqlite`

## 9. Troubleshooting

### Plugin warning: backend approval service is not configured

1. Confirm backend is running at `http://localhost:3000`.
2. Confirm `aiGov.backendUrl` in extension host workspace settings.
3. Reload extension host window after settings updates.
4. Rebuild plugin (`npm run build`) and retry.

### Integration script fails with missing commands

Install missing shell tools: `curl`, `jq`, `uuidgen`, and run in a shell with `bash`.

### Webview bundle missing

Run:

```bash
cd ide-plugin
npm run build
```
