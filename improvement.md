# Improvement Plan For Final Version

This brief is based on `README.md`, `final_crit.md`, `project_documentation.md`, and the current implementation as of March 7, 2026.

## Current Position

The project is already strong in the areas the PM explicitly praised:

- end-to-end workflow
- human-in-the-loop control inside the IDE
- risk mitigation and rollback
- deployability and real product feel

The repo is also in a healthy state:

- `guardian-web`: `npm run lint` passed
- `guardian-web`: `npm run build` passed
- `ide-plugin`: `npm run build` passed
- `ide-plugin`: `npm test` passed with 15 tests

This means the final round should focus less on rebuilding the core idea and more on making the strongest parts easier to understand, more defensible, and more enterprise-ready.

## Highest-Priority Focus Areas

### 1. Make low-risk auto-approval defensible and visible

Why this matters:

- This is the clearest gap called out in `final_crit.md`.
- Judges want to see responsible AI use, not just fast approvals.
- Right now the product has the concept, but not the full explanation trail.

Current repo gap:

- `guardian-web/src/types/policy.ts` defines `auto_approve_below`.
- `guardian-web/src/components/policy/ThresholdSlider.tsx` exposes it in the UI.
- But the threshold is not actually enforced end-to-end in `guardian-web/src/lib/server/planningEngine.ts` or `ide-plugin/src/core/riskGate.ts`.
- Low-risk flows also do not create a clear audit explanation for why no human approval was needed.

What to implement:

1. Add a structured review-decision object to the plan response.
   Suggested shape:
   - `review.mode`: `auto_approved | warning | approval_required | blocked`
   - `review.rationale`: array of short human-readable reasons
   - `review.matchedPolicyRules`: matched path rules
   - `review.guardrailsPassed`: booleans for destructive commands, protected paths, secrets, blast radius

2. Define strict low-risk conditions.
   Suggested policy:
   - score `< auto_approve_below`
   - no destructive commands
   - no protected path hit
   - no secret detection
   - small blast radius
   - small diff size

3. Show the exact reason in the plugin UI and dashboard.
   Example:
   - "Auto-approved because risk score is 18, only 1 file is changed, no protected paths were touched, and no destructive commands were proposed."

4. Write audit events for low-risk decisions.
   Suggested events:
   - `plan_generated`
   - `auto_approved_low_risk`
   - `approval_required_high_risk`

Files to touch:

- `guardian-web/src/lib/server/contracts.ts`
- `guardian-web/src/lib/server/planningEngine.ts`
- `guardian-web/src/lib/server/backendPlan.ts`
- `guardian-web/src/lib/server/planExecution.ts`
- `guardian-web/src/lib/server/dataStoreDemo.ts`
- `guardian-web/src/lib/server/dataStorePrisma.ts`
- `ide-plugin/src/core/riskGate.ts`
- `ide-plugin/src/webview/app.tsx`
- `ide-plugin/src/webview/uiState.ts`
- `testbench/test-cases.md`

Success criteria:

- A low-risk request shows exactly why it bypassed manual approval.
- The same reasoning appears in audit data.
- The team can explain the rule in one sentence during the demo.

### 2. Enforce dual approval and RBAC for real, not just in the UI

Why this matters:

- PM feedback specifically pointed toward enterprise readiness and RBAC.
- This is the most credible way to level up from "good demo" to "serious governance product."

Current repo gap:

- `role_permissions` exists in `guardian-web/src/types/policy.ts`.
- The policy page displays roles in `guardian-web/src/components/policy/PolicyEditor.tsx`.
- `require_dual_approval_above` exists in policy and threshold UI.
- But approval count is effectively hard-coded to `1` in:
  - `guardian-web/src/lib/server/dataStoreDemo.ts`
  - `guardian-web/src/lib/server/dataStorePrisma.ts`
- API routes accept free-form reviewer names and do not authenticate or authorize the caller.
- `guardian-web/src/middleware.ts` only injects a request ID.

What to implement:

1. Add a simple but real auth layer for the final demo.
   Fastest acceptable version:
   - bearer token or header-based identity
   - map identity to a role such as `admin`, `lead`, `developer`, `viewer`

2. Enforce route permissions.
   Protect:
   - approve/reject/request changes
   - policy updates
   - incident mode toggle

3. Apply `require_dual_approval_above` in CR creation.
   Logic:
   - derive `required_approvals` from policy threshold
   - require 2 distinct reviewers above that threshold
   - prevent the same reviewer from approving twice

4. Record authenticated actor identity in audit logs.
   Do not rely on free-form reviewer names from the request body.

