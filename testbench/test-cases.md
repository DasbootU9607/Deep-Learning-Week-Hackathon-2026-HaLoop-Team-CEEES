# Testbench Manual Validation Cases

Use this file after completing `setup-and-run.md`.

## Demo Auth Actors

Mutating dashboard and API actions now require an authenticated demo actor. The dashboard top bar exposes the same identities via the Actor Switcher.

| Actor | Bearer token | Role | Expected permissions |
| --- | --- | --- | --- |
| Avery Admin | `haloop-admin-token` | `admin` | approve, reject, edit policy, toggle incident mode |
| Lina Lead | `haloop-lead-token` | `lead` | approve, reject, edit policy, toggle incident mode |
| Devon Developer | `haloop-developer-token` | `developer` | approve only |
| Vera Viewer | `haloop-viewer-token` | `viewer` | read-only |

Helper exports for API-based checks:

```bash
export ADMIN_TOKEN=haloop-admin-token
export LEAD_TOKEN=haloop-lead-token
export DEVELOPER_TOKEN=haloop-developer-token
export VIEWER_TOKEN=haloop-viewer-token
```

## Test Case Matrix

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| TB-01 | Backend health and runtime visibility | Call `GET /api/incident`, `GET /api/policy/active`, and `GET /api/runtime` | All endpoints return `200` with valid JSON; runtime payload includes `mode`, `queueEnabled`, and `datastore` |
| TB-02 | Low-risk auto-approved flow | In plugin, run prompt `create a tiny helper module with one exported constant` | Plugin shows low-risk rationale, no approval ticket is created, and audit records `plan_generated` plus `auto_approved_low_risk` |
| TB-03 | Medium-risk warning flow | In plugin, run prompt `refactor multi-file workflow for generated helpers` | Plugin shows a warning-style rationale with visible local/backend/final risk breakdown, but no manual approval gate |
| TB-04 | Blocked deny-rule flow | In plugin, run prompt `update production infra terraform settings` | Plugin marks the plan as blocked, cites the deny rule on `infra/prod/**`, and does not allow apply |
| TB-05 | High-risk auth-sensitive flow | In plugin, run prompt `update auth guard and permission checks` | Plugin enters waiting state, creates a pending CR, and explains that auth code matched a protected rule |
| TB-06 | Dual approval for very high risk CR | Approve the TB-05 CR once as `lead`, then again as `admin` | After the first approval the CR stays pending; after the second distinct approval it becomes approved |
| TB-07 | RBAC enforcement | Try the CR detail page as `viewer`, then try the policy page as `developer` | Viewer cannot approve or reject; developer cannot save policy changes |
| TB-08 | Incident mode approval block | Enable incident mode, create a fresh high-risk CR, then attempt approval | API returns `409` and the approval action is blocked |
| TB-09 | Verification evidence surfaced | Open the CR detail page for a high-risk request | Evidence panel shows executed or recommended checks, including command, scope, status, and summary |
| TB-10 | Realtime approval stream | Subscribe to `/approvals/{id}/events`, then approve or reject the same request | SSE emits a decision event for the matching approval ID |
| TB-11 | Dead Man's Switch rollback | Apply an approved plan, then trigger `AI Gov: Dead Man's Switch` | AI-applied files are restored or deleted according to the session manifest |

## Detailed Execution Notes

### TB-01 Backend Health And Runtime Visibility

```bash
curl -sS http://localhost:3000/api/incident
curl -sS http://localhost:3000/api/policy/active
curl -sS http://localhost:3000/api/runtime
```

Pass criteria:

- all three commands return valid JSON
- incident payload includes `isIncidentMode`
- policy payload includes `path_rules`, `risk_thresholds`, and `role_permissions`
- runtime payload includes `mode`, `queueEnabled`, and `datastore`

### TB-02 To TB-05 Plugin Review Modes

1. Start backend (`guardian-web`) and extension host (`ide-plugin`).
2. In the extension host, run command `AI Gov: Run Task`.
3. Enter the prompt listed in the matrix for each case.
4. Observe the plugin webview for `Why this decision happened`, the local/backend/final risk breakdown, matched policy rules, and guardrail pass/fail state.
5. For TB-02 and TB-03, confirm no approval ticket is created.
6. For TB-05, note the created approval ID and open the matching CR in the dashboard.

Pass criteria:

- TB-02 shows `auto_approved` reasoning that references the low score, small blast radius, and clean guardrails
- TB-03 shows a warning-style rationale and still allows preview without waiting for approval
- TB-04 shows `blocked` behavior tied to the deny rule for production infra changes
- TB-05 shows `approval_required` behavior tied to authentication-sensitive code and the matched policy rule
- audit view or `GET /api/audit` includes `plan_generated`, plus `auto_approved_low_risk` for TB-02 and `approval_required_high_risk` for TB-05

### TB-06 Dual Approval For Very High Risk CR

Use the pending CR created in TB-05. If needed, fetch it with:

```bash
curl -sS http://localhost:3000/api/cr | jq 'map(select(.status=="pending_approval")) | .[0].id'
```

Approve once as `lead`:

```bash
curl -sS -X POST http://localhost:3000/api/cr/<cr_id>/approve \
  -H "Authorization: Bearer $LEAD_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"comment":"Lead approval for auth-sensitive change"}'
