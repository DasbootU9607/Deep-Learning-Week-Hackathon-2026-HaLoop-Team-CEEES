"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchActivePolicy, updatePathRules } from "@/lib/api/policy";
import { PathRule, RiskThreshold } from "@/types/policy";
import { toast } from "sonner";

export function usePolicies() {
  return useQuery({
    queryKey: ["policy-active"],
    queryFn: fetchActivePolicy,
    staleTime: 60_000,
  });
}

export function useUpdatePathRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { rules: PathRule[]; riskThresholds: RiskThreshold }) =>
      updatePathRules(input.rules, input.riskThresholds),
    onSuccess: () => {
      toast.success("Policy updated");
      queryClient.invalidateQueries({ queryKey: ["policy-active"] });
    },
    onError: () => toast.error("Failed to update policy"),
  });
}
