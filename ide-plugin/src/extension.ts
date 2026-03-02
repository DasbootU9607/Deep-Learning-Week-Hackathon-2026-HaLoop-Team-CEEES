import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { registerDeadManSwitchCommand } from "./commands/deadManSwitch";
import { registerOpenChatCommand } from "./commands/openChat";
import { registerRunTaskCommand } from "./commands/runAiTask";
import { ChangeApplier } from "./core/changeApplier";
import { ContextCollector } from "./core/contextCollector";
import { RiskEvaluation, RiskGate } from "./core/riskGate";
import { RollbackManager } from "./core/rollbackManager";
import { SessionManifest, SessionStore } from "./core/sessionStore";
import { AgentState, ExtensionStateMachine } from "./core/stateMachine";
import { AIClient } from "./infra/aiClient";
import { ApprovalClient } from "./infra/approvalClient";
import { GitClient } from "./infra/gitClient";
import { Logger } from "./infra/logger";
import { SupabaseRealtimeClient } from "./infra/supabaseRealtime";
import { GeneratePlanResponse, generatePlanRequestSchema } from "./schemas/contracts";
import { HostToWebviewMessage, WebviewToHostMessage, isWebviewToHostMessage } from "./webview/messageBridge";
import { PlanView, PluginUiState } from "./webview/uiState";

export function activate(context: vscode.ExtensionContext): void {
  const logger = new Logger();
  const gitClient = new GitClient();
  const realtimeClient = new SupabaseRealtimeClient(logger);
  const pollIntervalMs = Number(vscode.workspace.getConfiguration("aiGov").get<number>("pollIntervalMs") ?? 3000);

  const host = new ExtensionHost(
    context,
    logger,
    new ContextCollector(gitClient),
    new AIClient(logger),
    new RiskGate(),
    new ChangeApplier(),
    new SessionStore(context),
    new RollbackManager(gitClient),
    new ApprovalClient(logger, realtimeClient, pollIntervalMs)
  );

  context.subscriptions.push(
    host,
    registerOpenChatCommand(() => host.openChat()),
    registerRunTaskCommand((prompt?: string) => host.runTask(prompt)),
    registerDeadManSwitchCommand(() => host.deadManSwitch())
  );

  logger.info("AI Governance extension activated.");
}

export function deactivate(): void {
  // No-op. Cleanup happens in disposables.
}

