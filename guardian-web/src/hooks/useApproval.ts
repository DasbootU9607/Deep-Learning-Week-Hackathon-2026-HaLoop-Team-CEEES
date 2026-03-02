"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { approveCR, rejectCR, requestChangesCR } from "@/lib/api/cr";
import { toast } from "sonner";

export function useApproval(crId: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cr-detail", crId] });
    queryClient.invalidateQueries({ queryKey: ["cr-list"] });
  };

  const approve = useMutation({
    mutationFn: (comment?: string) => approveCR(crId, comment),
    onSuccess: () => {
      toast.success("CR approved successfully");
      invalidate();
    },
    onError: (error) => toast.error(toErrorMessage(error, "Failed to approve CR")),
  });

  const reject = useMutation({
    mutationFn: (comment?: string) => rejectCR(crId, comment),
    onSuccess: () => {
      toast.success("CR rejected");
      invalidate();
    },
    onError: (error) => toast.error(toErrorMessage(error, "Failed to reject CR")),
  });

  const requestChanges = useMutation({
    mutationFn: (comment?: string) => requestChangesCR(crId, comment),
    onSuccess: () => {
      toast.success("Changes requested");
      invalidate();
    },
    onError: (error) => toast.error(toErrorMessage(error, "Failed to request changes")),
  });

  return { approve, reject, requestChanges };
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const match = error.message.match(/-\\s*(\\{.*\\})$/);
  if (match?.[1]) {
    try {
      const parsed = JSON.parse(match[1]) as { error?: string };
      if (parsed.error) {
        return parsed.error;
      }
    } catch {
      // Fall through to default handling.
    }
  }

  return error.message || fallback;
}
