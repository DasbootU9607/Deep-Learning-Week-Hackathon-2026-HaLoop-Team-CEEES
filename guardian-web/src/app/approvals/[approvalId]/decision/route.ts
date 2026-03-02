import { NextResponse } from "next/server";
import { getApprovalDecision } from "@/lib/server/dataStore";

export const runtime = "nodejs";

interface Params {
  params: { approvalId: string };
}

export async function GET(_request: Request, { params }: Params): Promise<NextResponse> {
  const decision = await getApprovalDecision(params.approvalId);

  if (!decision) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json(decision);
}
