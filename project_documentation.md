# Project Documentation

## 1. Project Title

Safe, Human-Governed AI Coding Agent (Track 1)

## 2. Executive Summary

This project implements a human-in-the-loop AI coding workflow that integrates:

- a VS Code extension (`ide-plugin`) for AI task execution in developer workflows
- a governance dashboard + API backend (`guardian-web`) for policy, approvals, audit, and incident controls
- a SQLite mirror (`sqlite/` + `guardian-web` runtime) to persist approval/audit records and preserve backend compatibility flows

The core design goal is safety: high-risk AI-generated plans are blocked until reviewer approval, and applied changes can be rolled back using a Dead Man's Switch.

## 3. Problem Statement

AI coding assistants can increase delivery speed, but they can also introduce high-impact failures:

- direct edits to sensitive paths (`auth`, migrations, dependency manifests)
- destructive command suggestions
- weak accountability when no reviewer validation exists

The problem addressed by this project is how to make AI-assisted coding practical while enforcing governance controls, explainable risk signals, and recoverability.

## 4. Methodology

### 4.1 Engineering Method

We used an incremental, integration-first method:

1. Implement end-to-end API and extension contracts for plan generation and approvals.
2. Add risk scoring and policy checks on both backend and plugin sides.
3. Add reviewer workflow and real-time decision propagation.
4. Add safety fallback and rollback controls.
5. Replace legacy Supabase mirror intent with local SQLite persistence while preserving feature behavior.

### 4.2 Governance Method

The governance model combines:

- policy-based path rules (`allow`, `require_approval`, `deny`)
- risk thresholds (`low`, `medium`, `high`)
- incident mode to block approval actions during active incidents
- immutable-style audit event trails (append-oriented logs in store + SQLite mirror)

### 4.3 Validation Method

Validation was split into:

- static quality checks (`lint`, TypeScript build)
- unit tests for risk, rollback, and state transitions
- integration script covering approve/deny/realtime/incident-policy workflows
- manual plugin + dashboard scenario walkthroughs

## 5. Technical Approach

### 5.1 System Components

1. `ide-plugin`

- collects local context
- requests AI plan generation
- computes local risk and merges with backend risk
- blocks high-risk plans pending approval
- polls/subscribes for decisions
- applies approved changes and stores rollback manifest

2. `guardian-web`

- Next.js dashboard for CR list/detail, approval actions, policy, incident mode, audit
- API routes for plugin and compatibility clients
- local integration data store for CR and policy state

3. SQLite Mirror

- persists approval requests, reviewer decisions, and compact audit rows
- maintains compatibility for backend-style flows (`/api/ai/plan`, `/api/approvals`, compact audit)

### 5.2 End-to-End Workflow

1. Developer runs `AI Gov: Run Task` in VS Code.
2. Plugin sends prompt + context to `POST /generate-plan`.
3. Backend returns structured plan + backend risk score/reasons.
4. Plugin risk gate computes final risk as `max(localRisk, backendRisk)`.
5. If final risk is high (`>= 70`), plugin creates approval request via `POST /approvals`.
6. Reviewer approves/rejects from dashboard (`/api/cr/:id/*` actions).
7. Plugin receives decision (SSE + polling) and either:

- allows apply
- blocks apply

8. On apply, plugin records file manifest for rollback.
9. Dead Man's Switch can restore/delete touched files based on manifest metadata.

### 5.3 Risk and Policy Controls

Risk signals include:

- destructive command patterns
- protected path changes (`auth`, `migrations`, `schema.sql`, `package.json`)
- large blast radius
- large diff size
- potential secret leakage patterns

Policy supports:

- path-level enforcement rules
- configurable risk thresholds
- incident-mode lock to block review actions

### 5.4 Supabase to SQLite Replacement

Original planning targeted Supabase for persistent backend records. Current implementation replaces that with SQLite while preserving required capabilities:

- approval request persistence and idempotent upsert by `approvalId`
- reviewer decision status updates
- compact audit trail generation
- actor/profile normalization
- risk metadata continuity

Default SQLite file:

- `guardian-web/.data/backend-mirror.sqlite`

Schema source:

- `sqlite/migrations/0001_init.sql`

## 6. Implementation Snapshot

