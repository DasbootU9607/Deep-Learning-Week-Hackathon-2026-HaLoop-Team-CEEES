import { NextResponse } from "next/server";
import { approvalRequestSchema } from "@/lib/server/contracts";
import { createApprovalTicket } from "@/lib/server/dataStore";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = approvalRequestSchema.parse(await request.json());
    const stored = await createApprovalTicket(payload);
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
