import { NextResponse } from "next/server";
import { generatePlanRequestSchema, generatePlanResponseSchema } from "@/lib/server/contracts";
import { getActivePolicy, saveGeneratedPlan } from "@/lib/server/dataStore";
import { generatePlanFromPrompt } from "@/lib/server/planningEngine";
import { generatePlanWithReliability, isOpenAIPlannerEnabled } from "@/lib/server/openaiReliability";
import { REQUEST_ID_HEADER, resolveRequestId } from "@/lib/server/requestId";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = resolveRequestId(request);
  try {
    const payload = generatePlanRequestSchema.parse(await request.json());
    const policy = await getActivePolicy();
    const generated = await generatePluginPlan({
      payload,
      policy,
      requestId,
    });
    const response = generatePlanResponseSchema.parse(generated);

    await saveGeneratedPlan({
      request: payload,
      response,
    });

    const nextResponse = NextResponse.json(response);
    nextResponse.headers.set(REQUEST_ID_HEADER, requestId);
    return nextResponse;
  } catch (error) {
    const response = NextResponse.json(
      {
        error: toErrorMessage(error),
      },
      { status: 400 },
    );
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}

async function generatePluginPlan(params: {
  payload: Parameters<typeof generatePlanFromPrompt>[0];
  policy: Parameters<typeof generatePlanFromPrompt>[1];
  requestId: string;
}) {
  const configured = String(process.env.PLANNER_PROVIDER ?? "auto").toLowerCase();
  const shouldUseOpenAI = configured === "openai" || (configured === "auto" && isOpenAIPlannerEnabled());

  if (shouldUseOpenAI) {
    try {
      return await generatePlanWithReliability({
        request: params.payload,
        policy: params.policy,
        requestId: params.requestId,
        preferBackground: false,
      });
    } catch (error) {
      if (String(process.env.OPENAI_FALLBACK_TO_HEURISTIC ?? "true").toLowerCase() !== "true") {
        throw error;
      }
    }
  }

  return generatePlanFromPrompt(params.payload, params.policy);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
