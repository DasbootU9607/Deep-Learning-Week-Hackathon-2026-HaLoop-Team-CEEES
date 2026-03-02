import { NextResponse } from "next/server";
import { listAuditLogs } from "@/lib/server/dataStore";
import { AuditFilters } from "@/types/audit";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);

  const filters: AuditFilters = {
    repo: optional(searchParams.get("repo")),
    action: optional(searchParams.get("action")) as AuditFilters["action"],
    actor: optional(searchParams.get("actor")),
    risk_level: optional(searchParams.get("risk_level")) as AuditFilters["risk_level"],
    date_from: optional(searchParams.get("date_from")),
    date_to: optional(searchParams.get("date_to")),
  };

  const logs = await listAuditLogs(filters);
  return NextResponse.json(logs);
}

function optional(value: string | null): string | undefined {
  if (!value || value === "all") {
    return undefined;
  }
  return value;
}
