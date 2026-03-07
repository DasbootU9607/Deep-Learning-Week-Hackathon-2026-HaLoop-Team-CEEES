import { randomUUID } from "node:crypto";
import { generatePlanForGoal } from "@/lib/server/backendPlan";
import { persistStandalonePlanRequest } from "@/lib/server/backendMirror";
import { approvalRequestSchema } from "@/lib/server/contracts";
import { createApprovalTicket, saveGeneratedPlan } from "@/lib/server/dataStore";
import { withSpan } from "@/lib/server/tracing";

export interface PlanExecutionInput {
  goal: string;
  requestedBy?: string;
  workspaceRoot?: string;
  branch?: string;
  activeFile?: string;
  selectedText?: string;
  openTabs?: string[];
  requestId?: string;
  preferBackground?: boolean;
  provider?: "heuristic" | "openai" | "auto";
}

export interface PlanExecutionOutput {
  plan: Record<string, unknown>;
  riskScore: number;
  id: string;
  provider: "heuristic" | "openai";
  approvalRequired: boolean;
  approvalId?: string;
  requestId: string;
}

export async function executePlanGeneration(input: PlanExecutionInput): Promise<PlanExecutionOutput> {
  const requestId = input.requestId ?? randomUUID();
  return withSpan(
    "plan.execute",
    {
      "request.id": requestId,
      "plan.provider.requested": input.provider ?? "auto",
      "plan.background": Boolean(input.preferBackground),
    },
    async () => {
      const result = await generatePlanForGoal({
        goal: input.goal,
        workspaceRoot: input.workspaceRoot,
        branch: input.branch,
        activeFile: input.activeFile,
        selectedText: input.selectedText,
        openTabs: input.openTabs,
        requestId,
        preferBackground: input.preferBackground,
        provider: input.provider,
      });

      await saveGeneratedPlan({
        request: result.request,
        response: result.response,
      });

      const persistedId =
        (await persistStandalonePlanRequest({
          goal: input.goal,
          planPayload: result.compactPlan,
          riskScore: result.response.backendRisk.score,
          riskReasons: result.response.backendRisk.reasons.map((reason) => reason.message),
          requestedBy: input.requestedBy,
          branchName: result.request.context.branch,
        })) ?? result.response.planId;

      let approvalId: string | undefined;
      const approvalRequired = result.response.review.mode === "approval_required";
      if (approvalRequired) {
        const approval = approvalRequestSchema.parse({
          approvalId: persistedId,
          planId: result.response.planId,
          sessionId: result.request.sessionId,
          requestedBy: input.requestedBy?.trim() || "api-user",
          requestedByRole: "developer",
          risk: {
            score: result.response.backendRisk.score,
            backendScore: result.response.backendRisk.score,
            level: "high",
            reasons: result.response.backendRisk.reasons,
            review: result.response.review,
          },
          blastRadius: {
            files: result.response.changes.map((change) => change.path),
            commandCount: result.response.proposedCommands.length,
          },
          createdAt: new Date().toISOString(),
        });

        await createApprovalTicket(approval);
        approvalId = approval.approvalId;
      }

      return {
        plan: result.compactPlan,
        riskScore: result.riskScore,
        id: persistedId,
        provider: result.provider,
        approvalRequired,
        approvalId,
        requestId,
      };
    },
  );
}
