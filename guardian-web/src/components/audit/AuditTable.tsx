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
  plan_generated: "Plan Generated",
  auto_approved_low_risk: "Auto-Approved Low Risk",
  approval_required_high_risk: "Approval Required",
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
  auto_approved_low_risk: "text-green-300",
  approval_required_high_risk: "text-yellow-300",
  incident_mode_enabled: "text-red-300 font-semibold",
  incident_mode_disabled: "text-blue-300",
  cr_changes_requested: "text-yellow-300",
};

interface AuditTableProps {
  logs: AuditLog[];
}

export function AuditTable({ logs }: AuditTableProps) {
  if (logs.length === 0) {
    return (
      <div className="glass-panel rounded-2xl border-dashed border-white/20 p-12 text-center">
        <p className="text-muted-foreground">No audit logs found</p>
      </div>
    );
  }

  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Time</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actor</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
            <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">Target</th>
            <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">Risk</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, idx) => (
            <tr
              key={log.id}
              className={cn(
                "border-b border-white/10 last:border-0 transition-colors hover:bg-white/10",
                idx % 2 === 0 ? "" : "bg-white/5"
              )}
            >
              <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(log.timestamp)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                    {log.actor_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <div className="text-sm">{log.actor_name}</div>
                    {log.actor_role && (
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{log.actor_role}</div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={cn("text-sm", ACTION_COLORS[log.action])}>{ACTION_LABELS[log.action] ?? log.action}</span>
              </td>
              <td className="hidden px-4 py-3 md:table-cell">
                {log.target_cr_id ? (
                  <Link href={`/cr/${log.target_cr_id}`} className="block max-w-xs truncate font-mono text-xs text-primary hover:underline">
                    {log.target_cr_title ?? log.target_cr_id}
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </td>
              <td className="hidden px-4 py-3 lg:table-cell">
                {log.risk_level ? (
                  <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", getRiskBgColor(log.risk_level))}>
                    {log.risk_level}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
