import { NextResponse } from "next/server";
import { getActivePolicy } from "@/lib/server/dataStore";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const policy = await getActivePolicy();
  return NextResponse.json(policy);
}
