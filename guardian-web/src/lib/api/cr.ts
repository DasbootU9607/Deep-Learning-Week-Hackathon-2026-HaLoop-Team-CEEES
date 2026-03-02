import { apiRequest } from "@/lib/api/http";
import { CR, CRFilters, CRListItem } from "@/types/cr";

export async function fetchCRList(filters: CRFilters = {}): Promise<CRListItem[]> {
  const query = new URLSearchParams();

  if (filters.repo) {
    query.set("repo", filters.repo);
  }
  if (filters.status) {
    query.set("status", filters.status);
  }
  if (filters.risk_level) {
    query.set("risk_level", filters.risk_level);
  }
  if (filters.search) {
    query.set("search", filters.search);
  }

  const suffix = query.toString();
  return apiRequest<CRListItem[]>(`/api/cr${suffix ? `?${suffix}` : ""}`);
}

export async function fetchCRDetail(id: string): Promise<CR> {
  return apiRequest<CR>(`/api/cr/${encodeURIComponent(id)}`);
}

export async function approveCR(id: string, comment?: string): Promise<CR> {
  return apiRequest<CR>(`/api/cr/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export async function rejectCR(id: string, comment?: string): Promise<CR> {
  return apiRequest<CR>(`/api/cr/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export async function requestChangesCR(id: string, comment?: string): Promise<CR> {
  return apiRequest<CR>(`/api/cr/${encodeURIComponent(id)}/request-changes`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}
