import { NextResponse } from "next/server";
import { updatePathRules } from "@/lib/server/dataStore";
import { updatePathRulesBodySchema } from "@/lib/server/contracts";

export const runtime = "nodejs";

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const body = updatePathRulesBodySchema.parse(await request.json());
    const policy = await updatePathRules(body.rules);
    return NextResponse.json(policy);
  } catch (error) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 400 });
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
