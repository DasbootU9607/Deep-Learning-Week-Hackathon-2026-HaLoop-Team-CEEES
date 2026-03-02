"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchIncidentMode, updateIncidentMode } from "@/lib/api/incident";
import { toast } from "sonner";

const INCIDENT_QUERY_KEY = ["incident-mode"] as const;

export function useIncidentMode() {
  const queryClient = useQueryClient();

  const incidentQuery = useQuery({
    queryKey: INCIDENT_QUERY_KEY,
    queryFn: fetchIncidentMode,
    staleTime: 5_000,
    refetchInterval: 2_000,
  });

  const updateMutation = useMutation({
    mutationFn: updateIncidentMode,
    onSuccess: (next) => {
      queryClient.setQueryData(INCIDENT_QUERY_KEY, next);
      queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEY });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to update incident mode: ${message}`);
    },
  });

  const state = incidentQuery.data;

  return {
    isIncidentMode: state?.isIncidentMode ?? false,
    activatedAt: state?.activatedAt,
    activatedBy: state?.activatedBy,
    reason: state?.reason,
    isLoading: incidentQuery.isLoading,
    isUpdating: updateMutation.isPending,
    enableIncidentMode: (by: string, reason?: string) => {
      updateMutation.mutate({ enabled: true, by, reason });
    },
    disableIncidentMode: (by = "Incident Commander") => {
      updateMutation.mutate({ enabled: false, by });
    },
  };
}
