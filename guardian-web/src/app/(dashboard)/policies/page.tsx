"use client";

import { Shell } from "@/components/layout/Shell";
import { Topbar } from "@/components/layout/Topbar";
import { Skeleton } from "@/components/ui/skeleton";
import { PolicyEditor } from "@/components/policy/PolicyEditor";
import { usePolicies, useUpdatePathRules } from "@/hooks/usePolicies";

export default function PoliciesPage() {
  const { data: policy, isLoading, isError } = usePolicies();
  const { mutate: updateRules } = useUpdatePathRules();

  return (
    <>
      <Topbar
        title="Policies"
        description="Configure risk rules, thresholds, and role permissions"
      />
      <Shell>
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {isError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p className="text-destructive">Failed to load policy configuration</p>
          </div>
        )}

        {!isLoading && !isError && policy && (
          <PolicyEditor policy={policy} onSaveRules={updateRules} />
        )}
      </Shell>
    </>
  );
}
