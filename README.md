# CEEES Deep Learning Week Hackathon 2026 Project

![HaLoop Logo](./HaLoop_Logo.png)

Track 1 implementation: a safe, human-governed AI coding agent with:

- `ide-plugin/`: VS Code extension for AI tasks + local guardrails
- `guardian-web/`: dashboard and backend APIs for approvals, incident mode, policy, audit
- `sqlite/`: SQLite schema for demo/compatibility mirror persistence

Backend now supports:

- `BACKEND_MODE=demo`: JSON + SQLite mirror
- `BACKEND_MODE=prod`: Postgres (Prisma) + Redis/BullMQ + async plan worker
- OpenAI structured planning reliability layer + eval gate + OTel hook

## Start Here

Use this file as the canonical setup/run guide.
Module-specific details live in:

- `guardian-web/README.md`
- `ide-plugin/README.md`

## Documentation Map

- `README.md`: canonical cross-platform setup + run
- `project_documentation.md`: submission-focused methodology/results/testing document (Markdown draft for final PDF conversion)
- `testbench/README.md`: grader entry point for setup/run validation
- `testbench/setup-and-run.md`: step-by-step setup and execution guide for graders
- `testbench/test-cases.md`: structured manual validation scenarios and expected behavior
- `guardian-web/README.md`: dashboard/backend module guide
- `ide-plugin/README.md`: extension module guide
- `docs/backend-storage-features.md`: storage feature mapping (legacy Supabase intent -> SQLite implementation)
- `docs/backend-eval-benchmarks.md`: eval-gate benchmark table (before/after)
- `docs/mermaid.md`: architecture diagram (Mermaid source for documentation and GitHub rendering)
- `docs/README.md`: docs index/maintenance notes

## Architecture Diagram

