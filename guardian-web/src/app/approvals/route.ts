import { NextResponse } from "next/server";
import { approvalRequestSchema } from "@/lib/server/contracts";
import { mirrorPluginApprovalRequest } from "@/lib/server/backendMirror";
import { createApprovalTicket, getStoredPlan } from "@/lib/server/dataStore";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = approvalRequestSchema.parse(await request.json());
    const stored = await createApprovalTicket(payload);

    try {
      const snapshot = await getStoredPlan(payload.planId);
      await mirrorPluginApprovalRequest({
        request: payload,
        branchName: snapshot?.request.context.branch,
        summary: snapshot?.response.summary,
        planPayload: snapshot?.response,
      });
    } catch (mirrorError) {
      console.warn("SQLite approval mirror skipped:", toErrorMessage(mirrorError));
    }

    return NextResponse.json(stored);
  } catch (error) {
    return NextResponse.json(
      {
        error: toErrorMessage(error),
      },
      { status: 400 },
    );
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
