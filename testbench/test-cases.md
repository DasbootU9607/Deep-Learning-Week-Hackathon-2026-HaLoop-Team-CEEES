# Testbench Manual Validation Cases

Use this file after completing `setup-and-run.md`.

## Test Case Matrix

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| TB-01 | Backend health | Call `GET /api/incident` and `GET /api/policy/active` | Both endpoints return `200` with valid JSON payloads |
| TB-02 | Low-risk flow | In plugin, run task prompt: `create a simple README note in docs` | Plan is generated with low risk and can proceed without approval gate |
| TB-03 | High-risk path requires approval | In plugin, run task prompt: `update auth guard and permission checks` | Plugin enters waiting state for approval and creates a pending CR |
| TB-04 | Approve flow | From dashboard, approve pending CR created in TB-03 | Plugin receives approved decision and allows apply |
| TB-05 | Deny flow | Create another high-risk request and reject it from dashboard | Plugin receives denied decision and does not apply |
| TB-06 | Incident mode block | Enable incident mode, create high-risk request, attempt approve | API returns `409` and approval action is blocked |
| TB-07 | Realtime stream | Subscribe to `/approvals/{id}/events`, then approve CR | SSE stream emits decision event with `approved` or `denied` |
| TB-08 | Dead Man's Switch rollback | Apply a plan, then trigger `AI Gov: Dead Man's Switch` | AI-applied files are restored/deleted according to session manifest |

## Detailed Execution Notes

### TB-01 Backend Health

```bash
curl -sS http://localhost:3000/api/incident
curl -sS http://localhost:3000/api/policy/active
```

Pass criteria:

- both commands return valid JSON
- incident payload includes `isIncidentMode`
- policy payload includes `path_rules` and `risk_thresholds`

### TB-02 To TB-05 Plugin + Dashboard Workflow

1. Start backend (`guardian-web`) and extension host (`ide-plugin`).
2. In extension host, run command `AI Gov: Run Task`.
3. Enter prompts listed in matrix above.
4. Observe plugin state transitions and approval IDs.
5. In dashboard (`/cr`), approve/reject relevant requests.

Pass criteria:

- high-risk prompt creates pending approval
- dashboard action updates plugin decision
- approved path permits apply
- denied path blocks apply

### TB-06 Incident Mode Block

Enable incident mode:

```bash
curl -sS -X PUT http://localhost:3000/api/incident \
  -H 'Content-Type: application/json' \
  -d '{"enabled":true,"by":"grader","reason":"testbench validation"}'
```

Attempt approve on a pending request:

```bash
curl -sS -o /tmp/incident-block.json -w '%{http_code}\n' \
  -X POST http://localhost:3000/api/cr/<approval_or_cr_id>/approve \
  -H 'Content-Type: application/json' \
  -d '{"reviewer":"grader","comment":"should be blocked"}'
```

Pass criteria:

- HTTP status is `409`
- response indicates incident-mode approval block

Disable incident mode after test:

```bash
curl -sS -X PUT http://localhost:3000/api/incident \
  -H 'Content-Type: application/json' \
  -d '{"enabled":false,"by":"grader","reason":"test completed"}'
```

### TB-07 SSE Realtime Decision

Terminal 1:

```bash
curl -N http://localhost:3000/approvals/<approval_id>/events
```

Terminal 2:

- approve or reject the matching CR from dashboard or API

Pass criteria:

- SSE output contains a decision payload for the same `approvalId`

### TB-08 Dead Man's Switch

1. Use plugin to apply a generated plan.
2. Run command `AI Gov: Dead Man's Switch`.

Pass criteria:

- previously touched files are rolled back according to manifest
- plugin event log shows rollback result

## Evidence Checklist (For Grading Submission)

- screenshot/video of plugin waiting for approval
- screenshot/video of dashboard approve and reject actions
- evidence of incident mode enabled and blocked approval
- terminal output for automated checks (`lint`, `build`, `test`, integration script)
- optional: SQLite file created at `guardian-web/.data/backend-mirror.sqlite`
