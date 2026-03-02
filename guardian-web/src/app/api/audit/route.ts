import { NextResponse } from "next/server";
import { listCompactAuditEvents } from "@/lib/server/backendMirror";
import { listAuditLogs } from "@/lib/server/dataStore";
import { AuditFilters } from "@/types/audit";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const compactMode =
    optional(searchParams.get("view")) === "compact" ||
    optional(searchParams.get("format")) === "backend";

  if (compactMode) {
    try {
      const compact = await listCompactAuditEvents(50);
      if (compact) {
        return NextResponse.json(compact);
      }
    } catch (error) {
      return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
    }

    const fallbackLogs = await listAuditLogs();
    const compactFallback = fallbackLogs.slice(0, 50).map((log) => ({
      created_at: log.timestamp,
      event_type: log.action.toUpperCase(),
      event_payload: {
        actor: log.actor_name,
        risk_level: log.risk_level ?? null,
        ...(log.details ?? {}),
      },
    }));
    return NextResponse.json(compactFallback);
  }

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

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
