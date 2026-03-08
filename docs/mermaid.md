# HaLoop Architecture

This Mermaid source reflects the current runtime architecture in this repository:

- IDE plugin context collection, local risk gating, apply, and rollback flow
- Guardian Web reviewer dashboard and governance APIs
- synchronous plugin planning plus async queued plan generation
- demo/prod persistence split with SQLite mirror compatibility
- OpenAI reliability, request tracing, incident control, and audit flow

Final exported README image: `../.github/assets/haloop-architecture-final.png`

```mermaid
flowchart LR

%% Actors
DEV["Developer<br/>VS Code extension host"]
REVIEWER["Reviewer / Admin<br/>Guardian Web"]

%% ================= IDE PLUGIN =================
subgraph IDE["IDE Plugin Runtime"]

direction TB

UI["Commands + Webview UI"]

CTX["ContextCollector<br/>workspace, branch, active file"]

CLIENT["AIClient"]

GATE["RiskGate<br/>finalRisk = max(local, backend)"]

APPROVAL_CLIENT["ApprovalClient<br/>POST /approvals"]

LOCAL_FALLBACK["Local simulated approval"]

APPLY["ChangeApplier"]

ROLLBACK["SessionStore<br/>Dead Man Switch"]

UI --> CTX --> CLIENT --> GATE

GATE --> UI
GATE --> APPROVAL_CLIENT
APPROVAL_CLIENT --> LOCAL_FALLBACK

UI --> APPLY --> ROLLBACK

end


%% ================= WORKSPACE =================
subgraph WORKSPACE["Developer Workspace"]

direction TB

REPO["Repo files + Git state"]

end

APPLY --> REPO
REPO --> CTX


%% ================= SERVICE =================
subgraph SERVICE["Guardian Web Service"]

direction TB

DASH["Dashboard UI<br/>React Query"]

%% Routes
subgraph ROUTES["Next.js Routes"]
direction TB

PLUGIN_ROUTES["/generate-plan<br/>/approvals<br/>events"]

REVIEW_ROUTES["/api/cr<br/>/api/policy<br/>/api/audit"]

AI_ROUTES["/api/ai/plan<br/>/api/jobs"]

end

%% Core
subgraph CORE["Planning + Governance Core"]

direction TB

EXEC["Plan Execution"]

POLICY["Policy Engine"]

OPENAI_REL["OpenAI Reliability Layer"]

HEURISTIC["Heuristic Planner"]

APPROVAL_CORE["Approval Workflow"]

INCIDENT["Incident Mode"]

AUDIT["Audit Engine"]

STORE["DataStore Adapter"]

end

end


%% ================= INFRA =================
subgraph INFRA["Infra + External"]

direction TB

OPENAI["OpenAI Responses API"]

REDIS["Redis + BullMQ"]

WORKER["Plan Worker"]

TELEMETRY["OTel Telemetry"]

end


%% ================= DATA =================
subgraph DATA["Persistence"]

direction TB

DEMO["Demo JSON Store"]

SQLITE["SQLite Mirror"]

POSTGRES["Postgres"]

end


%% ================= MAIN CONNECTIONS =================

DEV --> UI

CLIENT --> PLUGIN_ROUTES

PLUGIN_ROUTES --> EXEC
PLUGIN_ROUTES --> APPROVAL_CORE

EXEC --> POLICY
EXEC --> OPENAI_REL
EXEC --> HEURISTIC
EXEC --> STORE
EXEC --> TELEMETRY

OPENAI_REL --> OPENAI

PLUGIN_ROUTES --> CLIENT

APPROVAL_CLIENT --> PLUGIN_ROUTES
APPROVAL_CORE --> PLUGIN_ROUTES

REVIEWER --> DASH
DASH --> REVIEW_ROUTES

REVIEW_ROUTES --> POLICY
REVIEW_ROUTES --> INCIDENT
REVIEW_ROUTES --> AUDIT
REVIEW_ROUTES --> APPROVAL_CORE

AI_ROUTES --> EXEC
AI_ROUTES --> REDIS
REDIS --> WORKER
WORKER --> EXEC

POLICY --> STORE
INCIDENT --> STORE
AUDIT --> STORE
APPROVAL_CORE --> STORE

STORE --> DEMO
STORE --> SQLITE
STORE --> POSTGRES


%% ================= STYLE =================
classDef actor fill:#e6f2ff,stroke:#1d5fa7
classDef plugin fill:#f6ecff,stroke:#7a3db8
classDef service fill:#ebf7ee,stroke:#2f7a43
classDef infra fill:#fff1df,stroke:#b86a1f
classDef data fill:#fff7d6,stroke:#9c7a00

class DEV,REVIEWER actor
class UI,CTX,CLIENT,GATE,APPROVAL_CLIENT,LOCAL_FALLBACK,APPLY,ROLLBACK plugin
class DASH,PLUGIN_ROUTES,REVIEW_ROUTES,AI_ROUTES,EXEC,POLICY,OPENAI_REL,HEURISTIC,APPROVAL_CORE,INCIDENT,AUDIT,STORE service
class OPENAI,REDIS,WORKER,TELEMETRY infra
class DEMO,SQLITE,POSTGRES,REPO data
```
