# Backend Storage Feature Notes (Supabase -> SQLite)

This project previously mirrored backend data to Supabase. That mirror has been replaced with a local SQLite mirror while preserving the same feature intent.

## Retained Features

1. Approval request persistence
- Stores plan metadata, risk score, risk level, status, touched files, and policy hits.
- Supports upsert by `approvalId` so plugin retries are idempotent.

2. Reviewer decision tracking
- Persists `approved`, `rejected`, and `changes_requested` outcomes.
- Updates approval request status and timestamp.

3. Audit trail
- Appends audit records for:
  - approval request creation
  - approval status updates
  - plan generation through `/api/ai/plan`
- Supports compact audit read model for backend consumers.

4. Actor identity normalization
- Keeps lightweight `profiles` table.
- Derives deterministic local email from display name.
- Upserts actor profile before writing approval/audit rows.

5. Risk metadata continuity
- Stores 0-100 risk score and mapped risk level (`low`, `med`, `high`, `critical`).
- Preserves backend risk reasons and policy-hit context.

## SQLite Storage Location

- Default path: `guardian-web/.data/backend-mirror.sqlite`
- Override with env var: `SQLITE_DB_PATH`

## Schema Source

- Canonical migration for SQLite mirror:
  - `sqlite/migrations/0001_init.sql`

## Current API Compatibility

The following routes continue working with SQLite-backed mirror persistence:

- `POST /approvals`
- `GET /approvals/:approvalId/decision`
- `GET /approvals/:approvalId/events`
- `POST /api/approvals`
- `POST /api/ai/plan`
- `GET /api/audit?view=compact`
