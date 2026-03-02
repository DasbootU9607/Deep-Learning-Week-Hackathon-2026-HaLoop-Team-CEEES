import { apiRequest } from "@/lib/api/http";

export interface IncidentModeState {
  isIncidentMode: boolean;
  activatedAt?: string;
  activatedBy?: string;
  reason?: string;
}

export async function fetchIncidentMode(): Promise<IncidentModeState> {
  return apiRequest<IncidentModeState>("/api/incident");
}

export async function updateIncidentMode(params: {
  enabled: boolean;
  by?: string;
  reason?: string;
}): Promise<IncidentModeState> {
  return apiRequest<IncidentModeState>("/api/incident", {
    method: "PUT",
    body: JSON.stringify(params),
  });
}
