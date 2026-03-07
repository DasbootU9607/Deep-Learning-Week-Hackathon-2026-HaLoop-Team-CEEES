import { NextResponse } from "next/server";
import { getRuntimeModeSummary } from "@/lib/server/backendMode";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(getRuntimeModeSummary());
}
