import { NextResponse } from "next/server";
import { z } from "zod";
import { mirrorApprovalDecision } from "@/lib/server/backendMirror";
import {
  applyReviewAction,
  getCRById,
  isIncidentModeApprovalError,
} from "@/lib/server/dataStore";

export const runtime = "nodejs";

const updateApprovalSchema = z.object({
  requestId: z.string().min(1),
  newStatus: z.enum(["APPROVED", "REJECTED"]),
  reviewer: z.string().trim().min(1).optional(),
  reason: z.string().trim().min(1).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = updateApprovalSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { requestId, newStatus } = parsed.data;
    const reviewer = parsed.data.reviewer || "API Reviewer";
    const reason = parsed.data.reason;
    const action = newStatus === "APPROVED" ? "approved" : "rejected";

    const existingCR = await getCRById(requestId);
    if (existingCR) {
      const updated = await applyReviewAction({
        crId: requestId,
        action,
        reviewer,
        comment: reason,
      });

      if (!updated) {
        return NextResponse.json({ error: "Approval request not found" }, { status: 404 });
      }
    }

    const mirrored = await mirrorApprovalDecision({
      approvalId: requestId,
      decision: newStatus === "APPROVED" ? "approved" : "denied",
      reviewer,
      reason,
    });

    if (!existingCR && !mirrored) {
      return NextResponse.json({ error: "Approval request not found" }, { status: 404 });
    }

    return NextResponse.json({
      requestId,
      status: newStatus,
    });
  } catch (error) {
    if (isIncidentModeApprovalError(error)) {
      return NextResponse.json({ error: toErrorMessage(error) }, { status: 409 });
    }
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
