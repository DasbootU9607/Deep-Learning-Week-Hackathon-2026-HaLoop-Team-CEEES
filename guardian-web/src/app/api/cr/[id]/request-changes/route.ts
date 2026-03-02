import { NextResponse } from "next/server";
import { applyReviewAction, isIncidentModeApprovalError } from "@/lib/server/dataStore";
import { crReviewActionBodySchema } from "@/lib/server/contracts";

export const runtime = "nodejs";

interface Params {
  params: { id: string };
}

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const body = crReviewActionBodySchema.parse(await readJson(request));
    const updated = await applyReviewAction({
      crId: params.id,
      action: "changes_requested",
      reviewer: body.reviewer,
      comment: body.comment,
    });

    if (!updated) {
      return NextResponse.json({ error: "CR not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
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
