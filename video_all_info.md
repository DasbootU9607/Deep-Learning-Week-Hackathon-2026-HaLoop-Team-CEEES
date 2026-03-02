# Video Submission Guide (Track 1)

This file is a practical guide for creating a compliant hackathon submission video.

## 1. Compliance Requirements (From Submission Details)

Your video must satisfy all of these:

1. Length: `1-2 minutes`.
2. Content focus: show key innovations and core features.
3. Do not spend most time on deep methodology.
4. Upload platform: YouTube/Vimeo (or similar).
5. Link visibility: `Unlisted` or `Public`.

Round 1 submission deadline (from brief): `March 3, 2026, 13:00 SGT`.

## 2. What To Show (In Order)

Use this sequence so judges quickly see novelty and working integration.

1. Problem and value (10-15s)
- AI coding speed is useful, but unsafe code changes are risky.
- Your solution adds governance and human control.

2. System uniqueness (10-15s)
- IDE plugin + governance dashboard + backend approval APIs + SQLite persistence.
- High-risk tasks are blocked until reviewer decision.

3. Live low-risk flow (15-20s)
- Prompt from plugin.
- Show low-risk plan that can proceed without approval.

4. Live high-risk flow with human-in-the-loop (25-35s)
- Prompt touching auth/package/migrations.
- Plugin moves to waiting approval.
- Dashboard CR appears as pending.
- Reviewer approves and plugin can apply.

5. Safety controls (15-25s)
- Show reject path OR incident mode block (`409` approval block).
- Show Dead Man's Switch rollback as safety fallback.

6. Close with impact (10s)
- Why this matters: safer AI-assisted development for real teams.

## 3. Recommended Shot Plan (1-2 min)

### 0:00-0:07 Hook
- Screen: title slide + project name.
- Voice: one-line problem statement.

### 0:07-0:20 Product layout
- Screen: split view of VS Code plugin and dashboard `/cr`.
- Voice: "human-governed AI coding agent."

### 0:20-0:38 Low-risk demo
- Screen: run `AI Gov: Run Task` with low-risk prompt.
- Show `PREVIEW_READY` and no approval ticket created.

### 0:38-1:05 High-risk demo
- Screen: prompt involving auth changes.
- Show `WAITING_APPROVAL` in plugin.
- Switch to dashboard CR pending card.
- Click Approve; return to plugin showing approved + apply.

### 1:05-1:25 Safety moments
- Option A: submit second risky prompt and reject.
- Option B: enable Incident Mode, try approve, show blocked behavior.
- Optional: click `Dead Man's Switch`.

### 1:25-1:35 Close
- Screen: project summary text.
- Voice: innovation + impact statement.

## 4. Sample Script (90 Seconds, Recommended)

`[0:00-0:08]`
"AI coding assistants are fast, but one unsafe change can break production. We built a safe, human-governed AI coding workflow."

`[0:08-0:20]`
"Our system connects a VS Code plugin with a governance dashboard and backend approval service, with audit and SQLite persistence."

`[0:20-0:34]`
"First, a low-risk prompt. The plugin generates a plan, risk stays low, and the developer can proceed immediately."

`[0:34-0:56]`
"Now a high-risk auth change. The plugin pauses and requests approval. On the dashboard, a pending change request appears with risk context."

`[0:56-1:08]`
"A reviewer approves it here, and the plugin instantly receives the decision. Only then can the code be applied."

`[1:08-1:21]`
"If a request is rejected, apply stays blocked. During incidents, approval actions are server-blocked, so risky changes cannot be pushed through."

`[1:21-1:30]`
"And if needed, Dead Man's Switch rolls back AI-applied local changes. This gives teams speed without sacrificing control."

## 5. Sample Script (120 Seconds, Full Version)

`[0:00-0:12]`
"We are solving a practical problem in AI-assisted coding: productivity increases, but so does operational risk."

`[0:12-0:25]`
"This project is a safe, human-in-the-loop coding agent with three parts: a VS Code plugin, a governance dashboard, and backend approval + audit APIs."

`[0:25-0:43]`
"Here is a low-risk prompt. The plugin generates a plan and reaches preview-ready state without creating a mandatory approval ticket."

`[0:43-1:05]`
"Now we run a high-risk prompt touching authentication logic. The plugin enters waiting-approval mode and posts a request to the backend."

`[1:05-1:22]`
"In the dashboard, reviewers see the pending request with risk details. Approving this request unblocks apply in the plugin, proving real-time governance."

`[1:22-1:35]`
"For control paths, rejection keeps apply disabled. Incident mode can also enforce hard approval blocking from the server side."

`[1:35-1:50]`
"For recoverability, Dead Man's Switch can roll back AI-applied local file changes from the recorded session manifest."

`[1:50-2:00]`
"The result is a practical AI coding workflow that is fast, auditable, and safe enough for high-impact engineering environments."

## 6. Fast Recording Checklist

Before recording:

1. Start backend (`guardian-web`) on `http://localhost:3000`.
2. Build plugin and launch extension host.
3. Ensure `aiGov.backendUrl` is set correctly.
4. Keep browser tabs ready: `/cr` and `/incident`.
5. Reset state (`demo/scripts/reset-demo-state.sh`) if needed.

During recording:

1. Use zoomed font/UI for readability.
2. Keep cuts tight; do not wait on idle loading screens.
3. Show visible state changes (`WAITING_APPROVAL`, `APPROVED`, `DENIED`).
4. Keep narration product-focused, not implementation-deep.

After recording:

1. Trim to 90-120 seconds.
2. Export and upload as Unlisted/Public.
3. Verify audio and text are readable on laptop screens.

## 7. What To Avoid

1. Spending most of the video on architecture diagrams and internals.
2. Skipping the core novelty (human approval gate + safety controls).
3. Showing only happy path without governance behavior.
4. Exceeding 2 minutes.
