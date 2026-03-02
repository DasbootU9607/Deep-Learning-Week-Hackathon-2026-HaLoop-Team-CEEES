import { NextResponse } from "next/server";
import { getIncidentModeState, setIncidentModeState } from "@/lib/server/dataStore";
import { setIncidentModeBodySchema } from "@/lib/server/contracts";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const state = await getIncidentModeState();
  return NextResponse.json(state);
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const body = setIncidentModeBodySchema.parse(await request.json());
    const next = await setIncidentModeState({
      enabled: body.enabled,
      by: body.by,
      reason: body.reason,
    });
    return NextResponse.json(next);
  } catch (error) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 400 });
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
