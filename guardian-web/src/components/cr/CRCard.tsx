import Link from "next/link";
import { GitBranch, Clock, User, CheckCircle } from "lucide-react";
import { CRListItem } from "@/types/cr";
import { CRStatusBadge } from "./CRStatusBadge";
import { cn, formatRelativeTime, getRiskBgColor } from "@/lib/utils";

interface CRCardProps {
  cr: CRListItem;
}

export function CRCard({ cr }: CRCardProps) {
  return (
    <Link href={`/cr/${cr.id}`}>
      <div className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 hover:bg-card/80 transition-all cursor-pointer group">
        <div className="flex items-start justify-between gap-2 mb-3">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
              getRiskBgColor(cr.risk_level)
            )}
          >
            {cr.risk_score} · {cr.risk_level.toUpperCase()}
          </span>
          <CRStatusBadge status={cr.status} />
        </div>

        <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
          {cr.title}
        </h3>

        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <GitBranch className="h-3 w-3" />
            <span className="font-mono truncate">{cr.repo}/{cr.branch}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <User className="h-3 w-3" />
              <span>{cr.created_by_name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <span>{formatRelativeTime(cr.updated_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-3 w-3" />
            <span>{cr.approvals_count}/{cr.required_approvals} approvals</span>
          </div>
        </div>

        {cr.labels && cr.labels.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {cr.labels.slice(0, 3).map((label) => (
              <span key={label} className="rounded px-1.5 py-0.5 text-xs bg-secondary text-secondary-foreground">
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
