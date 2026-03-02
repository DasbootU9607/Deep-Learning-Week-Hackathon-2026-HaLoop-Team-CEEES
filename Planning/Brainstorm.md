> Historical planning note. Current implementation docs live in `../README.md`.

DLW track:

briefings: 形式：website+插件

网页功能：**网站端（协作 \+ 治理中枢）应该做什么**

### **1\) 任务委派与审批流（Human-in-the-loop）**

* **任务看板**：把 agent 的工作拆成 Ticket/Task（需求拆解、修 bug、写测试、生成迁移脚本、写 runbook）。

* **审批节点**：不同风险级别对应不同审批：

  * 低风险：文档、注释、测试补全 → 允许自动开 PR

  * 中风险：业务逻辑变更 → 必须 reviewer 通过

  * 高风险：DB migration / 权限 / infra → 必须双人审批 \+ 变更窗口

* **“紧急模式”开关**：事故期间可以加速，但必须留痕、强制事后复盘。

### **2\) 统一的安全护栏策略（Policy-as-code）**

* 企业最需要的是“可配置、可审计的规则”：

  * 禁止直接执行破坏性操作（DROP TABLE / terraform destroy / 生产环境写操作）

  * 只允许在 **sandbox / preview** 环境跑高风险命令

  * 强制要求：所有变更必须带测试、带回滚方案、带 owner

* 用规则把“AI 能做什么/不能做什么”写死，然后下发给插件执行。

### **3\) 变更审计与可追溯（Evidence & Audit）**

* **全链路记录**：需求 → agent 的计划 → 生成的 diff → 运行的命令 → 测试结果 → 审批人 → 合并记录

* **可导出审计包**：一键导出“这次变更为什么做、改了什么、谁批准、如何回滚”的证据，满足合规/内审。

### **4\) 风险评估与自动打标（Risk Scoring）**

* 每个任务/PR 自动打风险分：触及哪些目录（infra/db/auth）、修改范围、依赖升级、是否跨服务。

* 风险分驱动审批流、限制 agent 权限、决定是否允许自动运行测试/部署。

### **5\) 事故响应中心（Incident Console）**

* 让网站成为“故障时的指挥塔”：

  * 自动拉取日志/告警摘要，生成 **事故时间线**

  * agent 提供“可执行的排障方案”，但每一步都要求人工确认

  * 生成事后复盘（RCA、行动项、Runbook 更新）

### **6\) 多人协作：评论、讨论、决策记录**

* PR/设计文档级别的协作：讨论线程、决策记录（ADR）、结论与责任人。

* “为什么不选方案B”这类关键信息要沉淀，避免下次 agent 重复走弯路。

插件功能：zhiqin:**AI辅助编码（本地、实时）**

* Codex在编写代码时提供内联建议  
* 直接在编辑器中"解释此代码"/"重构此函数"  
* 按需自动生成样板代码、测试用例和文档  
* IDE内置对话界面，可向Codex下达多步骤任务

**操作节点的安全护栏**

* 执行任何重大变更前，向开发者展示差异预览，需确认/取消  
* 本地标记高风险操作（例如："您即将修改数据库结构——此操作需要团队审批"）  
* 阻止自动推送到受保护分支——转而路由至网页审批队列

**与网页治理系统同步**

* 拉取网页上设置的团队策略（"您的团队已禁止AI编辑 `/auth` 文件夹"）  
* 一键将AI生成的变更提交至网页审查队列  
* 无需离开IDE即可查看来自队友的待审批请求

**本地上下文感知**

* Codex读取本地代码库，提供上下文感知建议  
* 检测AI生成代码中的密钥/凭证，在提交前拦截  
* Git感知：理解当前分支、近期提交、开放中的P

| Feature Category | Web Dashboard (Governance & Oversight) | Local IDE Plugin (Execution & Guardrails) |
| ----- | ----- | ----- |
| **Primary Role** | Centralized oversight, multi-user collaboration, and full workflow visualization. | Local developer interface, executing tasks, and enforcing local safety boundaries. |
| **Visibility** | **Full Flow Overview:** Visualizes the entire project "blast radius" (node-graph of affected files/services). | **Local Context:** Analyzes the active file, local workspace state, and immediate dependencies. |
| **Governance** | **Audit & Approvals:** Centralized log of all AI actions; interface to approve, modify, or deny sensitive operations. | **Action Interception:** Automatically pauses destructive AI actions (like terminal commands or DB edits) and requests web permission. |
| **Collaboration** | **Multi-Collab:** Managers, security, and senior devs can jointly review, comment on, and authorize AI proposals. | **Developer UI:** The chat interface where the dev prompts the AI, reviews the plan, and tracks pending approvals. |
| **Safety** | **Global Policy Engine:** Define rules (e.g., "Require approval for `package.json` changes") enforced across all plugins. | **Local Dead Man's Switch:** A prominent button to instantly halt AI execution and revert uncommitted local changes. |
| **Execution** | **Simulated Dry-Runs:** View results of cloud-sandboxed executions before approving them for local application. | **Task Application:** Applies the approved code diffs or executes the approved terminal commands directly in the IDE. |
