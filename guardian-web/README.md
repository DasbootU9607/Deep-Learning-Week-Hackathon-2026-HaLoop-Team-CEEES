# guardian-web

`guardian-web` is the dashboard + backend API service for governance workflows.

It now supports two backend modes:

- `demo` mode: JSON integration store + SQLite compatibility mirror (fast local demo)
- `prod` mode: Postgres (Prisma) as source of truth + Redis/BullMQ worker queue

## Core Features

- CR listing/detail pages
- approval/reject/request-changes actions
- incident mode and policy management
- audit views
- plugin-facing approval and plan endpoints
- async plan jobs with retries, backoff, and dead-letter queue
- OpenAI structured output planning with reliability fallback
- request/job IDs and OpenTelemetry instrumentation hook
- eval gate with benchmark table generation

## Prerequisites

- Node.js `22.x`
- npm

For `prod` mode:

- PostgreSQL
- Redis

Optional for integration script:

- `bash`
- `curl`
- `jq`
- `uuidgen`

## Install

```bash
npm ci
npm run prisma:generate
```

## Run

### Demo mode (default)

```bash
npm run dev
```

### Prod mode (local infra already running)

```bash
BACKEND_MODE=prod DATABASE_URL=postgresql://postgres:postgres@localhost:5432/guardian REDIS_URL=redis://localhost:6379 npm run dev
```

Default URL: `http://localhost:3000`

## Docker Compose (Recommended for Judges)

From repo root:

```bash
docker compose up --build
```

This starts:

- `guardian-web` (Next.js backend/UI)
- `guardian-worker` (BullMQ worker)
- `postgres`
- `redis`

## Build and Lint

```bash
npm run lint
npm run build
```

## Data Storage

### Demo mode

- `.data/integration-store.json` (primary demo store)
- `.data/backend-mirror.sqlite` (compatibility mirror)

### Prod mode

- PostgreSQL via Prisma schema: `prisma/schema.prisma`
- migrations: `prisma/migrations/`

Migration command:

```bash
npm run prisma:migrate:deploy
```

## Queue + Worker

Start worker locally:

```bash
npm run worker
```

Queue settings are controlled by env vars in `.env.example`.

## Eval Gate + Benchmarks

Run evals and enforce minimum thresholds:

```bash
npm run eval:gate
```

Benchmark output:

- `../docs/backend-eval-benchmarks.md`
- `eval-results/latest-agent-evals.json`

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

### AI plan + async job routes

- `POST /api/ai/plan`
- `GET /api/jobs/:jobId`
- `POST /api/openai/webhook`

### Compatibility routes

- `POST /api/approvals`
- `GET /api/audit?view=compact`

## Integration Test Script

Run with dashboard server already up:

```bash
BASE_URL=http://localhost:3000 npm run test:integration
```

Script file: `scripts/test-integration-flow.sh`
