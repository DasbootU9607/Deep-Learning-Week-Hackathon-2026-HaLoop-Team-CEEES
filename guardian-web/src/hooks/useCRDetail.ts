"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCRDetail } from "@/lib/api/cr";

export function useCRDetail(id: string) {
  return useQuery({
    queryKey: ["cr-detail", id],
    queryFn: () => fetchCRDetail(id),
    staleTime: 30_000,
    enabled: !!id,
  });
}
