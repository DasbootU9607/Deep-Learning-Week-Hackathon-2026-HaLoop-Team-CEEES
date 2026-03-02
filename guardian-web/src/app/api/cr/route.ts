import { NextResponse } from "next/server";
import { listCRs } from "@/lib/server/dataStore";
import { CRFilters } from "@/types/cr";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const filters: CRFilters = {
    repo: optional(searchParams.get("repo")),
    status: optional(searchParams.get("status")) as CRFilters["status"],
    risk_level: optional(searchParams.get("risk_level")) as CRFilters["risk_level"],
    search: optional(searchParams.get("search")),
  };

  const items = await listCRs(filters);
  return NextResponse.json(items);
}

function optional(value: string | null): string | undefined {
  if (!value || value === "all") {
    return undefined;
  }
  return value;
}
