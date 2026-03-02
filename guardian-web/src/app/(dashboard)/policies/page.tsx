"use client";

import { Shell } from "@/components/layout/Shell";
import { Topbar } from "@/components/layout/Topbar";
import { PageHero } from "@/components/layout/PageHero";
import { Skeleton } from "@/components/ui/skeleton";
import { PolicyEditor } from "@/components/policy/PolicyEditor";
import { usePolicies, useUpdatePathRules } from "@/hooks/usePolicies";

export default function PoliciesPage() {
  const { data: policy, isLoading, isError } = usePolicies();
  const { mutate: updateRules } = useUpdatePathRules();

  return (
    <>
      <Topbar title="Policies" description="Rule configuration for path risk, thresholds, and governance permissions" />
      <Shell>
        <PageHero
          eyebrow="Governance Policy"
          title="Control how risk is evaluated"
          description="Tune path rules and thresholds to align approvals with repository blast radius and team responsibilities."
        />

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-10 w-48 rounded-xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        )}

        {isError && (
          <div className="glass-panel rounded-2xl border-destructive/40 bg-destructive/10 p-6 text-center">
            <p className="text-destructive">Failed to load policy configuration</p>
          </div>
        )}

        {!isLoading && !isError && policy && <PolicyEditor policy={policy} onSaveRules={updateRules} />}
      </Shell>
    </>
  );
}
