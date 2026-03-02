import Link from "next/link";
import { CRListItem } from "@/types/cr";
import { CRStatusBadge } from "./CRStatusBadge";
import { cn, formatRelativeTime, getRiskBgColor } from "@/lib/utils";
import { CheckCircle, GitBranch } from "lucide-react";

interface CRTableProps {
  items: CRListItem[];
}

export function CRTable({ items }: CRTableProps) {
  if (items.length === 0) {
    return (
      <div className="glass-panel rounded-2xl border-dashed border-white/20 p-12 text-center">
        <p className="text-muted-foreground">No change requests found</p>
        <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Repository</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Risk</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Approvals</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Updated</th>
          </tr>
        </thead>
        <tbody>
          {items.map((cr, idx) => (
            <tr
              key={cr.id}
              className={cn(
                "border-b border-white/10 last:border-0 transition-colors hover:bg-white/10",
                idx % 2 === 0 ? "" : "bg-white/5"
              )}
            >
              <td className="px-4 py-3">
                <Link href={`/cr/${cr.id}`} className="hover:text-primary transition-colors font-medium line-clamp-1">
                  {cr.title}
                </Link>
                <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground md:hidden">
                  <GitBranch className="h-3 w-3" />
                  {cr.repo}
                </div>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <div className="font-mono text-xs text-muted-foreground">{cr.repo}</div>
                <div className="font-mono text-xs text-muted-foreground/60 truncate max-w-32">{cr.branch}</div>
              </td>
              <td className="px-4 py-3">
                <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold", getRiskBgColor(cr.risk_level))}>
                  {cr.risk_score}
                </span>
              </td>
              <td className="px-4 py-3">
                <CRStatusBadge status={cr.status} />
              </td>
              <td className="px-4 py-3 hidden lg:table-cell">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle className="h-3 w-3" />
                  {cr.approvals_count}/{cr.required_approvals}
                </div>
              </td>
              <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                {formatRelativeTime(cr.updated_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
