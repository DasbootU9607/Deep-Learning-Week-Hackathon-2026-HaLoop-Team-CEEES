import { CRStatus } from "@/types/cr";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<CRStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-500/12 text-slate-700 border-slate-400/25" },
  pending_approval: { label: "Pending", className: "bg-yellow-500/12 text-amber-700 border-yellow-500/25" },
  approved: { label: "Approved", className: "bg-green-500/12 text-emerald-700 border-green-500/25" },
  rejected: { label: "Rejected", className: "bg-red-500/12 text-red-700 border-red-500/25" },
  changes_requested: { label: "Changes Requested", className: "bg-orange-500/12 text-orange-700 border-orange-500/25" },
  applied: { label: "Applied", className: "bg-blue-500/12 text-blue-700 border-blue-500/25" },
};

interface CRStatusBadgeProps {
  status: CRStatus;
  className?: string;
}

export function CRStatusBadge({ status, className }: CRStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
