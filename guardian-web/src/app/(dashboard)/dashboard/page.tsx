"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Shell } from "@/components/layout/Shell";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CRStatusBadge } from "@/components/cr/CRStatusBadge";
import { fetchCRList } from "@/lib/api/cr";
import { useIncidentMode } from "@/hooks/useIncidentMode";
import { cn, formatRelativeTime, getRiskBgColor } from "@/lib/utils";
import {
  GitPullRequest,
  ShieldAlert,
  CheckCircle,
  AlertOctagon,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  className,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: allCRs, isLoading } = useQuery({
    queryKey: ["cr-list"],
    queryFn: () => fetchCRList(),
    staleTime: 30_000,
    refetchInterval: 2_000,
  });
  const { isIncidentMode } = useIncidentMode();

  const pendingCRs = allCRs?.filter((cr) => cr.status === "pending_approval") ?? [];
  const highRiskCRs = allCRs?.filter((cr) => cr.risk_level === "high") ?? [];
  const appliedToday = allCRs?.filter((cr) => {
    const updated = new Date(cr.updated_at);
    const today = new Date();
    return cr.status === "applied" && updated.toDateString() === today.toDateString();
  }) ?? [];
  const recentCRs = [...(allCRs ?? [])].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  ).slice(0, 5);

  // Risk heatmap: count by repo and risk level
  const heatmapData = allCRs?.reduce<Record<string, Record<string, number>>>((acc, cr) => {
    if (!acc[cr.repo]) acc[cr.repo] = { low: 0, med: 0, high: 0 };
    acc[cr.repo][cr.risk_level]++;
    return acc;
  }, {}) ?? {};

  return (
    <>
      <Topbar
        title="Dashboard"
        description="Overview of change requests and system health"
      />
      <Shell>
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
          ) : (
            <>
              <StatCard
                title="Pending Approval"
                value={pendingCRs.length}
                icon={GitPullRequest}
                description="Awaiting reviewer action"
                className={pendingCRs.length > 0 ? "border-yellow-500/30" : ""}
              />
              <StatCard
                title="High Risk CRs"
                value={highRiskCRs.length}
                icon={ShieldAlert}
                description="Risk score ≥ 70"
                className={highRiskCRs.length > 0 ? "border-red-500/30" : ""}
              />
              <StatCard
                title="Applied Today"
                value={appliedToday.length}
                icon={CheckCircle}
                description="Successfully merged"
              />
              <StatCard
                title="Incident Mode"
                value={isIncidentMode ? "ACTIVE" : "Normal"}
                icon={AlertOctagon}
                description={isIncidentMode ? "Approvals suspended" : "System operating normally"}
                className={isIncidentMode ? "border-red-500/50 bg-red-950/20" : ""}
              />
            </>
          )}
        </div>

        {/* Recent CRs + Risk Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent CRs */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Recent Change Requests
                  </CardTitle>
                  <Link href="/cr" className="flex items-center gap-1 text-xs text-primary hover:underline">
                    View all <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
                  </div>
                ) : recentCRs.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No change requests yet.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {recentCRs.map((cr) => (
                      <Link
                        key={cr.id}
                        href={`/cr/${cr.id}`}
                        className="flex items-center gap-3 px-6 py-3 hover:bg-secondary/20 transition-colors"
                      >
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold",
                            getRiskBgColor(cr.risk_level)
                          )}
                        >
                          {cr.risk_score}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{cr.title}</p>
                          <p className="text-xs text-muted-foreground font-mono">{cr.repo}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <CRStatusBadge status={cr.status} />
                          <span className="text-xs text-muted-foreground hidden sm:block">
                            {formatRelativeTime(cr.updated_at)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Risk Heatmap */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Risk Heatmap</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
                </div>
              ) : Object.keys(heatmapData).length === 0 ? (
                <p className="text-sm text-muted-foreground">No data available.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(heatmapData).map(([repo, counts]) => (
                    <div key={repo}>
                      <p className="text-xs font-mono text-muted-foreground mb-1.5 truncate">{repo}</p>
                      <div className="flex gap-1 h-8">
                        {counts.high > 0 && (
                          <div
                            className="rounded bg-red-500/70 flex items-center justify-center text-[10px] text-white font-bold transition-all"
                            style={{ flex: counts.high }}
                          >
                            {counts.high}H
                          </div>
                        )}
                        {counts.med > 0 && (
                          <div
                            className="rounded bg-yellow-500/70 flex items-center justify-center text-[10px] text-white font-bold"
                            style={{ flex: counts.med }}
                          >
                            {counts.med}M
                          </div>
                        )}
                        {counts.low > 0 && (
                          <div
                            className="rounded bg-green-500/70 flex items-center justify-center text-[10px] text-white font-bold"
                            style={{ flex: counts.low }}
                          >
                            {counts.low}L
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-red-500/70" />High</div>
                    <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-yellow-500/70" />Med</div>
                    <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-green-500/70" />Low</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Shell>
    </>
  );
}
