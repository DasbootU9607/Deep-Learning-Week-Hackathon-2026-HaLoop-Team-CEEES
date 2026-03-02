> Historical planning note. Current implementation docs live in `../README.md`.

# Implementation & Work Distribution Plan: Track 1 AI Agent

## 🛠️ Recommended Tech Stack (Optimized for Hackathon Speed)

### 1. Web Dashboard (Governance & Oversight)

* **Framework:** Next.js (React) + TypeScript. (Fastest way to build full-stack applications with serverless API routes).
* **UI/Styling:** Tailwind CSS + Shadcn UI. (Provides premium, accessible components for dashboards out-of-the-box).
* **Visualization:** React Flow. (Crucial for building the "Blast Radius" node-graph of affected files/services).
* **Database & Auth:** Supabase (PostgreSQL). (Provides immediate Auth, Database, and **Real-time WebSockets**, which are essential for the plugin-to-web approval flow).

### 2. IDE Plugin (Execution & Guardrails)

* **Platform:** VS Code Extension API.
* **Language:** TypeScript.
* **UI View:** React inside VS Code Webviews. (Allows code reuse from the Web Dashboard for the chat and preview UI).

### 3. AI & Backend Orchestration

* **AI Agent Framework:** Vercel AI SDK or LangChain (JS/TS).
* **LLM:** OpenAI GPT-4o or Anthropic Claude 3.5 Sonnet.
* **Execution Environment:** Node.js (can run directly in Next.js API routes or Supabase Edge Functions).

---

## 👥 Team Work Distribution (4 Members)

To maximize efficiency and minimize Git merge conflicts, ownership is divided by technical domain. 

### 🧑‍💻 Member 1: Web Frontend & Visualization Lead

**Focus:** Building the Governance Dashboard, Collaboration UI, and visual impact analysis.

* **Key Tasks:**
    - Scaffold the Next.js project and configure Tailwind/Shadcn UI.
    - Build the **Task/Approval Kanban Board** and the **Incident Console** (Audit logs, emergency toggle).
    - Implement **React Flow** to visualize the "Blast Radius" (showing a graph of which files/services an AI PR will affect).
    - Build the UI for Policy Configuration (defining security rules).

### 🧑‍💻 Member 2: VS Code Plugin Lead

**Focus:** The developer's local experience, context gathering, and action interception.

* **Key Tasks:**
    - Scaffold the VS Code Extension and set up the Webview for the AI Chat.
    - Build the **Interception Engine**: Catching destructive actions (like executing terminal commands or generating high-risk diffs) and pausing them.
    - Implement the **"Dead Man's Switch"** (a prominent UI button to instantly revert uncommitted local AI changes).
    - Read local context (active file, open tabs, git branch) to feed into the AI prompt.

### 🧑‍💻 Member 3: Backend, AI Orchestration & Intelligence Lead

**Focus:** The "Brain" of the system, LLM prompt engineering, and risk evaluation.

* **Key Tasks:**
    - Define and manage the Supabase Database schema (Users, Policies, Audit Logs, Approval Requests).
    - Write the core LLM Prompts (e.g., forcing the AI to output plans in a structured JSON format before writing code).
    - Build the **Risk Scoring Engine**: An algorithm/prompt that evaluates an AI plan and assigns a risk score based on touched files (e.g., changes to `/auth` or DB schemas = High Risk).
    - Expose API endpoints for the Web Dashboard and Plugin.

### 🧑‍💻 Member 4: Integration, Real-Time Sync & Security Flow Lead

**Focus:** Connecting the Plugin to the Web, ensuring real-time communication, and enforcing policies.

* **Key Tasks:**
    - Implement **Real-time WebSockets** (via Supabase): Ensure that when the Plugin pauses for a high-risk action, it instantly triggers an approval request pop-up on the Web Dashboard.
    - Build the **Policy-as-Code Logic**: Translate the rules set in the Web Dashboard (e.g., "Require approval for `package.json` changes") into active checks that the Backend uses to block the AI Plugin.
    - End-to-end testing of the "Golden Path" (Dev asks AI -> AI plans -> Plugin pauses -> Web approves -> Plugin applies diff).
    - Assist Member 2 with the complex logic of applying accepted code diffs inside VS Code.

---

## 📅 Suggested Hackathon Timeline & Milestones

### Phase 1: Skeleton & Connectivity (20% Time)

* **Goal:** End-to-end connectivity without AI.
* **Action:** M1 & M3 setup Next.js + Supabase. M2 & M4 setup VS Code extension.
* **Milestone:** The VS Code Plugin can send a hardcoded "Approval Request" string to the DB, and it appears on the Web Dashboard in real-time.

### Phase 2: Core Features & Intelligence (50% Time)

* **Goal:** Functional AI generation and interception.
* **Action:** 
    - M1 builds the React Flow Blast Radius and Approval interface.
    - M2 builds the IDE Chat UI and local file diff preview.
    - M3 connects the LLM to generate actual code/plans and scores the risk.
    - M4 wires the LLM output to the interception logic and web approval flow.
* **Milestone:** A developer can ask the Plugin to write code; if it's high risk, the Web Dashboard successfully blocks it until a user clicks "Approve".

### Phase 3: "Wow" Factor, Polish & Pitch (30% Time)

* **Goal:** Ensure the demo looks flawless and emphasizes safety.
* **Action:**
    - Polish the Web UI (M1).
    - Refine the Policy Engine rules and Audit Log export feature (M3 & M4).
    - Finalize the "Dead Man's Switch" and ensure local rollbacks work perfectly (M2).
    - **Team:** Record the demo video focusing strictly on the "governance" aspect, showing how an unauthorized DB drop is blocked by the system.

---

## ⚡ 1-Day Alignment Rules (No Fluff)

* One source of truth: this file only. If scope changes, update here immediately.
* Nothing is "done" unless it works in golden path end-to-end.
* PRs stay small; merge every 2-3 hours to avoid late conflicts.
* Hard stop on feature creep after `09:00`; only demo-critical fixes after that.
