import { NextResponse } from "next/server";
import { AuthError, requirePermission } from "@/lib/server/auth";
import { getActivePolicy, updatePathRules } from "@/lib/server/dataStore";
import { updatePathRulesBodySchema } from "@/lib/server/contracts";

export const runtime = "nodejs";

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const policy = await getActivePolicy();
    const actor = requirePermission(request, policy, "configure_policy");
    const body = updatePathRulesBodySchema.parse(await request.json());
    const nextPolicy = await updatePathRules(body.rules, body.riskThresholds, actor);
    return NextResponse.json(nextPolicy);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: toErrorMessage(error) }, { status: error.status });
    }
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 400 });
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
