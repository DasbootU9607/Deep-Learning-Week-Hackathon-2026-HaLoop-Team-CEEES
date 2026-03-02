import { NextResponse } from "next/server";
import { z } from "zod";
import { generatePlanForGoal } from "@/lib/server/backendPlan";
import { persistStandalonePlanRequest } from "@/lib/server/backendMirror";
import { approvalRequestSchema } from "@/lib/server/contracts";
import { createApprovalTicket, saveGeneratedPlan } from "@/lib/server/dataStore";

export const runtime = "nodejs";

const planRequestSchema = z.object({
  goal: z.string().trim().min(1),
  requestedBy: z.string().trim().min(1).optional(),
  workspaceRoot: z.string().trim().min(1).optional(),
  branch: z.string().trim().min(1).optional(),
  activeFile: z.string().trim().min(1).optional(),
  selectedText: z.string().optional(),
  openTabs: z.array(z.string()).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = planRequestSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const input = parsed.data;
    const result = await generatePlanForGoal({
      goal: input.goal,
      workspaceRoot: input.workspaceRoot,
      branch: input.branch,
      activeFile: input.activeFile,
      selectedText: input.selectedText,
      openTabs: input.openTabs,
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
        riskReasons: result.response.backendRisk.reasons,
        requestedBy: input.requestedBy,
        branchName: result.request.context.branch,
      })) ?? result.response.planId;

    if (result.response.backendRisk.score >= 70) {
      const approval = approvalRequestSchema.parse({
        approvalId: persistedId,
        planId: result.response.planId,
        sessionId: result.request.sessionId,
        requestedBy: input.requestedBy?.trim() || "api-user",
        risk: {
          score: result.response.backendRisk.score,
          level: "high",
          reasons: result.response.backendRisk.reasons,
        },
        blastRadius: {
          files: result.response.changes.map((change) => change.path),
          commandCount: result.response.proposedCommands.length,
        },
        createdAt: new Date().toISOString(),
      });

      await createApprovalTicket(approval);
    }

    return NextResponse.json({
      plan: result.compactPlan,
      riskScore: result.riskScore,
      id: persistedId,
    });
  } catch (error) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