class ExtensionHost implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private readonly stateMachine = new ExtensionStateMachine();
  private readonly eventLog: string[] = [];

  private currentSessionId: string | undefined;
  private currentPlan: GeneratePlanResponse | undefined;
  private currentRisk: RiskEvaluation | undefined;
  private currentContext: Awaited<ReturnType<ContextCollector["collect"]>> | undefined;
  private currentApprovalId: string | undefined;
  private latestManifest: SessionManifest | undefined;
  private pendingDecisionCancel: (() => void) | undefined;
  private lastError: string | undefined;

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: Logger,
    private readonly contextCollector: ContextCollector,
    private readonly aiClient: AIClient,
    private readonly riskGate: RiskGate,
    private readonly changeApplier: ChangeApplier,
    private readonly sessionStore: SessionStore,
    private readonly rollbackManager: RollbackManager,
    private readonly approvalClient: ApprovalClient
  ) {}

  public async openChat(): Promise<void> {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel("aiGov.chat", "AI Governance", vscode.ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, "dist", "webview"))]
      });

      this.panel.webview.html = this.renderWebviewHtml(this.panel.webview);
      this.panel.onDidDispose(
        () => {
          this.panel = undefined;
        },
        undefined,
        this.context.subscriptions
      );

      this.panel.webview.onDidReceiveMessage(
        (message: unknown) => {
          if (!isWebviewToHostMessage(message)) {
            return;
          }
          void this.handleWebviewMessage(message);
        },
        undefined,
        this.context.subscriptions
      );
    } else {
      this.panel.reveal(vscode.ViewColumn.Beside, false);
    }

    await this.publishState();
  }

  public async runTask(prompt?: string): Promise<void> {
    await this.openChat();

    const inputPrompt = (prompt?.trim() || (await vscode.window.showInputBox({ prompt: "Ask AI to generate code changes" }))?.trim()) ?? "";
    if (!inputPrompt) {
      return;
    }

    await this.executeTask(inputPrompt);
  }

  public async deadManSwitch(): Promise<void> {
    try {
      const manifest = this.latestManifest ?? (await this.sessionStore.load());
      if (!manifest) {
        vscode.window.showInformationMessage("No AI session manifest found for rollback.");
        return;
      }

      this.addEvent("Dead Man's Switch triggered.");
      const report = await this.rollbackManager.rollback(manifest);

      if (report.restored.length > 0) {
        this.addEvent(`Rollback restored: ${report.restored.join(", ")}.`);
      }
      if (report.skipped.length > 0) {
        this.addEvent(`Rollback skipped: ${report.skipped.map((x) => `${x.path} (${x.reason})`).join("; ")}.`);
      }
      if (report.conflicts.length > 0) {
        this.addEvent(`Rollback conflicts: ${report.conflicts.map((x) => `${x.path} (${x.reason})`).join("; ")}.`);
      }

      if (this.stateMachine.canTransition("ROLLED_BACK")) {
        this.stateMachine.transition("ROLLED_BACK");
      } else {
        this.stateMachine.force("ROLLED_BACK");
      }

      if (report.conflicts.length === 0) {
        await this.sessionStore.clear();
      }

      await this.publishState();
    } catch (error) {
      this.handleError(error);
    }
  }

  public dispose(): void {
    this.pendingDecisionCancel?.();
    this.logger.dispose();
  }

  private async handleWebviewMessage(message: WebviewToHostMessage): Promise<void> {
    switch (message.type) {
      case "ui.ready":
        await this.publishState();
        break;
      case "ui.submitPrompt":
        await this.executeTask(message.prompt);
        break;
      case "ui.apply":
        await this.applyCurrentPlan();
        break;
      case "ui.cancel":
        this.cancelCurrentFlow();
        break;
      case "ui.deadManSwitch":
        await this.deadManSwitch();
        break;
      default:
        break;
    }
  }

  private async executeTask(prompt: string): Promise<void> {
    try {
      this.cancelPendingDecision();
      if (this.stateMachine.getState() !== "IDLE") {
        if (this.stateMachine.canTransition("IDLE")) {
          this.stateMachine.transition("IDLE");
        } else {
          this.stateMachine.force("IDLE");
        }
      }
      this.lastError = undefined;
      this.currentPlan = undefined;
      this.currentRisk = undefined;
      this.currentApprovalId = undefined;

      this.currentSessionId = randomUUID();
      this.transition("COLLECTING_CONTEXT");
      this.addEvent("Collecting local context.");

      const context = await this.contextCollector.collect();
      this.currentContext = context;

      this.transition("DRAFTING_PLAN");
      this.addEvent("Requesting AI-generated plan.");

      const request = generatePlanRequestSchema.parse({
        sessionId: this.currentSessionId,
        prompt,
        context
      });

      const plan = await this.aiClient.generatePlan(request);
      this.currentPlan = plan;
      this.currentRisk = this.riskGate.evaluate(plan);

      this.addEvent(`Plan ready: ${plan.changes.length} file(s), risk=${this.currentRisk.finalRiskScore}.`);

      if (this.currentRisk.decision === "REQUIRE_APPROVAL") {
        const approval = await this.approvalClient.createApprovalRequest({
          planId: plan.planId,
          sessionId: this.currentSessionId,
          riskScore: this.currentRisk.finalRiskScore,
          reasons: this.currentRisk.reasons,
          files: plan.changes.map((change) => change.path),
          commandCount: plan.proposedCommands.length
        });

        this.currentApprovalId = approval.approvalId;
        this.transition("WAITING_APPROVAL");
        this.addEvent(`Approval requested: ${approval.approvalId}.`);
        await this.publishState();

        const pending = this.approvalClient.waitForDecision(approval.approvalId);
        this.pendingDecisionCancel = pending.cancel;

        if (!hasBackendConfigured()) {
          void this.approvalClient.requestLocalDecision(approval.approvalId);
        }

        const decision = await pending.promise;
        this.pendingDecisionCancel = undefined;

        if (decision.decision === "approved") {
          this.transition("APPROVED");
          this.addEvent(`Approved by ${decision.reviewer}.`);
        } else {
          this.transition("DENIED");
          this.addEvent(`Denied by ${decision.reviewer}.`);
        }

        await this.publishState();
        return;
      }

      this.transition("PREVIEW_READY");
      if (this.currentRisk.warning) {
        this.addEvent(this.currentRisk.warning);
      }
      await this.publishState();
    } catch (error) {
      this.handleError(error);
    }
  }

  private async applyCurrentPlan(): Promise<void> {
    if (!this.currentPlan || !this.currentContext || !this.currentSessionId) {
      vscode.window.showWarningMessage("No generated plan available to apply.");
      return;
    }

    if (!this.canApply()) {
      vscode.window.showWarningMessage("Plan cannot be applied in the current state.");
      return;
    }

    try {
      this.transition("APPLYING");
      this.addEvent("Applying approved plan.");
      await this.publishState();

      const manifest = await this.changeApplier.applyChanges({
        sessionId: this.currentSessionId,
        planId: this.currentPlan.planId,
        workspaceRoot: this.currentContext.workspaceRoot,
        changes: this.currentPlan.changes
      });

      this.latestManifest = manifest;
      await this.sessionStore.save(manifest);

      this.transition("APPLIED");
      this.addEvent(`Applied ${manifest.touchedFiles.length} file(s).`);
      await this.publishState();
    } catch (error) {
      this.handleError(error);
    }
  }

  private cancelCurrentFlow(): void {
    this.cancelPendingDecision();
    this.currentApprovalId = undefined;
    this.currentPlan = undefined;
    this.currentRisk = undefined;
    this.lastError = undefined;

    if (this.stateMachine.getState() !== "IDLE") {
      if (this.stateMachine.canTransition("IDLE")) {
        this.stateMachine.transition("IDLE");
      } else {
        this.stateMachine.force("IDLE");
      }
    }

    this.addEvent("Flow canceled by user.");
    void this.publishState();
  }

  private cancelPendingDecision(): void {
    if (this.pendingDecisionCancel) {
      this.pendingDecisionCancel();
      this.pendingDecisionCancel = undefined;
    }
  }

  private transition(next: AgentState): void {
    if (this.stateMachine.getState() === next) {
      return;
    }

    if (this.stateMachine.canTransition(next)) {
      this.stateMachine.transition(next);
      return;
    }

    this.logger.warn(`Forced transition ${this.stateMachine.getState()} -> ${next}`);
    this.stateMachine.force(next);
  }

  private async publishState(): Promise<void> {
    if (!this.panel) {
      return;
    }
    const payload: HostToWebviewMessage = {
      type: "host.state",
      payload: this.buildUiState()
    };
    await this.panel.webview.postMessage(payload);
  }

  private buildUiState(): PluginUiState {
    const status = this.stateMachine.getState();
    const isBusy = status === "COLLECTING_CONTEXT" || status === "DRAFTING_PLAN" || status === "WAITING_APPROVAL" || status === "APPLYING";

    return {
      status,
      canApply: this.canApply(),
      isBusy,
      approvalId: this.currentApprovalId,
      plan: this.currentPlan ? toPlanView(this.currentPlan) : undefined,
      risk: this.currentRisk
        ? {
            localRiskScore: this.currentRisk.localRiskScore,
            finalRiskScore: this.currentRisk.finalRiskScore,
            decision: this.currentRisk.decision,
            reasons: this.currentRisk.reasons,
            warning: this.currentRisk.warning
          }
        : undefined,
      error: this.lastError,
      events: this.eventLog.slice(-10)
    };
  }

  private canApply(): boolean {
    if (!this.currentPlan || !this.currentRisk) {
      return false;
    }

    const state = this.stateMachine.getState();
    if (state === "APPROVED") {
      return true;
    }

    return state === "PREVIEW_READY" && this.currentRisk.decision !== "REQUIRE_APPROVAL";
  }

  private handleError(error: unknown): void {
    const message = redactSecrets(toErrorMessage(error));
    this.lastError = message;
    this.addEvent(`Error: ${message}`);
    this.logger.error(message);

    if (this.stateMachine.getState() !== "ERROR") {
      if (this.stateMachine.canTransition("ERROR")) {
        this.stateMachine.transition("ERROR");
      } else {
        this.stateMachine.force("ERROR");
      }
    }

    void this.publishState();
  }

  private addEvent(message: string): void {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${redactSecrets(message)}`;
    this.eventLog.push(line);
    if (this.eventLog.length > 10) {
      this.eventLog.shift();
    }
    this.logger.info(line);
  }

  private renderWebviewHtml(webview: vscode.Webview): string {
    const distRoot = path.join(this.context.extensionPath, "dist", "webview");
    const htmlPath = path.join(distRoot, "index.html");
    const scriptPath = path.join(distRoot, "app.js");

    if (!fs.existsSync(htmlPath) || !fs.existsSync(scriptPath)) {
      return [
        "<html><body>",
        "<h3>Webview bundle missing.</h3>",
        "<p>Run <code>npm run build</code> inside <code>ide-plugin/</code> and reload the window.</p>",
        "</body></html>"
      ].join("");
    }

    const template = fs.readFileSync(htmlPath, "utf8");
    const scriptUri = webview.asWebviewUri(vscode.Uri.file(scriptPath));

    return template.replace(/\{\{cspSource\}\}/g, webview.cspSource).replace(/\{\{scriptUri\}\}/g, scriptUri.toString());
  }
}

function toPlanView(plan: GeneratePlanResponse): PlanView {
  return {
    planId: plan.planId,
    summary: plan.summary,
    changes: plan.changes.map((change) => ({
      path: change.path,
      action: change.action
    })),
    proposedCommands: plan.proposedCommands,
    backendRisk: plan.backendRisk
  };
}

function hasBackendConfigured(): boolean {
  const rawBackendUrl = String(vscode.workspace.getConfiguration("aiGov").get<string>("backendUrl") ?? "").trim();
  const backendUrl = normalizeBackendUrl(rawBackendUrl);
  return backendUrl.length > 0;
}

function redactSecrets(value: string): string {
  return value
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]")
    .replace(/(api[_-]?key|token|secret)\s*[:=]\s*['\"][^'\"]+['\"]/gi, "$1=[REDACTED]");
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeBackendUrl(value: string): string {
  const trimmed = value.replace(/\/+$/, "");
  if (trimmed.endsWith("/api")) {
    return trimmed.slice(0, -4);
  }
  return trimmed;
}
