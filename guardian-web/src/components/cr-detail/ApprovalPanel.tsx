"use client";

import { useState } from "react";
import { CR } from "@/types/cr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useApproval } from "@/hooks/useApproval";
import { useIncidentMode } from "@/hooks/useIncidentMode";
import { usePolicies } from "@/hooks/usePolicies";
import { formatDateTime } from "@/lib/utils";
import { CheckCircle, XCircle, MessageSquare, Users, Lock, AlertTriangle, Clock } from "lucide-react";
import { useDemoActor } from "@/lib/demoActorClient";

interface ApprovalPanelProps {
  cr: CR;
}

export function ApprovalPanel({ cr }: ApprovalPanelProps) {
  const [comment, setComment] = useState("");
  const { approve, reject, requestChanges } = useApproval(cr.id);
  const { isIncidentMode } = useIncidentMode();
  const { data: policy } = usePolicies();
  const { actor } = useDemoActor();

  const needsDualApproval = cr.required_approvals > 1;
  const canAct = cr.status === "pending_approval" || cr.status === "changes_requested";
  const permissions = policy?.role_permissions.find((permission) => permission.role === actor.role);
  const canApprove = permissions?.can_approve ?? false;
  const canReject = permissions?.can_reject ?? false;

  const disabledReason = isIncidentMode
    ? "Approvals are suspended during Incident Mode"
    : !canApprove
    ? `Role ${actor.role} cannot approve`
    : !canAct
    ? "This CR is not in a state that accepts approvals"
    : null;

  const rejectDisabledReason = isIncidentMode
    ? "Approvals are suspended during Incident Mode"
    : !canReject
    ? `Role ${actor.role} cannot reject or request changes`
    : !canAct
    ? "This CR is not in a state that accepts approvals"
    : null;

  const approveDisabled = !!disabledReason || approve.isPending;
  const actDisabled = !!rejectDisabledReason || reject.isPending || requestChanges.isPending;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Approval
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing approvals */}
        {cr.approvals.length > 0 && (
          <div className="space-y-2">
            {cr.approvals.map((approval) => (
              <div key={approval.id} className="flex items-start gap-3 rounded-md bg-secondary/30 p-3">
                <div className="mt-0.5">
                  {approval.action === "approved" && <CheckCircle className="h-4 w-4 text-green-400" />}
                  {approval.action === "rejected" && <XCircle className="h-4 w-4 text-red-400" />}
                  {approval.action === "changes_requested" && <MessageSquare className="h-4 w-4 text-yellow-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{approval.reviewer_name}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(approval.created_at)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {approval.action === "approved" && <span className="text-green-400">Approved</span>}
                    {approval.action === "rejected" && <span className="text-red-400">Rejected</span>}
                    {approval.action === "changes_requested" && <span className="text-yellow-400">Requested changes</span>}
                  </div>
                  {approval.comment && (
                    <p className="text-xs text-muted-foreground mt-1 italic">&quot;{approval.comment}&quot;</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dual approval notice */}
        {needsDualApproval && (
          <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-medium">Dual approval required</span> — High-risk CRs require {cr.required_approvals} reviewers.
              Currently {cr.approvals.filter((a) => a.action === "approved").length}/{cr.required_approvals} approved.
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/20 p-3 text-xs text-muted-foreground">
          <Users className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            Acting as <span className="font-medium text-foreground">{actor.name}</span> ({actor.role}).
            {canApprove ? " This role can approve." : " This role cannot approve."}
            {canReject ? " It can reject or request changes." : " It cannot reject or request changes."}
          </div>
        </div>

        {/* Incident mode notice */}
        {isIncidentMode && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-400">
            <Lock className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-medium">Incident Mode Active</span> — All approvals are suspended.
            </div>
          </div>
        )}

        {/* Comment box */}
        {canAct && !isIncidentMode && (
          <div className="space-y-3">
            <Textarea
              placeholder="Add a comment (optional)..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="resize-none"
            />

            <div className="flex flex-wrap gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="default"
                      size="sm"
                      disabled={approveDisabled}
                      onClick={() => approve.mutate(comment || undefined)}
                      className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                  </span>
                </TooltipTrigger>
                {disabledReason && (
                  <TooltipContent>{disabledReason}</TooltipContent>
                )}
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actDisabled}
                      onClick={() => requestChanges.mutate(comment || undefined)}
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Request Changes
                    </Button>
                  </span>
                </TooltipTrigger>
                {rejectDisabledReason && (
                  <TooltipContent>{rejectDisabledReason}</TooltipContent>
                )}
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actDisabled}
                      onClick={() => reject.mutate(comment || undefined)}
                      className="text-destructive hover:text-destructive border-destructive/50 hover:bg-destructive/10"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </span>
                </TooltipTrigger>
                {rejectDisabledReason && (
                  <TooltipContent>{rejectDisabledReason}</TooltipContent>
                )}
              </Tooltip>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
