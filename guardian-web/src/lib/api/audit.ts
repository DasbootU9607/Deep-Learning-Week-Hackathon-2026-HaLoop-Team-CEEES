import { apiRequest } from "@/lib/api/http";
import { AuditFilters, AuditLog } from "@/types/audit";

export async function fetchAuditLogs(filters: AuditFilters = {}): Promise<AuditLog[]> {
  const query = new URLSearchParams();

  if (filters.repo) {
    query.set("repo", filters.repo);
  }
  if (filters.action) {
    query.set("action", filters.action);
  }
  if (filters.actor) {
    query.set("actor", filters.actor);
  }
  if (filters.risk_level) {
    query.set("risk_level", filters.risk_level);
  }
  if (filters.date_from) {
    query.set("date_from", filters.date_from);
  }
  if (filters.date_to) {
    query.set("date_to", filters.date_to);
  }

  const suffix = query.toString();
  return apiRequest<AuditLog[]>(`/api/audit${suffix ? `?${suffix}` : ""}`);
}