Files to touch:

- `guardian-web/src/middleware.ts`
- `guardian-web/src/lib/server/auth.ts` (new)
- `guardian-web/src/app/api/cr/[id]/approve/route.ts`
- `guardian-web/src/app/api/cr/[id]/reject/route.ts`
- `guardian-web/src/app/api/cr/[id]/request-changes/route.ts`
- `guardian-web/src/app/api/policy/path-rules/route.ts`
- `guardian-web/src/app/api/incident/route.ts`
- `guardian-web/src/lib/server/dataStoreDemo.ts`
- `guardian-web/src/lib/server/dataStorePrisma.ts`
- `guardian-web/src/components/policy/PolicyEditor.tsx`
- `guardian-web/src/components/cr-detail/ApprovalPanel.tsx`

Success criteria:

- A high-risk CR above the configured threshold needs 2 different reviewers.
- A viewer cannot approve.
- A developer cannot edit policy.
- Audit logs show the real actor and role.

### 3. Improve explainability in the plugin and CR detail pages

Why this matters:

- PM feedback directly called out explainability.
- Judges will score technical depth partly on how well you explain the system’s decisions.
- Right now the product has risk scoring, but the explanation surface is still shallow.

Current repo gap:

- The plugin UI in `ide-plugin/src/webview/app.tsx` mostly shows score, summary, file list, and event log.
- It does not clearly show:
  - local risk vs backend risk
  - matched policy rules
  - which files triggered the approval requirement
  - why the final decision was allow, warn, or require approval
- The dashboard CR plan mainly renders markdown in `guardian-web/src/components/cr-detail/PlanViewer.tsx`.

What to implement:

1. Upgrade the risk reason structure.
   Suggested fields:
   - `source`: `backend | plugin | policy`
   - `category`: `path | command | secret | blast_radius | diff_size`
   - `message`
   - `affectedPath`
   - `weight`

2. Add a "Why this decision happened" section in both plugin and dashboard.

3. Show local and backend scores separately before showing the final score.

4. Highlight protected paths and risky commands visually.

5. Add a simple semantic explanation for generated plans.
   Example:
   - "This request modifies authentication code, so it is treated as identity/security-sensitive."

Files to touch:

- `guardian-web/src/lib/server/contracts.ts`
- `guardian-web/src/lib/server/planningEngine.ts`
- `ide-plugin/src/core/riskGate.ts`
- `ide-plugin/src/webview/app.tsx`
- `guardian-web/src/components/cr-detail/RiskScoreCard.tsx`
- `guardian-web/src/components/cr-detail/PlanViewer.tsx`
- `guardian-web/src/components/cr-detail/PatchSummaryTable.tsx`

Success criteria:

- A judge can see the reason for a risk decision without reading logs.
- The team can explain one concrete risky example in less than 20 seconds.

### 4. Replace placeholder evidence with real verification evidence

Why this matters:

- Evidence makes the system feel trustworthy.
- It turns the dashboard from a mock governance layer into a real review surface.

Current repo gap:

- In both store implementations, CR evidence is currently placeholder data:
  - "Tests were not run yet"
  - "Lint checks were not executed"
- This is created in:
  - `guardian-web/src/lib/server/dataStoreDemo.ts`
  - `guardian-web/src/lib/server/dataStorePrisma.ts`

What to implement:

1. Add a safe verification stage after plan generation or before apply.
   Suggested first version:
   - run allowlisted commands only
   - examples: `npm test`, `npm run lint`
   - store pass/fail/skipped with summary output

2. Attach these results to the CR evidence panel.

3. Show whether evidence is predictive or executed.
   Example:
   - "Recommended check"
   - "Executed check"

4. If time is tight, implement this for only your own repo demo path and be explicit that it is extensible by policy.

Files to touch:

- `ide-plugin/src/extension.ts`
- `ide-plugin/src/schemas/contracts.ts`
- `guardian-web/src/lib/server/contracts.ts`
- `guardian-web/src/lib/server/dataStoreDemo.ts`
- `guardian-web/src/lib/server/dataStorePrisma.ts`
- `guardian-web/src/components/cr-detail/EvidencePanel.tsx`

Success criteria:

- At least one CR in the demo shows real lint/test evidence instead of placeholders.

### 5. Improve evaluation quality before showing benchmarks

Why this matters:

- The project already has an eval gate, which is a strong technical-depth signal.
- But the current benchmark output does not yet prove improvement.

Current repo gap:

