> Historical planning note. Current implementation docs live in `../README.md`.

# IDE Plugin Integration (M2)

This document lists every backend endpoint the VS Code IDE plugin currently requires, where to configure it, and what the backend side must implement.

## 1) Where To Configure In VS Code

Set these in VS Code settings (`settings.json`) under `aiGov.*`:

- `aiGov.backendUrl`: Base URL used by all plugin HTTP calls.
- `aiGov.apiKey`: Optional bearer token (`Authorization: Bearer <apiKey>`).
- `aiGov.requestedBy`: Identity string attached to approval requests.
- `aiGov.pollIntervalMs`: Polling interval for approval decision fallback.

Example:

```json
{
  "aiGov.backendUrl": "https://your-backend.example.com",
  "aiGov.apiKey": "your-token",
  "aiGov.requestedBy": "m2-dev",
  "aiGov.pollIntervalMs": 3000
}
```

## 2) Required Endpoints

| Where configured | Endpoint | Method | What backend must do (other side) | What this endpoint is for |
|---|---|---|---|---|
| `aiGov.backendUrl` | `/generate-plan` | `POST` | Accept plugin prompt + context, run AI orchestration, compute backend risk, return strict schema response. Must return JSON matching `GeneratePlanResponse`. | Generate plan/changes preview + risk metadata before apply. |
| `aiGov.backendUrl` | `/approvals` | `POST` | Persist incoming approval request, mark as pending, trigger dashboard/reviewer workflow, and (optionally) push realtime event to reviewers. Return stored request JSON. | Create high-risk approval ticket when plugin intercepts risky actions. |
| `aiGov.backendUrl` | `/approvals/:approvalId/decision` | `GET` | Return current decision when available (`approved`/`denied`) as `ApprovalDecisionEvent`. While pending, return `204` or `404`. | Polling fallback so plugin can unblock when reviewer decides. |

## 3) Contracts The Backend Must Match

Source of truth: `ide-plugin/src/schemas/contracts.ts`.

### 3.1 `POST /generate-plan`

Request (`GeneratePlanRequest`):

- `sessionId: string`
- `prompt: string`
- `context.workspaceRoot: string`
- `context.branch: string`
- `context.activeFile?: string`
- `context.selectedText?: string`
- `context.openTabs: string[]`
- `context.fileSnippets?: { path, content, startLine, endLine }[]`

Response (`GeneratePlanResponse`):

- `planId: string`
- `summary: string`
- `changes: FileChange[]` where `FileChange = { path, action, newContent?, oldContentHash? }`
- `proposedCommands: string[]`
- `backendRisk: { score: 0-100, level: low|medium|high, reasons: string[] }`

### 3.2 `POST /approvals`

Request (`ApprovalRequest`):

- `approvalId: string`
- `planId: string`
- `sessionId: string`
- `requestedBy: string`
- `risk: { score: 70-100, level: "high", reasons: string[] }`
- `blastRadius: { files: string[], commandCount: number }`
- `createdAt: string`

Response:

- Return the created/stored `ApprovalRequest` (same schema).

### 3.3 `GET /approvals/:approvalId/decision`

Response when decided (`ApprovalDecisionEvent`):

- `approvalId: string`
- `decision: "approved" | "denied"`
- `reviewer: string`
- `reason?: string`
- `decidedAt: string`

Response while pending:

- `204 No Content` or `404 Not Found` (plugin treats both as pending).

## 4) Auth/Headers Expected By Plugin

For all HTTP calls:

- `Content-Type: application/json`
- `Authorization: Bearer <aiGov.apiKey>` only when `aiGov.apiKey` is non-empty.

## 5) Realtime Note

Current plugin implementation always works with polling (`GET /approvals/:id/decision`).

The planning spec also calls for Supabase realtime push; to enable true push events, wire your backend/dashboard realtime into `ide-plugin/src/infra/supabaseRealtime.ts` behavior so approval decisions can arrive instantly (without waiting for poll interval).

## 6) Failure Behavior (important for backend)

- Non-2xx from required endpoints => plugin enters `ERROR` state.
- Schema mismatch => plugin rejects response and enters `ERROR` with validation detail.
- Decision timeout (default 10 min) => plugin enters `ERROR`.
