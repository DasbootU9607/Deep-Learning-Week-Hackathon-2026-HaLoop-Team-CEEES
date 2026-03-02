"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shell } from "@/components/layout/Shell";
import { Topbar } from "@/components/layout/Topbar";
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
      <Topbar
        title="Audit Logs"
        description="Complete audit trail of all actions in the system"
      />
      <Shell>
        <AuditFilters filters={filters} onChange={setFilters} />

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p className="text-destructive">Failed to load audit logs</p>
          </div>
        )}

        {!isLoading && !isError && logs && <AuditTable logs={logs} />}
      </Shell>
    </>
  );
}
