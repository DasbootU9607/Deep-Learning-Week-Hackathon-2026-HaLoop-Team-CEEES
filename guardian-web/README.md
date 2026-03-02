# guardian-web

`guardian-web` is the dashboard + backend API service for governance workflows.

It provides:

- CR listing/detail pages
- approval/reject/request-changes actions
- incident mode and policy management
- audit views
- backend routes used by `ide-plugin`
- SQLite mirror persistence for backend-compatibility records

## Prerequisites

- Node.js `22.x`
- npm

Optional for script-based integration checks:

- `bash`
- `curl`
- `jq`
- `uuidgen`

## Install

```bash
npm ci
```

## Run

```bash
npm run dev
```

Default URL: `http://localhost:3000`

## Build and Lint

```bash
npm run lint
npm run build
```

## Data Storage

### Local integration store

- file: `.data/integration-store.json`
- purpose: primary mock CR/policy/audit store used by dashboard workflows

### SQLite backend mirror

- file: `.data/backend-mirror.sqlite` (default)
- override: `SQLITE_DB_PATH`
- purpose: persistence layer for backend compatibility API flows (`/api/ai/plan`, `/api/approvals`, compact audit)

Schema reference:

- `../sqlite/migrations/0001_init.sql`

Feature mapping reference:

- `../docs/backend-storage-features.md`

## Key Routes

### Plugin-facing routes

- `POST /generate-plan`
- `POST /approvals`
- `GET /approvals/:approvalId/decision`
- `GET /approvals/:approvalId/events`

### Dashboard API routes

- `GET /api/cr`
- `GET /api/cr/:id`
- `POST /api/cr/:id/approve`
- `POST /api/cr/:id/reject`
- `POST /api/cr/:id/request-changes`
- `GET /api/audit`
- `GET /api/incident`
- `PUT /api/incident`
- `GET /api/policy/active`
- `PUT /api/policy/path-rules`

### Compatibility routes

- `POST /api/ai/plan`
- `POST /api/approvals`
- `GET /api/audit?view=compact`

## Integration Test Script

Run with dashboard dev server already up:

```bash
BASE_URL=http://localhost:3000 npm run test:integration
```

Script file:

- `scripts/test-integration-flow.sh`

## Reset Local Demo State

From repo root:

```bash
bash demo/scripts/reset-demo-state.sh
```

This resets `.data/integration-store.json`.
If needed, also delete `.data/backend-mirror.sqlite`.
