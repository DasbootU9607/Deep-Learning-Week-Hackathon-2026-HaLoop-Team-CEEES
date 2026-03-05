# CEEES Deep Learning Week Hackathon 2026 Project

![HaLoop Logo](./HaLoop_Logo.png)

Track 1 implementation: a safe, human-governed AI coding agent with:

- `ide-plugin/`: VS Code extension for AI tasks + local guardrails
- `guardian-web/`: dashboard and backend APIs for approvals, incident mode, policy, audit
- `sqlite/`: SQLite schema for backend mirror persistence

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
- `docs/mermaid.md`: architecture diagram (Mermaid source for documentation and GitHub rendering)
- `docs/README.md`: docs index/maintenance notes

## Architecture Diagram

```mermaid
flowchart LR


    subgraph Client_Layer["User Interface"]
        USER["Developer / Reviewer"]
        WEB["Guardian Web UI (Next.js)"]
        PLUGIN["VS Code IDE Plugin"]
    end

    subgraph Plugin_Intelligence["IDE Plugin Intelligence"]
        CONTEXT["Local Context Collector"]
        RISK["Local Risk Evaluation"]
        GUARD["Governance Guardrails"]
        DMS["Dead Man's Switch Rollback"]
        FALLBACK["Local Simulated Approval Fallback"]
    end

    subgraph Governance_Core["Guardian-Web Governance Core"]
        API["Next.js API Routes"]
        PLAN["Plan Generation (/generate-plan)"]
        APPROVAL["Human-in-the-Loop Approval Workflow"]
        EVENTS["Decision Events (Polling/SSE)"]
        INCIDENT["Incident Mode Control"]
        POLICY["Policy + Path Rules"]
        AUDIT["Audit Views + Records"]
    end

    subgraph Data_Layer["Data and Persistence"]
        STORE["Integration Store (CR/Policy/Audit)"]
        MIRROR["SQLite Backend Mirror"]
    end

    USER --> WEB
    USER --> PLUGIN

    PLUGIN --> CONTEXT --> RISK --> GUARD
    GUARD -->|low-risk path| PLUGIN
    GUARD -->|high-risk requires approval| API
    GUARD -->|backend unreachable| FALLBACK --> PLUGIN

    WEB --> API
    PLUGIN -->|POST /generate-plan| API
    PLUGIN <-->|POST /approvals + GET decision/events| API

    API --> PLAN
    API --> APPROVAL --> EVENTS
    API --> INCIDENT
    API --> POLICY
    API --> AUDIT

    APPROVAL --> STORE
    INCIDENT --> STORE
    POLICY --> STORE
    AUDIT --> STORE
    API --> MIRROR

    PLUGIN --> DMS

    classDef client fill:#e1f5fe,stroke:#01579b,color:#111;
    classDef plugin fill:#f3e5f5,stroke:#6a1b9a,color:#111;
    classDef gov fill:#e8f5e9,stroke:#2e7d32,color:#111;
    classDef data fill:#fff3e0,stroke:#e65100,color:#111;

    class USER,WEB,PLUGIN client
    class CONTEXT,RISK,GUARD,DMS,FALLBACK plugin
    class API,PLAN,APPROVAL,EVENTS,INCIDENT,POLICY,AUDIT gov
    class STORE,MIRROR data

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
```

### Windows PowerShell

```powershell
Set-Location guardian-web; npm ci
Set-Location ../ide-plugin; npm ci
Set-Location ..
```

## Run Locally

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
