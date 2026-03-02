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
    onError: () => toast.error("Failed to approve CR"),
  });

  const reject = useMutation({
    mutationFn: (comment?: string) => rejectCR(crId, comment),
    onSuccess: () => {
      toast.success("CR rejected");
      invalidate();
    },
    onError: () => toast.error("Failed to reject CR"),
  });

  const requestChanges = useMutation({
    mutationFn: (comment?: string) => requestChangesCR(crId, comment),
    onSuccess: () => {
      toast.success("Changes requested");
      invalidate();
    },
    onError: () => toast.error("Failed to request changes"),
  });

  return { approve, reject, requestChanges };
}
