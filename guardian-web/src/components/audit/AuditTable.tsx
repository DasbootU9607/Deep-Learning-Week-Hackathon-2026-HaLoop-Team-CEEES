import Link from "next/link";
import { AuditLog } from "@/types/audit";
import { cn, formatDateTime, getRiskBgColor } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  cr_created: "CR Created",
  cr_submitted: "CR Submitted",
  cr_approved: "CR Approved",
  cr_rejected: "CR Rejected",
  cr_changes_requested: "Changes Requested",
  cr_applied: "CR Applied",
  policy_updated: "Policy Updated",
  incident_mode_enabled: "Incident Enabled",
  incident_mode_disabled: "Incident Disabled",
  rule_created: "Rule Created",
  rule_updated: "Rule Updated",
  rule_deleted: "Rule Deleted",
};

const ACTION_COLORS: Record<string, string> = {
  cr_approved: "text-green-400",
  cr_rejected: "text-red-400",
  incident_mode_enabled: "text-red-400 font-semibold",
  incident_mode_disabled: "text-blue-400",
  cr_changes_requested: "text-yellow-400",
};

interface AuditTableProps {
  logs: AuditLog[];
}

export function AuditTable({ logs }: AuditTableProps) {
  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <p className="text-muted-foreground">No audit logs found</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/30">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Time</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actor</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Target</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Risk</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, idx) => (
            <tr
              key={log.id}
              className={cn(
                "border-b border-border last:border-0 hover:bg-secondary/20 transition-colors",
                idx % 2 === 0 ? "" : "bg-secondary/10"
              )}
            >
              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                {formatDateTime(log.timestamp)}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                    {log.actor_name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <span className="text-sm">{log.actor_name}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={cn("text-sm", ACTION_COLORS[log.action])}>
                  {ACTION_LABELS[log.action] ?? log.action}
                </span>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                {log.target_cr_id ? (
                  <Link
                    href={`/cr/${log.target_cr_id}`}
                    className="text-primary hover:underline text-xs font-mono truncate max-w-xs block"
                  >
                    {log.target_cr_title ?? log.target_cr_id}
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-3 hidden lg:table-cell">
                {log.risk_level ? (
                  <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", getRiskBgColor(log.risk_level))}>
                    {log.risk_level}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
