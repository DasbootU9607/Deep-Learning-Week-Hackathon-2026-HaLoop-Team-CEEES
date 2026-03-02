"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, Clock, User, ShieldOff, Activity } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Topbar } from "@/components/layout/Topbar";
import { PageHero } from "@/components/layout/PageHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useIncidentMode } from "@/hooks/useIncidentMode";
import { fetchAuditLogs } from "@/lib/api/audit";
import { cn, formatDateTime, getRiskBgColor } from "@/lib/utils";

export default function IncidentPage() {
  const { isIncidentMode, activatedAt, activatedBy, reason, enableIncidentMode, disableIncidentMode, isUpdating } = useIncidentMode();
  const [newReason, setNewReason] = useState("");

  useQuery({
    queryKey: ["audit-logs-incident"],
    queryFn: () => fetchAuditLogs({ action: "incident_mode_enabled" }),
  });

  const highRiskLogs = useQuery({
    queryKey: ["audit-logs-high-risk"],
    queryFn: () => fetchAuditLogs({ risk_level: "high" }),
  });

  const handleToggle = () => {
    if (isIncidentMode) {
      disableIncidentMode();
    } else {
      enableIncidentMode("HaLoop Operator", newReason || undefined);
      setNewReason("");
    }
  };

  return (
    <>
      <Topbar title="Incident Console" description="Freeze approvals and coordinate high-risk operational response" />
      <Shell>
        <PageHero
          eyebrow="Incident Command"
          title="Operational safety lock"
          description="Enable incident mode to pause approvals while teams stabilize production risk and investigate active events."
        />

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className={cn(isIncidentMode && "border-red-500/50 bg-red-500/10")}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertOctagon className={cn("h-4 w-4", isIncidentMode ? "text-red-300" : "text-muted-foreground")} />
                Incident Mode
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {isIncidentMode ? <span className="text-red-300">ACTIVE - approvals suspended</span> : "Inactive"}
                  </p>
                  {isIncidentMode && activatedAt && (
                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        Activated {formatDateTime(activatedAt)}
                      </div>
                      {activatedBy && (
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3" />
                          By {activatedBy}
                        </div>
                      )}
                      {reason && (
                        <div className="flex items-center gap-1.5">
                          <ShieldOff className="h-3 w-3" />
                          {reason}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <Switch checked={isIncidentMode} onCheckedChange={handleToggle} className="data-[state=checked]:bg-red-600" disabled={isUpdating} />
              </div>

              {!isIncidentMode && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="reason" className="text-xs">
                      Reason (optional)
                    </Label>
                    <Input
                      id="reason"
                      placeholder="e.g. Production incident in payments-service"
                      value={newReason}
                      onChange={(e) => setNewReason(e.target.value)}
                    />
                  </div>
                  <Button variant="destructive" className="w-full" onClick={() => enableIncidentMode("HaLoop Operator", newReason || undefined)} disabled={isUpdating}>
                    <AlertOctagon className="mr-2 h-4 w-4" />
                    Enable Incident Mode
                  </Button>
                </>
              )}

              {isIncidentMode && (
                <Button variant="outline" className="w-full" onClick={() => disableIncidentMode()} disabled={isUpdating}>
                  Disable Incident Mode
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Incident Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {[
                  "All approval actions are blocked until incident mode is disabled",
                  "A high-visibility alert banner is shown across the dashboard",
                  "Activation and deactivation are written to the audit trail",
                  "Existing decision states remain unchanged",
                  "Incoming CRs can still be submitted for later review",
                  "Risk scoring and policy matching remain active",
                ].map((effect, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {effect}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent High-Risk Events</CardTitle>
          </CardHeader>
          <CardContent>
            {highRiskLogs.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (highRiskLogs.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No high-risk events recorded.</p>
            ) : (
              <div className="space-y-3">
                {highRiskLogs.data?.slice(0, 8).map((log) => (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{log.actor_name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(log.timestamp)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {log.action.replace(/_/g, " ")}
                        {log.target_cr_title && ` - ${log.target_cr_title}`}
                      </p>
                    </div>
                    {log.risk_level && (
                      <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold", getRiskBgColor(log.risk_level))}>
                        {log.risk_level}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </Shell>
    </>
  );
}
