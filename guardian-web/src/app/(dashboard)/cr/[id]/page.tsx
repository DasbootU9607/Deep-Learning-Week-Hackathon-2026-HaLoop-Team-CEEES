"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, GitBranch, User, Clock } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CRStatusBadge } from "@/components/cr/CRStatusBadge";
import { RiskScoreCard } from "@/components/cr-detail/RiskScoreCard";
import { PlanViewer } from "@/components/cr-detail/PlanViewer";
import { PatchSummaryTable } from "@/components/cr-detail/PatchSummaryTable";
import { ApprovalPanel } from "@/components/cr-detail/ApprovalPanel";
import { EvidencePanel } from "@/components/cr-detail/EvidencePanel";
import { BlastRadiusFlow } from "@/components/graph/BlastRadiusFlow";
import { useCRDetail } from "@/hooks/useCRDetail";
import { formatRelativeTime } from "@/lib/utils";

interface CRDetailPageProps {
  params: { id: string };
}

function CRDetailSkeleton() {
  return (
    <Shell>
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </Shell>
  );
}

export default function CRDetailPage({ params }: CRDetailPageProps) {
  const { data: cr, isLoading, isError } = useCRDetail(params.id);

  if (isLoading) return <CRDetailSkeleton />;

  if (isError || !cr) {
    return (
      <Shell>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Change request not found.</p>
          <Link href="/cr" className="text-primary hover:underline text-sm mt-2 inline-block">
            ← Back to CR list
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <>
      <Topbar
        title={cr.title}
        description={`${cr.repo} · ${cr.branch}`}
      >
        <Link href="/cr">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        {cr.pr_url && (
          <Button variant="outline" size="sm" asChild>
            <a href={cr.pr_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              PR
            </a>
          </Button>
        )}
      </Topbar>

      <Shell>
        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <CRStatusBadge status={cr.status} />
          <div className="flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            <span className="font-mono">{cr.branch}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            {cr.created_by_name}
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {formatRelativeTime(cr.created_at)}
          </div>
          {cr.labels?.map((label) => (
            <span key={label} className="rounded bg-secondary px-2 py-0.5 text-xs">{label}</span>
          ))}
        </div>

        {cr.description && (
          <p className="text-sm text-muted-foreground">{cr.description}</p>
        )}

        {/* Risk + Approval side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RiskScoreCard
            score={cr.risk_score}
            level={cr.risk_level}
            requiredApprovals={cr.required_approvals}
            approvalsCount={cr.approvals.filter((approval) => approval.action === "approved").length}
            review={cr.review}
            riskBreakdown={cr.risk_breakdown}
          />
          <ApprovalPanel cr={cr} />
        </div>

        {/* Tabs for detail sections */}
        <Tabs defaultValue="plan">
          <TabsList>
            <TabsTrigger value="plan">Change Plan</TabsTrigger>
            <TabsTrigger value="patch">Patch Summary</TabsTrigger>
            <TabsTrigger value="blast">Blast Radius</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
          </TabsList>

          <TabsContent value="plan" className="mt-4">
            <PlanViewer plan={cr.plan} review={cr.review} commands={cr.proposed_commands} riskReasons={cr.risk_reasons} />
          </TabsContent>

          <TabsContent value="patch" className="mt-4">
            <PatchSummaryTable files={cr.patch_summary} />
          </TabsContent>

          <TabsContent value="blast" className="mt-4">
            <BlastRadiusFlow blastRadius={cr.blast_radius} />
          </TabsContent>

          <TabsContent value="evidence" className="mt-4">
            <EvidencePanel evidence={cr.evidence} />
          </TabsContent>
        </Tabs>
      </Shell>
    </>
  );
}
