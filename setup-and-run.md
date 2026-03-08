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

Important:

- Do not install the latest Prisma release for this project.
- Use Prisma 6 only: `prisma@6` and `@prisma/client@6`.
- Install Prisma and `openai` inside `guardian-web`, not at the repository root.
- Run `npx prisma generate` before starting `guardian-web`.

From repository root:

```bash
cd guardian-web
npm ci
npm install prisma@6 @prisma/client@6 openai
npx prisma generate
cd ../ide-plugin
npm ci
cd ..
```

If dependency repair is needed later, rerun `npm install prisma@6 @prisma/client@6 openai` inside `guardian-web`.
Do not run unpinned Prisma installs and do not run them from the repository root.

## 4. Start Backend And Dashboard

Terminal A:

```bash
cd guardian-web
npx prisma generate
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
- Open the repository root or `ide-plugin/` in VS Code
- Press `F5`
- If you opened the repository root, select `Launch AI Gov Extension`
- If you opened `ide-plugin/` directly, use the standard extension launch target

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
- the extension now defaults to `http://localhost:3000`, which matches this testbench flow.
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