```mermaid
flowchart LR
    DEV["Developer<br/>VS Code extension host"]
    REVIEWER["Reviewer / Admin<br/>Guardian Web"]

    subgraph IDE["IDE Plugin Runtime"]
        UI["Commands + Webview UI"]
        CTX["ContextCollector<br/>workspace, branch, active file, snippets"]
        CLIENT["AIClient"]
        GATE["RiskGate<br/>finalRisk = max(local, backend)"]
        APPROVAL_CLIENT["ApprovalClient<br/>POST /approvals + SSE/polling"]
        APPLY["ChangeApplier"]
        ROLLBACK["SessionStore + Dead Man's Switch"]
        LOCAL_FALLBACK["Local simulated approval fallback"]
    end

    subgraph WORKSPACE["Developer Workspace"]
        REPO["Repo files + Git state"]
    end

    subgraph SERVICE["Guardian Web Service"]
        DASH["Dashboard UI + React Query<br/>CR, policy, incident, audit views"]

        subgraph ROUTES["Next.js Routes"]
            PLUGIN_ROUTES["Plugin routes<br/>/generate-plan<br/>/approvals<br/>/approvals/:id/decision<br/>/approvals/:id/events"]
            REVIEW_ROUTES["Dashboard APIs<br/>/api/cr, /api/policy<br/>/api/incident, /api/audit"]
            AI_ROUTES["AI APIs<br/>/api/ai/plan<br/>/api/jobs/:id<br/>/api/openai/webhook"]
        end

        subgraph CORE["Planning + Governance Core"]
            POLICY["Policy engine<br/>path rules + thresholds"]
            EXEC["Plan execution / backendPlan"]
            OPENAI_REL["OpenAI reliability layer<br/>structured JSON, retries, background polling"]
            HEURISTIC["Heuristic planner fallback"]
            APPROVAL_CORE["Approval + CR workflow"]
            INCIDENT["Incident mode gate"]
            AUDIT["Audit + compact backend view"]
            STORE["dataStore adapter<br/>demo vs prod"]
        end
    end

    subgraph INFRA["Infra + External Services"]
        OPENAI["OpenAI Responses API"]
        REDIS["Redis + BullMQ<br/>queue, retries, dead-letter queue"]
        WORKER["planWorker"]
        TELEMETRY["Request IDs + OTel spans"]
    end

    subgraph DATA["Persistence"]
        DEMO["Demo mode<br/>JSON integration store"]
        SQLITE["SQLite mirror<br/>compatibility + compact audit"]
        POSTGRES["Prod mode<br/>Postgres via Prisma"]
    end

    DEV --> UI
    REPO --> CTX
    UI --> CTX --> CLIENT
    CLIENT -->|prompt + context| PLUGIN_ROUTES
    PLUGIN_ROUTES --> EXEC
    PLUGIN_ROUTES --> APPROVAL_CORE
    EXEC --> POLICY
    EXEC --> OPENAI_REL
    EXEC --> HEURISTIC
    OPENAI_REL --> OPENAI
    OPENAI_REL -.fallback.-> HEURISTIC
    EXEC --> STORE
    EXEC --> TELEMETRY
    PLUGIN_ROUTES -->|plan + backend risk| CLIENT
    CLIENT --> GATE
    GATE -->|low / medium| UI
    GATE -->|high risk| APPROVAL_CLIENT
    APPROVAL_CLIENT -->|create request / wait for decision| PLUGIN_ROUTES
    APPROVAL_CLIENT -.backend unavailable.-> LOCAL_FALLBACK
    LOCAL_FALLBACK --> UI

    UI -->|apply approved plan| APPLY
    APPLY --> REPO
    APPLY --> ROLLBACK
    ROLLBACK --> REPO

    REVIEWER --> DASH
    DASH <--> REVIEW_ROUTES
    REVIEW_ROUTES --> APPROVAL_CORE
    REVIEW_ROUTES --> POLICY
    REVIEW_ROUTES --> INCIDENT
    REVIEW_ROUTES --> AUDIT
    INCIDENT -.blocks reviewer approvals.-> APPROVAL_CORE
    APPROVAL_CORE -->|decision event| PLUGIN_ROUTES
    APPROVAL_CORE --> STORE
    APPROVAL_CORE -.demo mirror.-> SQLITE

    AI_ROUTES -->|small request| EXEC
    AI_ROUTES -->|async or long-running request| REDIS
    REDIS --> WORKER --> EXEC
    AI_ROUTES -->|job status lookup| REDIS
    OPENAI -.signed webhook.-> AI_ROUTES

    POLICY --> STORE
    INCIDENT --> STORE
    AUDIT --> STORE
    STORE --> DEMO
    STORE --> POSTGRES
    STORE -.demo mirror.-> SQLITE

    classDef actor fill:#e6f2ff,stroke:#1d5fa7,color:#111;
    classDef plugin fill:#f6ecff,stroke:#7a3db8,color:#111;
    classDef service fill:#ebf7ee,stroke:#2f7a43,color:#111;
    classDef infra fill:#fff1df,stroke:#b86a1f,color:#111;
    classDef data fill:#fff7d6,stroke:#9c7a00,color:#111;

    class DEV,REVIEWER actor
    class UI,CTX,CLIENT,GATE,APPROVAL_CLIENT,APPLY,ROLLBACK,LOCAL_FALLBACK plugin
    class DASH,PLUGIN_ROUTES,REVIEW_ROUTES,AI_ROUTES,POLICY,EXEC,OPENAI_REL,HEURISTIC,APPROVAL_CORE,INCIDENT,AUDIT,STORE service
    class OPENAI,REDIS,WORKER,TELEMETRY infra
    class DEMO,SQLITE,POSTGRES,REPO data

```

Primary editable architecture source: `docs/mermaid.md`

## Preview

