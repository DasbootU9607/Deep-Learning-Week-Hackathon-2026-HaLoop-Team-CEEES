# HaLoop Architecture Diagram (Mermaid Guide)

This document provides ready-to-use Mermaid templates for HaLoop architecture diagrams.

## 1. How To Use

1. Copy any Mermaid block below.
2. Paste it into:
   - Mermaid Live Editor: `https://mermaid.live`
   - GitHub/GitLab Markdown (Mermaid-supported)
   - VS Code with Mermaid preview extension
3. Adjust node names and edges as your implementation evolves.

---

## 2. High-Level System Architecture

```mermaid
flowchart LR
    subgraph Client Layer
      U[User]
      W[Web UI - Next.js]
      P[IDE Plugin]
    end

    subgraph App Layer
      API[Next.js API Routes]
      GOV[Policy + Risk Engine]
      APPROVAL[Approval Workflow]
      INCIDENT[Incident Mode Control]
    end

    subgraph Data Layer
      STORE[(Data Store / SQLite Mirror)]
      AUDIT[(Audit Logs)]
      POLICY[(Policy Config)]
    end

    U --> W
    U --> P
    W --> API
    P --> API

    API --> GOV
    API --> APPROVAL
    API --> INCIDENT

    GOV --> STORE
    APPROVAL --> STORE
    INCIDENT --> STORE

    STORE --> AUDIT
    STORE --> POLICY
```

---

## 3. Frontend + Backend Interaction

```mermaid
sequenceDiagram
    actor Dev as Developer
    participant Plugin as IDE Plugin
    participant Web as Web UI
    participant API as Next.js API
    participant Store as Data Store

    Dev->>Plugin: Submit prompt / task
    Plugin->>API: POST /generate-plan (or /api/ai/plan)
    API->>Store: Save generated plan + risk
    API-->>Plugin: Plan + risk result

    Plugin->>API: POST /approvals (or /api/approvals)
    API->>Store: Create approval ticket
    API-->>Plugin: approvalId

    Web->>API: GET /api/cr , /api/audit, /api/policy/*
    API->>Store: Read state
    API-->>Web: Dashboard data

    Web->>API: POST /api/cr/:id/approve | reject
    API->>Store: Update decision + audit
    API-->>Web: Updated CR state
```

---

## 4. Governance Decision Flow

```mermaid
flowchart TD
    A[Plan Generated] --> B{Risk Score}
    B -->|Low| C[Auto-allow path]
    B -->|Medium| D[Reviewer suggested]
    B -->|High| E[Approval required]

    E --> F{Incident Mode?}
    F -->|Yes| G[Block approval action]
    F -->|No| H[Reviewer decision]

    H -->|Approve| I[CR Approved]
    H -->|Reject| J[CR Rejected]

    I --> K[Audit log update]
    J --> K
    G --> K
```

---

## 5. API Surface Map (Current)

```mermaid
graph TD
    A[Client Apps] --> B[/generate-plan]
    A --> C[/approvals]
    A --> D[/approvals/:approvalId/decision]
    A --> E[/approvals/:approvalId/events]

    A --> F[/api/cr]
    A --> G[/api/cr/:id]
    A --> H[/api/cr/:id/approve]
    A --> I[/api/cr/:id/reject]
    A --> J[/api/cr/:id/request-changes]

    A --> K[/api/audit]
    A --> L[/api/policy/active]
    A --> M[/api/policy/path-rules]
    A --> N[/api/incident]
```

---

## 6. Styling Tips For Mermaid

Use classes to color subsystems:

```mermaid
flowchart LR
    UI[UI]
    API[API]
    DB[(DB)]

    UI --> API --> DB

    classDef ui fill:#e8f0ff,stroke:#4a6cf7,color:#111;
    classDef api fill:#ecfff1,stroke:#1f9d55,color:#111;
    classDef db fill:#fff7e8,stroke:#d97706,color:#111;

    class UI ui
    class API api
    class DB db
```

---

## 7. Recommended Diagram Set For Documentation

1. **System Context Diagram**: user, plugin, web app, backend.
2. **Container Diagram**: frontend, API layer, policy engine, store.
3. **Sequence Diagram**: plan generation + approval path.
4. **Operational Flow**: incident mode behavior and decision blocking.

Use this file as the single source for diagram updates.