### 6.1 Key Plugin-Facing API Routes

- `POST /generate-plan`
- `POST /approvals`
- `GET /approvals/:approvalId/decision`
- `GET /approvals/:approvalId/events`

### 6.2 Compatibility API Routes

- `POST /api/ai/plan`
- `POST /api/approvals`
- `GET /api/audit?view=compact`

### 6.3 Dashboard API Surface

- `GET /api/cr`
- `GET /api/cr/:id`
- `POST /api/cr/:id/approve`
- `POST /api/cr/:id/reject`
- `POST /api/cr/:id/request-changes`
- `GET/PUT /api/incident`
- `GET /api/policy/active`
- `PUT /api/policy/path-rules`

## 7. Results

### 7.1 Automated Check Results

The following checks were executed successfully:

1. `guardian-web`

- `npm run lint`: passed (no ESLint warnings/errors)
- `npm run build`: passed (Next.js production build completed)

2. `ide-plugin`

- `npm run build`: passed
- `npm test`: passed (12 tests across 3 files)

### 7.2 Integration Script Status

Integration script:

- `guardian-web/scripts/test-integration-flow.sh`

Covers:

- policy update persistence
- approval pending behavior
- approve path
- reject path
- realtime SSE decision stream
- incident-mode approval blocking

In this restricted execution environment, binding local ports was blocked (`listen EPERM`), so full live-script execution could not be completed here. The script is included in the testbench and is expected to run on a normal local machine where localhost ports are available.

### 7.3 Functional Outcome Summary

Implemented and available:

- AI plan generation with structured response
- risk-gated approval workflow
- reviewer approve/reject/changes requested actions
- SSE + polling decision retrieval for plugin
- incident mode approval lock
- rollback mechanism for AI-applied files
- SQLite-backed persistence mirror and compact audit compatibility

## 8. Testing Procedures

### 8.1 Static and Unit Checks

- run `guardian-web` lint/build
- run `ide-plugin` build/tests

### 8.2 Integration Flow

- start backend (`guardian-web`)
- run `BASE_URL=http://localhost:3000 npm run test:integration`
- verify final success line in output

### 8.3 Manual User Journey

- low-risk prompt path (no approval)
- high-risk prompt path (approval required)
- reviewer approve and reject behaviors
- incident-mode on/off and blocked approval action
- Dead Man's Switch rollback validation

Full instructions are in:

- `testbench/setup-and-run.md`
- `testbench/test-cases.md`

## 9. Observations

1. Dual risk evaluation (backend + plugin local) improves safety against single-point misclassification.
2. Approval decision delivery using both SSE and polling increases reliability under transient network issues.
3. SQLite mirror provides a practical, dependency-light replacement for Supabase in local/demo environments.
4. Node `node:sqlite` currently emits experimental warnings during build/runtime on Node 22; this is expected behavior.

## 10. Key Findings

1. Human approvals can be integrated into developer IDE flow with low friction when risk scoring and policy paths are explicit.
2. Governance features (incident lock, audit, policy controls) materially improve safety posture for AI-generated code operations.
3. A rollback-first design is critical for trust in autonomous or semi-autonomous code application workflows.
4. Replacing external backend dependencies with local SQLite can preserve core governance semantics while improving portability.

## 11. Limitations And Future Work

Current limitations:

- no external identity provider integration (reviewer identity is local/demo mode)
- local/demo datastore and mirror are file-based; no distributed deployment guarantees
- compact audit compatibility is implemented, but enterprise export/search features are minimal

Future work:

1. production-grade authn/authz and role mapping
2. stronger policy-as-code model with signed policy bundles
3. richer diff previews and semantic risk explainability
4. CI/CD enforcement hooks beyond local IDE workflows
5. automated chaos tests for approval channel reliability

## 12. References

[1] Vercel, "Next.js Documentation," https://nextjs.org/docs  
[2] Microsoft, "VS Code Extension API," https://code.visualstudio.com/api  
[3] Node.js, "SQLite (`node:sqlite`) API," https://nodejs.org/api/sqlite.html  
[4] Zod, "TypeScript-first schema validation with static type inference," https://zod.dev  
[5] React Flow, "React Flow Documentation," https://reactflow.dev