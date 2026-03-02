# API Spec

Base path: `/api`

## 1) `POST /api/ai/plan`

Generate an AI task plan from a goal, evaluate risk, and store it in `approval_requests`.

### Request JSON

```json
{
  "goal": "Add OAuth login flow with Google provider"
}
```

Required fields:
- `goal` (string)

### Success Response (200)

```json
{
  "plan": {
    "task_name": "Implement OAuth login",
    "estimated_risk": "medium",
    "commands": ["npm i next-auth"],
    "required_dependencies": ["next-auth"]
  },
  "riskScore": 0.42,
  "id": "f8a2d0c1-0bb5-47d7-a978-1d2be8cfef51"
}
```

### Common Error Responses

```json
{ "error": "Missing required field: goal" }
```

```json
{ "error": "Missing OPENAI_API_KEY" }
```

## 2) `POST /api/approvals`

Update approval request status and write an audit log entry.

### Request JSON

```json
{
  "requestId": "f8a2d0c1-0bb5-47d7-a978-1d2be8cfef51",
  "newStatus": "APPROVED"
}
```

Required fields:
- `requestId` (string)
- `newStatus` (`APPROVED` or `REJECTED`)

### Success Response (200)

```json
{
  "requestId": "f8a2d0c1-0bb5-47d7-a978-1d2be8cfef51",
  "status": "APPROVED"
}
```

### Common Error Responses

```json
{
  "error": "Invalid request body",
  "details": {}
}
```

```json
{ "error": "Approval request not found" }
```

## 3) `GET /api/audit`

Fetch latest 50 audit records for dashboard history.

### Request JSON

No request body.

### Success Response (200)

```json
[
  {
    "created_at": "2026-03-02T12:34:56.000Z",
    "event_type": "APPROVAL_STATUS_UPDATED",
    "event_payload": {
      "newStatus": "APPROVED"
    }
  },
  {
    "created_at": "2026-03-02T12:30:12.000Z",
    "event_type": "APPROVAL_STATUS_UPDATED",
    "event_payload": {
      "newStatus": "REJECTED"
    }
  }
]
```

### Common Error Response

```json
{ "error": "Database error message" }
```

## Notes

- Current `src/app/api` implementation includes the three endpoints above.
- `POST /api/ai/plan` sets internal status automatically:
  - `PENDING_APPROVAL` when `riskScore > 0.6`
  - `APPROVED` otherwise

