# CEEES Deep Learning Week Hackathon 2026 Project

Track 1 project: a **safe, human-governed AI coding agent** with:

- a VS Code extension (`ide-plugin`) for AI code generation + local guardrails
- a Next.js dashboard/backend (`guardian-web`) for approvals, incident mode, policy, and audit
- demo scripts/use-cases (`demo`) for the full golden path

## Repository Layout

- `guardian-web/`: dashboard UI + backend API routes
- `ide-plugin/`: VS Code extension
- `demo/`: runbook, prompts, helper scripts
- `supabase/migrations/`: SQL migration for optional Supabase persistence
- `Planning/`: architecture and team/work-distribution docs

## Prerequisites

- Node.js 18+ and npm
- VS Code
- (Optional) Supabase project if you want persistent backend storage

## Quick Start (Local Demo Mode, No Supabase Required)

This mode works fully for the hackathon demo path using local `.data` storage.

1. Install dependencies:

```bash
cd guardian-web && npm ci
cd ../ide-plugin && npm ci
cd ..
```

2. Start dashboard/backend:

```bash
cd guardian-web
npm run dev
```

3. Build plugin:

```bash
cd ../ide-plugin
npm run build
```

4. Run extension development host (from repo root):

```bash
bash demo/scripts/open-plugin-dev-host.sh
```

Alternative: open `ide-plugin/` in VS Code and press `F5` (`Extension` target).

5. In the Extension Development Host, configure workspace settings:

```json
{
  "aiGov.backendUrl": "http://localhost:3000",
  "aiGov.apiKey": "",
  "aiGov.requestedBy": "demo-presenter",
  "aiGov.pollIntervalMs": 3000
}
```

You can copy values from `demo/vscode-settings.sample.json`.

6. Run the demo scenarios in order:

- `demo/USECASES.md`

## Optional: Enable Supabase Persistence

If configured, backend routes mirror approval/audit data to Supabase.

1. Create `guardian-web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

2. Apply migration SQL from:

- `supabase/migrations/0001_init.sql`

Use Supabase SQL Editor (or your preferred migration workflow).

3. Restart dashboard:

```bash
cd guardian-web
npm run dev
```

If env vars are missing, the app falls back to local `.data` storage automatically.

## API Endpoints

### Plugin-facing endpoints (used by `ide-plugin`)

- `POST /generate-plan`
- `POST /approvals`
- `GET /approvals/:approvalId/decision`
- `GET /approvals/:approvalId/events` (SSE realtime decisions)

### Backend compatibility endpoints

- `POST /api/ai/plan` (goal-based plan API)
- `POST /api/approvals` (status update API)
- `GET /api/audit`
- `GET /api/audit?view=compact` (backend-style compact audit payload)

## Useful Commands

Run guardian-web checks:

```bash
cd guardian-web
npm run lint
npm run build
```

Run plugin tests:

```bash
cd ide-plugin
npm test
```

Run integration flow checks (requires `curl`, `jq`, `uuidgen` and running dashboard):

```bash
cd guardian-web
BASE_URL=http://localhost:3000 npm run test:integration
```

Reset local demo state:

```bash
bash demo/scripts/reset-demo-state.sh
```
