# Live Demo Use Cases

Use these in order during the demo.

## Setup Before Speaking

1. Keep dashboard open at `/cr` and `/incident` in browser tabs.
2. Open plugin chat with command palette: `AI Gov: Open Chat`.
3. Ensure `aiGov.backendUrl` points to your running dashboard server.

## UC1: Low-Risk Path (No Approval)

Prompt:

```text
Create a short documentation note in docs/demo-note.md describing this repository.
```

Expected plugin behavior:

- Status reaches `PREVIEW_READY`.
- Risk decision is `ALLOW`.
- `Apply` button is enabled immediately.

Expected dashboard behavior:

- No new approval ticket is created (only high-risk requests create tickets).

## UC2: High-Risk Auth Change Triggers Dashboard Alert

Prompt:

```text
Modify auth guard to enforce stricter token validation and update auth middleware.
```

Expected plugin behavior:

- Status goes to `WAITING_APPROVAL`.
- Event log shows `Approval requested: <approvalId>`.

Expected dashboard behavior:

- New CR appears in `/cr` with status `Pending`.
- CR risk level shows high.

## UC3: Approve On Dashboard Unblocks Plugin

Action on dashboard:

1. Open pending CR from UC2.
2. Click `Approve` with comment `Approved in live demo`.

Expected plugin behavior:

- Status changes to `APPROVED`.
- `Apply` becomes enabled.
- Click `Apply` to finish; status becomes `APPLIED`.

## UC4: Rejection Path

Prompt:

```text
Update package.json dependencies and modify auth permissions logic.
```

Action on dashboard:

1. Open new pending CR.
2. Click `Reject`.

Expected plugin behavior:

- Status changes to `DENIED`.
- `Apply` remains disabled.

## UC5: Incident Mode Warning + Server-Side Block

1. In dashboard `/incident`, enable Incident Mode.
2. In plugin run a high-risk prompt:

```text
Change auth policy and migration behavior for account sessions.
```

3. In dashboard, try to approve the new pending CR.

Expected behavior:

- Dashboard shows error toast: approvals are suspended during incident mode.
- Backend returns `409` (hard server block).
- Plugin stays in `WAITING_APPROVAL` until reviewer acts after incident mode is disabled.

4. Disable Incident Mode and then approve or reject to finish the flow.

## Optional Visual Safety Moment

From plugin action bar, click `Dead Man's Switch` after apply to show rollback control.
