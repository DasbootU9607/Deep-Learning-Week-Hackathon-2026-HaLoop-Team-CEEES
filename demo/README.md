# Demo Runbook

This folder contains the practical runbook for demonstrating plugin + dashboard integration.

## What The Demo Covers

1. Low-risk flow with no approval.
2. High-risk flow that creates a pending approval.
3. Approve path that unblocks plugin apply.
4. Reject path that denies plugin apply.
5. Incident mode blocking approval actions.

Detailed scenario script:

- `USECASES.md`

## Prerequisites

- Root setup completed (`README.md`)
- `guardian-web` running on `http://localhost:3000`
- `ide-plugin` built
- VS Code extension development host running

## Fast Start

From repo root:

```bash
bash demo/scripts/start-dashboard.sh
```

In another terminal:

```bash
cd ide-plugin
npm run build
```

Then start extension host:

```bash
bash demo/scripts/open-plugin-dev-host.sh
```

If `code` CLI is missing, open `ide-plugin/` in VS Code and press `F5` manually.

## Plugin Settings For Demo

Use:

- `demo/vscode-settings.sample.json`

Minimum required:

```json
{
  "aiGov.backendUrl": "http://localhost:3000"
}
```

## Reset Demo State

```bash
bash demo/scripts/reset-demo-state.sh
```

This resets local integration store data.
If needed, also delete `guardian-web/.data/backend-mirror.sqlite`.

## Optional Automated Validation

After `guardian-web` is running:

```bash
cd guardian-web
BASE_URL=http://localhost:3000 npm run test:integration
```

Script requirements:

- `bash`
- `curl`
- `jq`
- `uuidgen`
