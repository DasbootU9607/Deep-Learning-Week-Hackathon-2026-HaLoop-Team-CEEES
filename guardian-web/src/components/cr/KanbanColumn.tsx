import { CRListItem, CRStatus } from "@/types/cr";
import { CRCard } from "./CRCard";

const COLUMN_CONFIG: Record<string, { title: string; statuses: CRStatus[] }> = {
  open: { title: "Open / Draft", statuses: ["draft"] },
  pending: { title: "Pending Approval", statuses: ["pending_approval"] },
  review: { title: "In Review", statuses: ["changes_requested"] },
  done: { title: "Completed", statuses: ["approved", "rejected", "applied"] },
};

interface KanbanBoardProps {
  items: CRListItem[];
}

export function KanbanBoard({ items }: KanbanBoardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {Object.entries(COLUMN_CONFIG).map(([key, { title, statuses }]) => {
        const columnItems = items.filter((cr) => statuses.includes(cr.status));
        return (
          <div key={key} className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
              <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                {columnItems.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {columnItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  No CRs
                </div>
              ) : (
                columnItems.map((cr) => <CRCard key={cr.id} cr={cr} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
