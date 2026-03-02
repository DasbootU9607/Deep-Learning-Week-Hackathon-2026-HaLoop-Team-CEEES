"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Shell } from "@/components/layout/Shell";
import { Topbar } from "@/components/layout/Topbar";
import { PageHero } from "@/components/layout/PageHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CRStatusBadge } from "@/components/cr/CRStatusBadge";
import { fetchCRList } from "@/lib/api/cr";
import { useIncidentMode } from "@/hooks/useIncidentMode";
import { cn, formatRelativeTime, getRiskBgColor } from "@/lib/utils";
import { GitPullRequest, ShieldAlert, CheckCircle, AlertOctagon, ArrowRight, Sparkles } from "lucide-react";

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
    <Card className={cn("transition-all duration-300 hover:-translate-y-1", className)}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-3xl font-semibold text-foreground">{value}</p>
            {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className="glass-muted flex h-10 w-10 items-center justify-center rounded-xl">
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
  const appliedToday =
    allCRs?.filter((cr) => {
      const updated = new Date(cr.updated_at);
      const today = new Date();
      return cr.status === "applied" && updated.toDateString() === today.toDateString();
    }) ?? [];

  const recentCRs = [...(allCRs ?? [])]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6);

  const heatmapData =
    allCRs?.reduce<Record<string, Record<string, number>>>((acc, cr) => {
      if (!acc[cr.repo]) acc[cr.repo] = { low: 0, med: 0, high: 0 };
      acc[cr.repo][cr.risk_level]++;
      return acc;
    }, {}) ?? {};

  return (
    <>
      <Topbar title="Dashboard" description="Live posture for HaLoop governance operations" />
      <Shell>
        <PageHero
          eyebrow="HaLoop Control"
          title="Decision-grade change governance"
          description="Monitor approvals, identify risk concentration, and push reviewers to high-impact requests with a clear operational narrative."
          rightSlot={
            <div className="glass-muted flex items-center gap-2 rounded-2xl px-3 py-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Last sync: live
            </div>
          }
        />

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
          ) : (
            <>
              <StatCard
                title="Pending Approval"
                value={pendingCRs.length}
                icon={GitPullRequest}
                description="Requests waiting for reviewer action"
                className={pendingCRs.length > 0 ? "border-yellow-400/25" : ""}
              />
              <StatCard
                title="High Risk"
                value={highRiskCRs.length}
                icon={ShieldAlert}
                description="Risk score >= 70"
                className={highRiskCRs.length > 0 ? "border-red-400/25" : ""}
              />
              <StatCard title="Applied Today" value={appliedToday.length} icon={CheckCircle} description="Merged without rollback" />
              <StatCard
                title="Incident Mode"
                value={isIncidentMode ? "ACTIVE" : "NORMAL"}
                icon={AlertOctagon}
                description={isIncidentMode ? "Approval actions paused" : "All systems normal"}
                className={isIncidentMode ? "border-red-500/45 bg-red-500/10" : ""}
              />
            </>
          )}
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Recent Change Requests</CardTitle>
                <Link href="/cr" className="flex items-center gap-1 text-xs text-primary transition-opacity hover:opacity-80">
                  View all
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-xl" />
                  ))}
                </div>
              ) : recentCRs.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No change requests yet.</div>
              ) : (
                <div className="divide-y divide-white/10">
                  {recentCRs.map((cr) => (
                    <Link
                      key={cr.id}
                      href={`/cr/${cr.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/5"
                    >
                      <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold", getRiskBgColor(cr.risk_level))}>
                        {cr.risk_score}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{cr.title}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">{cr.repo}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <CRStatusBadge status={cr.status} />
                        <span className="hidden text-xs text-muted-foreground sm:block">{formatRelativeTime(cr.updated_at)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Risk Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 rounded-xl" />
                  ))}
                </div>
              ) : Object.keys(heatmapData).length === 0 ? (
                <p className="text-sm text-muted-foreground">No data available.</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(heatmapData).map(([repo, counts]) => (
                    <div key={repo} className="space-y-2">
                      <p className="truncate font-mono text-xs text-muted-foreground">{repo}</p>
                      <div className="flex h-8 gap-1">
                        {counts.high > 0 && (
                          <div className="flex items-center justify-center rounded bg-red-500/75 text-[10px] font-bold text-white" style={{ flex: counts.high }}>
                            {counts.high}H
                          </div>
                        )}
                        {counts.med > 0 && (
                          <div className="flex items-center justify-center rounded bg-yellow-500/75 text-[10px] font-bold text-white" style={{ flex: counts.med }}>
                            {counts.med}M
                          </div>
                        )}
                        {counts.low > 0 && (
                          <div className="flex items-center justify-center rounded bg-green-500/75 text-[10px] font-bold text-white" style={{ flex: counts.low }}>
                            {counts.low}L
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </Shell>
    </>
  );
}