### Demo Video
[![HaLoop Demo](https://img.youtube.com/vi/cy96VRtIqiA/0.jpg)](https://www.youtube.com/watch?v=cy96VRtIqiA&t=32s)

### Screenshots

**Main Dashboard**  
<img src="./.github/assets/Frontpage.png" width="450">  
*Central hub for tracking AI-generated change requests and approval statuses.*

**Policy Management**  
<img src="./.github/assets/Policies.png" width="450">  
*Define security boundaries and automated human review triggers.*

**Audit Trail**  
<img src="./.github/assets/Audit.png" width="450">  
*Comprehensive logs of all AI interactions and governance decisions.*

**VS Code Plugin Integration**  
<img src="./.github/assets/Plugin.png" width="450">  
*In-IDE guidance showing real-time risk levels and pending approvals.*

**Backend Processing Logs**  
<img src="./.github/assets/console.png" width="450">  
*Technical view of the risk evaluation engine and state transitions.*

**System Governance Control**  
<img src="./.github/assets/Control.png" width="450">  
*Admin overrides for global security locks and emergency incident response.*

## Dependency Checklist (Computer-Agnostic)

### Required

- `git`
- Node.js `22.x` and npm
- VS Code

Reason for Node 22: backend mirror uses Node built-in `node:sqlite`.

### Required For Shell Scripts

- `bash`
- `curl`
- `jq`
- `uuidgen`

Needed by:

- `guardian-web/scripts/test-integration-flow.sh`

## Verify Toolchain

```bash
node -v
npm -v
git --version
code --version
curl --version
jq --version
uuidgen
```

If `code` is unavailable, run extension host via VS Code `F5`.

## Install Dependencies

### macOS/Linux/Git Bash

```bash
cd guardian-web && npm ci
cd ../ide-plugin && npm ci
cd ..
npm install @prisma/client
```

### Windows PowerShell

```powershell
Set-Location guardian-web; npm ci
Set-Location ../ide-plugin; npm ci
Set-Location ..
npm install @prisma/client
```

This final command installs the local Prisma client dependency needed for the full setup flow.

## Run Locally

### Fast Judge Path (Docker Compose)

From repo root:

```bash
docker compose up --build
```

This launches `guardian-web`, `guardian-worker`, `postgres`, and `redis`.

### 1) Start dashboard/backend

```bash
cd guardian-web
npm run dev
```

Runs on `http://localhost:3000` by default.

### 2) Build plugin

```bash
cd ../ide-plugin
npm run build
```

### 3) Start extension development host

1. Open `ide-plugin/` in VS Code.
2. Press `F5`.
3. Run `Extension` launch target.

### 4) Configure workspace settings in extension host

```json
{
  "aiGov.backendUrl": "http://localhost:3000",
  "aiGov.apiKey": "",
  "aiGov.requestedBy": "demo-presenter",
  "aiGov.pollIntervalMs": 3000
}
```

`aiGov.backendUrl` accepts either:

- `http://localhost:3000`
- `http://localhost:3000/api`

The plugin normalizes both.

## SQLite Backend Mirror

Initialized automatically by `guardian-web`.

- default path: `guardian-web/.data/backend-mirror.sqlite`
- override path: `SQLITE_DB_PATH`

Example:

```bash
SQLITE_DB_PATH=.data/custom-backend.sqlite npm run dev
```

Reference schema: `sqlite/migrations/0001_init.sql`

## API Surface

### Plugin-facing routes

- `POST /generate-plan`
- `POST /approvals`
- `GET /approvals/:approvalId/decision`
- `GET /approvals/:approvalId/events`

### Compatibility routes

- `POST /api/ai/plan`
- `POST /api/approvals`
- `GET /api/audit`
- `GET /api/audit?view=compact`

## Validation Commands

### guardian-web

```bash
cd guardian-web
npm run lint
npm run build
```

### ide-plugin

```bash
cd ide-plugin
npm run build
npm test
```

### end-to-end integration checks

Requires `bash`, `curl`, `jq`, `uuidgen` and running dashboard.

```bash
cd guardian-web
BASE_URL=http://localhost:3000 npm run test:integration
```

## Reset State

Reset SQLite mirror:

- delete `guardian-web/.data/backend-mirror.sqlite`

## Troubleshooting

### Plugin says backend approval service is not configured

1. Confirm `guardian-web` is running on `http://localhost:3000`.
2. Check workspace setting `aiGov.backendUrl`.
3. Reload extension host window after settings change.
4. Rebuild plugin:

```bash
cd ide-plugin
npm run build
```

### Missing `bash` / `jq` / `uuidgen` on Windows

Use Git Bash or WSL for script-based flows.
