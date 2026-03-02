# HaLoop Architecture (Novelty-Focused)

This diagram highlights the innovative governance features documented in project READMEs:

- human-governed AI workflow
- local risk guardrails in the IDE plugin
- high-risk approval gating
- incident mode control
- Dead Man's Switch rollback
- audit visibility
- SQLite backend mirror compatibility

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