- `docs/backend-eval-benchmarks.md` currently shows:
  - `100%` schema validity
  - `75%` high-risk recall
  - `75%` approval recall
  - `67%` reason coverage
- The "After" result is not better than "Before" except being slower.

What to implement:

1. Expand the eval set from a small handful of cases to a more convincing set.
   Add:
   - false-positive cases
   - false-negative traps
   - medium-risk warning cases
   - secrets cases
   - infra deny cases

2. Improve reason coverage until the "After" row is clearly stronger.

3. Add one or two extra metrics:
   - false positive rate
   - policy hit precision
   - explanation completeness

4. Only present benchmark numbers that support the story.

Files to touch:

- `guardian-web/src/evals/agentEvalCases.ts`
- `guardian-web/src/evals/runAgentEvals.ts`
- `guardian-web/src/lib/server/openaiReliability.ts`
- `docs/backend-eval-benchmarks.md`
- `guardian-web/eval-results/latest-agent-evals.json`

Success criteria:

- The final benchmark table shows a visible quality gain, not just a latency tradeoff.

### 6. Make the scalability story visible in the final demo

Why this matters:

- The codebase already has a stronger production story than many hackathon teams.
- Judges may miss it unless it is clearly shown.

Current repo strength that is under-presented:

- `docker-compose.yml` already includes Postgres, Redis, web, and worker.
- `guardian-web/src/lib/server/planQueue.ts` and `guardian-web/src/workers/planWorker.ts` already support async job processing and dead-letter handling.
- `guardian-web/src/lib/server/dataStorePrisma.ts` already supports a production store.

What to implement:

1. Add a small dashboard card showing runtime mode.
   Example:
   - `demo / prod`
   - queue enabled
   - datastore in use

2. Prepare one slide or backup screen showing:
   - async worker
   - queue/retry support
   - prod-mode architecture

3. If possible, record a short backup demo in prod mode.

4. Avoid leaning too hard on SQLite during the pitch.
   Position it as local-demo compatibility, not the enterprise deployment target.

Files to touch:

- `guardian-web/src/app/(dashboard)/dashboard/page.tsx`
- `guardian-web/src/lib/server/backendMode.ts`
- `guardian-web/src/lib/server/planQueue.ts`
- `README.md`
- slide deck

Success criteria:

- Judges leave understanding that the product can scale beyond a local demo.

## Presentation And Demo Plan

The judging criteria reward communication almost as much as implementation. The final version should therefore improve both the product and the story.

### Recommended 3-minute structure

1. Problem and stakes, 20 to 30 seconds.
   Say:
   - AI coding tools are fast, but risky in auth, infra, migrations, and dependency changes.
   - Teams need speed without losing human control.

2. Solution summary, 30 to 40 seconds.
   Say:
   - "HaLoop is a human-governed AI coding agent: the IDE generates plans, policy scores risk, reviewers approve high-risk changes, and rollback is built in."

3. Live demo, about 90 seconds.
   Recommended flow:
   - start in plugin
   - submit a high-risk prompt touching auth
   - show risk reasons and approval block
   - switch to dashboard
   - show CR details, evidence, and approval workflow
   - approve
   - switch back to plugin and apply
   - mention rollback as the safety net

4. Enterprise/future-readiness close, 20 to 30 seconds.
   Say:
   - RBAC, audit trail, incident mode, prod-mode datastore, queue worker, and explainable risk decisions

### Demo rule

Do not try to show every feature live.

Best live features:

- high-risk approval block
- reviewer decision
- apply after approval
- rollback mention or quick trigger

Best features to mention briefly or show in backup screenshots:

- low-risk auto-approval logic
- incident mode
- queue worker
- policy editor

## Suggested Team Split

### Track A: Governance correctness

- low-risk auto-approval logic
- dual approval
- RBAC
- audit trail improvements

### Track B: Explainability and UX

- plugin UI improvements
- dashboard risk explanation
- evidence panel improvements

### Track C: Benchmarks and demo preparation

- better eval cases
- final benchmark table
- demo script
- slides
- Q&A prep

## What Not To Spend Time On

- Do not rewrite the whole UI.
- Do not add many new features that judges will never see.
- Do not present benchmark numbers that do not show improvement.
- Do not leave low-risk auto-approval as an implied behavior without an explicit justification story.

## Final Recommendation

If the team only has time for three major improvements, do these in order:

1. implement and explain low-risk auto-approval properly
2. enforce RBAC plus dual approval from policy
3. improve explainability in the plugin and dashboard

Those three changes best match the judges’ written feedback and will most improve both technical credibility and presentation score.
