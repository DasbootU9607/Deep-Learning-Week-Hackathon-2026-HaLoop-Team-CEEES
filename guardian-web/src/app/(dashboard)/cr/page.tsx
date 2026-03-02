"use client";

import { useState } from "react";
import { LayoutGrid, List, Plus } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Topbar } from "@/components/layout/Topbar";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CRFilters } from "@/components/cr/CRFilters";
import { CRTable } from "@/components/cr/CRTable";
import { KanbanBoard } from "@/components/cr/KanbanColumn";
import { useCRList } from "@/hooks/useCRList";
import { CRFilters as CRFiltersType } from "@/types/cr";

type ViewMode = "table" | "kanban";

export default function CRListPage() {
  const [view, setView] = useState<ViewMode>("table");
  const [filters, setFilters] = useState<CRFiltersType>({});
  const { data: crs, isLoading, isError } = useCRList(filters);

  return (
    <>
      <Topbar title="Change Requests" description="Pipeline management for generated and reviewed changes" />

      <Shell>
        <PageHero
          eyebrow="Review Pipeline"
          title="Coordinate code changes with confidence"
          description="Switch between table and board views, triage by risk, and move high-impact changes through approval quickly."
          rightSlot={
            <>
              <div className="glass-muted flex items-center gap-1 rounded-xl border p-1">
                <Button variant={view === "table" ? "secondary" : "ghost"} size="sm" className="h-8 px-2.5" onClick={() => setView("table")}>
                  <List className="h-4 w-4" />
                </Button>
                <Button variant={view === "kanban" ? "secondary" : "ghost"} size="sm" className="h-8 px-2.5" onClick={() => setView("kanban")}>
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                New CR
              </Button>
            </>
          }
        />

        <section className="glass-panel rounded-2xl p-4 sm:p-5">
          <CRFilters filters={filters} onChange={setFilters} />
        </section>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        )}

        {isError && (
          <div className="glass-panel rounded-2xl border-destructive/40 bg-destructive/10 p-6 text-center">
            <p className="text-destructive">Failed to load change requests</p>
            <p className="mt-1 text-sm text-muted-foreground">Please try again later</p>
          </div>
        )}

        {!isLoading && !isError && crs && (view === "table" ? <CRTable items={crs} /> : <KanbanBoard items={crs} />)}
      </Shell>
    </>
  );
}
