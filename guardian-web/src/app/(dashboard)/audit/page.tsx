"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shell } from "@/components/layout/Shell";
import { Topbar } from "@/components/layout/Topbar";
import { PageHero } from "@/components/layout/PageHero";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditFilters } from "@/components/audit/AuditFilters";
import { AuditTable } from "@/components/audit/AuditTable";
import { fetchAuditLogs } from "@/lib/api/audit";
import { AuditFilters as AuditFiltersType } from "@/types/audit";

export default function AuditPage() {
  const [filters, setFilters] = useState<AuditFiltersType>({});
  const { data: logs, isLoading, isError } = useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: () => fetchAuditLogs(filters),
  });

  return (
    <>
      <Topbar title="Audit Logs" description="Immutable timeline of governance actions and reviewer decisions" />
      <Shell>
        <PageHero
          eyebrow="Audit"
          title="Trace every governance event"
          description="Filter by actor, action, risk and date range to investigate incidents and compliance posture."
        />

        <section className="glass-panel rounded-2xl p-4 sm:p-5">
          <AuditFilters filters={filters} onChange={setFilters} />
        </section>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        )}

        {isError && (
          <div className="glass-panel rounded-2xl border-destructive/40 bg-destructive/10 p-6 text-center">
            <p className="text-destructive">Failed to load audit logs</p>
          </div>
        )}

        {!isLoading && !isError && logs && <AuditTable logs={logs} />}
      </Shell>
    </>
  );
}
