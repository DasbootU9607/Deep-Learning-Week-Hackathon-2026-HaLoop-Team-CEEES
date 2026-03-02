"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCRList } from "@/lib/api/cr";
import { CRFilters } from "@/types/cr";

export function useCRList(filters?: CRFilters) {
  return useQuery({
    queryKey: ["cr-list", filters],
    queryFn: () => fetchCRList(filters),
    staleTime: 30_000,
  });
}
