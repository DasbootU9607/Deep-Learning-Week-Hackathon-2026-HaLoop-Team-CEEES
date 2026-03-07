import { NextResponse } from "next/server";
import { mirrorApprovalDecision } from "@/lib/server/backendMirror";
import { requirePermission, AuthError } from "@/lib/server/auth";
import { applyReviewAction, getActivePolicy, isIncidentModeApprovalError } from "@/lib/server/dataStore";
import { crReviewActionBodySchema } from "@/lib/server/contracts";

export const runtime = "nodejs";

interface Params {
  params: { id: string };
}

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const policy = await getActivePolicy();
    const actor = requirePermission(request, policy, "reject");
    const body = crReviewActionBodySchema.parse(await readJson(request));
    const updated = await applyReviewAction({
      crId: params.id,
      action: "rejected",
      actor,
      comment: body.comment,
    });

    if (!updated) {
      return NextResponse.json({ error: "CR not found" }, { status: 404 });
    }

    try {
      await mirrorApprovalDecision({
        approvalId: params.id,
        decision: "denied",
        reviewer: actor.name,
        reason: body.comment,
      });
    } catch (mirrorError) {
      console.warn("SQLite approval decision mirror skipped:", toErrorMessage(mirrorError));
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: toErrorMessage(error) }, { status: error.status });
    }
    if (isIncidentModeApprovalError(error)) {
      return NextResponse.json({ error: toErrorMessage(error) }, { status: 409 });
    }
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 400 });
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
