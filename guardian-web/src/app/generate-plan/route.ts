import { NextResponse } from "next/server";
import { generatePlanRequestSchema, generatePlanResponseSchema } from "@/lib/server/contracts";
import { getActivePolicy, saveGeneratedPlan } from "@/lib/server/dataStore";
import { generatePlanFromPrompt } from "@/lib/server/planningEngine";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = generatePlanRequestSchema.parse(await request.json());
    const policy = await getActivePolicy();
    const generated = generatePlanFromPrompt(payload, policy);
    const response = generatePlanResponseSchema.parse(generated);

    await saveGeneratedPlan({
      request: payload,
      response,
    });

    return NextResponse.json(response);
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
