> Historical planning note. Current implementation docs live in `../README.md`.

# Track 1: Safe, Human-Governed AI Coding Agent - Feature Architecture

This table outlines the separation of concerns and features between the Web Dashboard (for governance) and the Local IDE Plugin (for execution).

| Feature Category | Web Dashboard (Governance & Oversight) | Local IDE Plugin (Execution & Guardrails) |
| :--- | :--- | :--- |
| **Primary Role** | Centralized oversight, multi-user collaboration, and full workflow visualization. | Local developer interface, executing tasks, and enforcing local safety boundaries. |
| **Visibility** | **Full Flow Overview:** Visualizes the entire project "blast radius" (node-graph of affected files/services). | **Local Context:** Analyzes the active file, local workspace state, and immediate dependencies. |
| **Governance** | **Audit & Approvals:** Centralized log of all AI actions; interface to approve, modify, or deny sensitive operations. | **Action Interception:** Automatically pauses destructive AI actions (like terminal commands or DB edits) and requests web permission. |
| **Collaboration** | **Multi-Collab:** Managers, security, and senior devs can jointly review, comment on, and authorize AI proposals. | **Developer UI:** The chat interface where the dev prompts the AI, reviews the plan, and tracks pending approvals. |
| **Safety** | **Global Policy Engine:** Define rules (e.g., "Require approval for `package.json` changes") enforced across all plugins. | **Local Dead Man's Switch:** A prominent button to instantly halt AI execution and revert uncommitted local changes. |
| **Execution** | **Simulated Dry-Runs:** View results of cloud-sandboxed executions before approving them for local application. | **Task Application:** Applies the approved code diffs or executes the approved terminal commands directly in the IDE. |