```

Check the CR after the first approval:

```bash
curl -sS http://localhost:3000/api/cr/<cr_id>
```

Approve again as `admin`:

```bash
curl -sS -X POST http://localhost:3000/api/cr/<cr_id>/approve \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"comment":"Admin approval to satisfy dual approval"}'
```

Pass criteria:

- the CR reports `required_approvals: 2`
- the first approval leaves the CR in `pending_approval`
- the second approval comes from a different actor and moves the CR to `approved`
- the approval panel shows the running count toward `2/2`

### TB-07 RBAC Enforcement

1. In the dashboard actor switcher, select `Vera Viewer` and open a pending CR detail page.
2. Confirm that approve, reject, and request-changes actions are disabled.
3. Switch to `Devon Developer` and open the policy page.
4. Confirm that policy update controls are unavailable or blocked for that role.

Optional API check for viewer approval denial:

```bash
curl -sS -o /tmp/viewer-approve.json -w '%{http_code}\n' \
  -X POST http://localhost:3000/api/cr/<cr_id>/approve \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"comment":"viewer should be denied"}'
```

Pass criteria:

- viewer cannot approve from the UI
- developer cannot configure policy from the UI
- API-based viewer approval returns `403`
- the dashboard clearly shows which actor and role are active

### TB-08 Incident Mode Approval Block

Enable incident mode as `admin`:

```bash
curl -sS -X PUT http://localhost:3000/api/incident \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"enabled":true,"reason":"testbench validation"}'
```

Create a fresh high-risk request in the plugin with prompt:

```text
update auth guard and permission checks
```

Attempt approval on the new pending CR:

```bash
curl -sS -o /tmp/incident-block.json -w '%{http_code}\n' \
  -X POST http://localhost:3000/api/cr/<cr_id>/approve \
  -H "Authorization: Bearer $LEAD_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"comment":"should be blocked during incident mode"}'
```

Disable incident mode after test:

```bash
curl -sS -X PUT http://localhost:3000/api/incident \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"enabled":false,"reason":"test completed"}'
```

Pass criteria:

- incident mode toggle succeeds for `admin`
- approval attempt returns HTTP `409`
- response indicates incident-mode approval block
- dashboard incident banner and approval panel both reflect the block

### TB-09 Verification Evidence

Inspect the CR detail page for a high-risk request created in TB-05 or TB-08.

Pass criteria:

- the Evidence panel shows whether each item is an `Executed check` or `Recommended check`
- at least one item shows `Guardian Web lint` with `npm run lint` in `guardian-web`
- at least one item shows `IDE plugin tests` with `npm test` in `ide-plugin`
- plugin event log includes a verification summary before approval is requested

### TB-10 SSE Realtime Decision

Terminal 1:

```bash
curl -N http://localhost:3000/approvals/<approval_id>/events
```

Terminal 2:

1. Approve or reject the matching CR from the dashboard or API.
2. Use a valid actor such as `lead` or `admin`.

Pass criteria:

- SSE output contains a decision payload for the same `approvalId`
- the payload shows `approved` or `denied`

### TB-11 Dead Man's Switch

1. Use the plugin to apply a generated plan that is already approved or auto-approved.
2. Run command `AI Gov: Dead Man's Switch`.

Pass criteria:

- previously touched files are rolled back according to the manifest
- plugin event log shows rollback status
- files created only by the AI session are deleted if appropriate

## Evidence Checklist (For Grading Submission)

- screenshot or video of low-risk auto-approval rationale in the plugin
- screenshot or video of a blocked production infra plan
- screenshot or video of the dashboard approval count moving from `1/2` to `2/2`
- screenshot or video of viewer and developer RBAC restrictions
- evidence of incident mode enabled and the `409` approval block
- screenshot or video of executed verification evidence in the CR detail page
- terminal output for automated checks (`lint`, `build`, `test`, `eval:gate`, integration script)
- optional: demo-mode datastore files recreated at `guardian-web/.data/integration-store.json` and `guardian-web/.data/backend-mirror.sqlite`
