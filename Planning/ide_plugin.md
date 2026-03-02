# IDE Plugin Implementation Spec (Member 2)

## 1. Objective

Build a VS Code extension that:

1. Accepts developer prompts in a chat UI.
2. Collects local context and requests AI-generated code changes.
3. Previews changes before apply.
4. Intercepts high-risk actions and requires web approval.
5. Applies only approved changes.
6. Supports one-click rollback of AI-applied uncommitted changes (Dead Man's Switch).

This document is intentionally explicit so any modern LLM can generate the same architecture and behavior.

---

## 2. Scope and Non-Goals

### In scope

1. VS Code extension host + React webview chat UI.
2. Local context collection.
3. Diff preview and gated apply flow.
4. Approval wait-state and realtime decision handling.
5. Session-based rollback for AI changes.

### Out of scope (for 1-day hackathon)

1. Multi-IDE support beyond VS Code.
2. Autonomous background agent loops.
3. Long-term telemetry pipeline.
4. Complex conflict resolution for patch failures.

---

## 3. Technical Choices

1. Language: TypeScript (`strict: true`).
2. Plugin runtime: VS Code Extension API.
3. Webview UI: React + TypeScript (single-page chat interface).
4. Backend transport: HTTPS REST for request/response.
5. Realtime approvals: Supabase Realtime channel subscription.
6. Validation: `zod` for runtime schema checks.
7. Git integration: shell `git` commands via `child_process` for branch/status and rollback.
8. Diff rendering in webview: unified diff text + syntax-highlighted panels.

Reasoning: This is the fastest reliable stack aligned with existing project plan and team split.

---

## 4. Plugin Architecture

## 4.1 Components

1. `ExtensionHost`:
   - Registers commands.
   - Creates/owns webview panel.
   - Orchestrates state machine.

2. `WebviewApp`:
   - Chat UI, status badges, diff preview, action buttons.
   - Sends UI events to extension host with `postMessage`.

3. `ContextCollector`:
   - Reads active editor, selected text, visible tabs, branch, workspace root.

4. `AIClient`:
   - Calls backend to generate plan/diff + risk metadata.

5. `RiskGate`:
   - Computes local deterministic risk score.
   - Combines local score with backend risk result.
   - Decides `ALLOW`, `REQUIRE_APPROVAL`, `BLOCK`.

6. `ChangeApplier`:
   - Applies edits via `WorkspaceEdit`.
   - Records session touched files.

7. `ApprovalClient`:
   - Creates approval request.
   - Subscribes to approval decision events.

8. `RollbackManager`:
   - Reverts AI session files to pre-change state if still uncommitted.

## 4.2 State Machine

Use one explicit finite state machine:

1. `IDLE`
2. `COLLECTING_CONTEXT`
3. `DRAFTING_PLAN`
4. `PREVIEW_READY`
5. `WAITING_APPROVAL`
6. `APPROVED`
7. `APPLYING`
8. `APPLIED`
9. `DENIED`
10. `ROLLED_BACK`
11. `ERROR`

Rules:

1. Never apply changes unless state is `APPROVED` or risk decision is `ALLOW`.
2. Dead Man's Switch allowed from `APPLIED` and `ERROR`.
3. Any schema validation failure -> `ERROR`.

---

## 5. Recommended File Layout

```text
ide-plugin/
  package.json
  tsconfig.json
  src/
    extension.ts
    commands/
      openChat.ts
      runAiTask.ts
      deadManSwitch.ts
    core/
      stateMachine.ts
      contextCollector.ts
      riskGate.ts
      changeApplier.ts
      rollbackManager.ts
      sessionStore.ts
    infra/
      aiClient.ts
      approvalClient.ts
      supabaseRealtime.ts
      gitClient.ts
      logger.ts
    schemas/
      contracts.ts
    webview/
      index.html
      app.tsx
      uiState.ts
      messageBridge.ts
```

---

## 6. Contracts (Freeze Early)

All contracts must exist in `schemas/contracts.ts` and be validated by `zod`.

## 6.1 Generate Request

```ts
type GeneratePlanRequest = {
  sessionId: string;
  prompt: string;
  context: {
    workspaceRoot: string;
    branch: string;
    activeFile?: string;
    selectedText?: string;
    openTabs: string[];
  };
};
```

## 6.2 Generate Response

```ts
type FileChange = {
  path: string;
  action: "create" | "update" | "delete";
  newContent?: string;
  oldContentHash?: string;
};

type GeneratePlanResponse = {
  planId: string;
  summary: string;
  changes: FileChange[];
  proposedCommands: string[];
  backendRisk: {
    score: number; // 0-100
    level: "low" | "medium" | "high";
    reasons: string[];
  };
};
```

## 6.3 Approval Request

```ts
type ApprovalRequest = {
  approvalId: string;
  planId: string;
  sessionId: string;
  requestedBy: string;
  risk: {
    score: number;
    level: "high";
    reasons: string[];
  };
  blastRadius: {
    files: string[];
    commandCount: number;
  };
  createdAt: string;
};
```

## 6.4 Approval Decision Event

```ts
type ApprovalDecisionEvent = {
  approvalId: string;
  decision: "approved" | "denied";
  reviewer: string;
  reason?: string;
  decidedAt: string;
};
```

---

## 7. Algorithms

## 7.1 Context Selection Algorithm

Goal: stay useful while controlling token size.

1. Always include:
   - prompt
   - active file path
   - selected text (if exists)
   - branch
2. From open tabs, include up to 8 files.
3. Prioritize files:
   - active file: weight 100
   - visible editors: weight 60
   - recently opened: weight 30
4. Truncate each included file snippet to max 200 lines around cursor/selection.

## 7.2 Deterministic Local Risk Algorithm

Compute `localRiskScore`:

1. `+80` if command matches destructive regex:
   - `rm -rf`
   - `drop database`
   - `truncate`
   - `git reset --hard`
2. `+60` if changed path matches protected patterns:
   - `**/auth/**`
   - `**/migrations/**`
   - `**/schema.sql`
   - `**/package.json`
3. `+30` if changed files > 5
4. `+20` if total modified lines > 250
5. `+20` if secrets-like content detected:
   - private key blocks
   - API key regex patterns

Set `finalRiskScore = max(localRiskScore, backendRisk.score)`.

Decision rule:

1. `finalRiskScore >= 70` -> `REQUIRE_APPROVAL`
2. `40 <= finalRiskScore < 70` -> `ALLOW_WITH_WARNING`
3. `< 40` -> `ALLOW`

Hackathon simplification: treat `ALLOW_WITH_WARNING` same as `ALLOW`, but show warning in UI.

## 7.3 Interception + Approval Algorithm

1. Generate plan response.
2. Compute local risk, merge with backend risk.
3. If `REQUIRE_APPROVAL`:
   - create approval request in Supabase.
   - transition to `WAITING_APPROVAL`.
   - subscribe to approval event by `approvalId`.
4. On event:
   - `approved` -> state `APPROVED`, enable Apply.
   - `denied` -> state `DENIED`, block apply.

## 7.4 Safe Apply Algorithm

Before applying any file change:

1. Read current file content (if exists).
2. Store pre-change snapshot in session record:
   - path
   - preContent
   - preHash
3. Apply create/update/delete with `WorkspaceEdit`.
4. Record post-hash and mark file as `applied`.

If any apply step fails:

1. Stop remaining operations.
2. Show failure details.
3. Transition to `ERROR`.

## 7.5 Dead Man's Switch Algorithm

Data source: in-memory + persisted session file (JSON in global storage path).

On trigger:

1. For each touched file in reverse apply order:
   - Check if file has uncommitted changes (`git status --porcelain <file>`).
   - If yes and change was produced by current session:
     - restore `preContent` (or delete file if originally absent).
2. Save rollback report:
   - restored files
   - skipped files
   - conflicts
3. Transition to `ROLLED_BACK`.

Safety rule: never revert files not in current AI session manifest.

---

## 8. Command List (VS Code)

Register these commands:

1. `aiGov.openChat`
2. `aiGov.runTask`
3. `aiGov.deadManSwitch`

`runTask` flow:

1. Open chat panel if needed.
2. Collect prompt + context.
3. Call `generatePlan`.
4. Render summary + file changes.
5. Run risk gate.
6. If high-risk -> approval flow.
7. If allowed -> enable apply.

---

## 9. Webview UX Requirements

Minimal but explicit UI sections:

1. Chat input + submit.
2. Status pill (`IDLE`, `DRAFTING`, `WAITING_APPROVAL`, `APPROVED`, `DENIED`, `ERROR`).
3. Plan summary box.
4. Diff/file-change list.
5. Action row:
   - `Apply`
   - `Cancel`
   - `Dead Man's Switch`
6. Event log panel (latest 10 events).

---

## 10. Error Handling Policy

1. Schema mismatch: block flow and show exact invalid field.
2. Realtime disconnect: poll approval API every 3 seconds as fallback.
3. Apply failure: show failing file + reason; do not continue partial apply silently.
4. Rollback partial failure: surface skipped/conflicted files.

---

## 11. Security and Guardrails

1. Never execute generated shell commands automatically in v1.
2. Never bypass approval for high-risk files/commands.
3. Redact potential secrets from UI logs.
4. Require explicit user click for `Apply` and for `Dead Man's Switch`.

---

## 12. Step-by-Step Build Plan (Member 2)

## Step 1: Project bootstrap (45 min)

1. Scaffold VS Code extension (TypeScript template).
2. Add React webview scaffold.
3. Register three commands.
4. Confirm commands run in Extension Development Host.

Exit criteria: empty chat panel opens successfully.

## Step 2: Message bridge + UI skeleton (45 min)

1. Implement extension <-> webview message protocol.
2. Add status pill and action buttons.
3. Add event log list.

Exit criteria: UI events change state in extension host.

## Step 3: Context collector + AI request (60 min)

1. Implement `contextCollector`.
2. Implement `generatePlan` API client + `zod` validation.
3. Render plan summary + file list.

Exit criteria: prompt returns plan visible in webview.

## Step 4: Risk gate + interception (60 min)

1. Implement local risk scoring.
2. Merge with backend risk.
3. Trigger approval request when high risk.
4. Add waiting state in UI.

Exit criteria: protected file change always routes to approval.

## Step 5: Realtime decision handling (45 min)

1. Subscribe to approval events.
2. Transition to approved/denied.
3. Enable Apply only when approved or low-risk.

Exit criteria: manual dashboard decision changes plugin state in near realtime.

## Step 6: Safe apply + session manifest (60 min)

1. Implement apply engine using `WorkspaceEdit`.
2. Capture pre-change snapshots per file.
3. Persist session manifest.

Exit criteria: approved plan applies and touched files are tracked.

## Step 7: Dead Man's Switch (45 min)

1. Implement rollback from session manifest.
2. Revert only session-touched uncommitted files.
3. Show rollback report in UI.

Exit criteria: one click returns workspace to pre-AI state for session files.

## Step 8: Golden path test + hardening (60 min)

1. Run full scenario with M1/M3/M4.
2. Fix integration bugs.
3. Freeze features; only demo blockers after this.

Exit criteria: end-to-end demo succeeds twice consecutively.

---

## 13. Acceptance Tests (Must Pass)

1. Low-risk flow:
   - Prompt -> plan -> apply -> files changed -> audit event emitted.

2. High-risk flow:
   - Prompt touching protected path -> waiting approval -> denied blocks apply.

3. Approval success flow:
   - Same as above but approved -> apply succeeds.

4. Rollback flow:
   - After apply, dead man switch restores session files.

5. Validation flow:
   - Malformed backend response is rejected with explicit error.

---

## 14. Demo Script (Plugin Side)

1. Ask AI to change safe UI copy -> apply directly.
2. Ask AI to modify protected DB/auth file -> plugin pauses and waits.
3. Reviewer approves on dashboard -> plugin applies.
4. Trigger Dead Man's Switch -> changes revert.

Narration line: "Speed from AI, control from governance."

---

## 15. Current Implementation Status (as of March 2, 2026)

### What this plugin is about

This VS Code plugin is a governed AI coding assistant. It gives developers AI speed for code generation, but enforces safety controls before changes are applied.

Core idea:

1. Developer asks AI for a code task.
2. Plugin gathers local coding context.
3. Backend returns structured plan/diff + risk metadata.
4. Plugin previews changes.
5. High-risk actions are intercepted and require approval.
6. Only approved changes can be applied.
7. Dead Man's Switch can roll back AI session changes.

### What has been completed so far

1. VS Code extension project scaffolded in `ide-plugin/` with TypeScript strict mode.
2. Commands implemented and wired:
   - `aiGov.openChat`
   - `aiGov.runTask`
   - `aiGov.deadManSwitch`
3. React webview chat UI implemented with:
   - chat input/submit
   - status pill
   - plan summary
   - file-change list
   - action row (`Apply`, `Cancel`, `Dead Man's Switch`)
   - event log panel
4. Core M2 modules implemented:
   - explicit finite state machine
   - context collector (active file, selection, open tabs, branch, snippets)
   - deterministic local risk scoring
   - safe apply engine with pre-change snapshots
   - session manifest persistence
   - rollback manager with uncommitted-file guardrails
5. Backend integration clients implemented with runtime schema validation (`zod`):
   - generate plan endpoint client
   - approval request endpoint client
   - approval decision polling client
6. High-risk interception flow implemented:
   - local + backend risk merge
   - approval wait state
   - approved/denied transitions
   - apply disabled until allowed
7. Security guardrails implemented in plugin flow:
   - no automatic execution of generated shell commands
   - explicit user click required for apply and rollback
   - basic secret redaction in logs
8. Integration handoff doc created:
   - `Planning/ide-plugin-integration.md` (endpoint list, config keys, backend contracts)
9. Automated tests added and passing:
   - `riskGate` tests
   - `stateMachine` tests
   - `rollbackManager` tests
10. Local verification complete:
    - `npm run build` passes
    - `npm test` passes

### Remaining for full team end-to-end

1. Wire plugin to real backend services and dashboard approvals.
2. Connect true realtime approval events (Supabase channel path) in addition to polling fallback.
3. Run full golden-path integration test with M1/M3/M4.
