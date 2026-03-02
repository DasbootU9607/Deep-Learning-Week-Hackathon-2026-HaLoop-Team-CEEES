"use client";

import { useState } from "react";
import { LayoutGrid, List, Plus } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Topbar } from "@/components/layout/Topbar";
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
      <Topbar
        title="Change Requests"
        description="Manage and review change requests across all repositories"
      >
        <div className="flex items-center gap-1 rounded-md border border-border p-1">
          <Button
            variant={view === "table" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2"
            onClick={() => setView("table")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2"
            onClick={() => setView("kanban")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New CR
        </Button>
      </Topbar>

      <Shell>
        <CRFilters filters={filters} onChange={setFilters} />

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p className="text-destructive">Failed to load change requests</p>
            <p className="text-sm text-muted-foreground mt-1">Please try again later</p>
          </div>
        )}

        {!isLoading && !isError && crs && (
          view === "table" ? (
            <CRTable items={crs} />
          ) : (
            <KanbanBoard items={crs} />
          )
        )}
      </Shell>
    </>
  );
}
