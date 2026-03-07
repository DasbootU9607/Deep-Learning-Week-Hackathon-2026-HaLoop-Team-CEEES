import { apiRequest } from "@/lib/api/http";
import type { RuntimeModeSummary } from "@/lib/server/backendMode";

export async function fetchRuntimeModeSummary(): Promise<RuntimeModeSummary> {
  return apiRequest<RuntimeModeSummary>("/api/runtime");
}
