import { CRStatus } from "@/types/cr";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<CRStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  pending_approval: { label: "Pending", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  approved: { label: "Approved", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  rejected: { label: "Rejected", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  changes_requested: { label: "Changes Requested", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  applied: { label: "Applied", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
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
