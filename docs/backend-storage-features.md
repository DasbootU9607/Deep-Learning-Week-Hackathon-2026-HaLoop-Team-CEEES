# Backend Storage Feature Notes (Demo + Prod)

This project now supports two backend storage modes.

## Mode 1: Demo (`BACKEND_MODE=demo`)

Primary store:

- `guardian-web/.data/integration-store.json`

Compatibility mirror:

- `guardian-web/.data/backend-mirror.sqlite`
- schema: `sqlite/migrations/0001_init.sql`

Use this mode for stable hackathon demos with deterministic local data.

## Mode 2: Prod (`BACKEND_MODE=prod`)

Primary store:

- PostgreSQL via Prisma
- schema: `guardian-web/prisma/schema.prisma`
- migrations: `guardian-web/prisma/migrations/`

Async execution:

- Redis + BullMQ worker queue for long-running plan jobs
- retries + exponential backoff + dead-letter queue

## Retained Functional Capabilities

1. Approval request persistence and idempotent replay behavior.
2. Reviewer decision tracking (`approved`, `rejected`, `changes_requested`).
3. Audit trail for plan generation and approval lifecycle events.
4. Risk metadata continuity (score, level, reasons, policy context).
5. Incident mode and policy configuration persistence.

## Runtime Notes

- In `prod` mode, SQLite mirror writes are disabled so Postgres remains the single source of truth.
- In `demo` mode, existing compatibility behavior is preserved.
