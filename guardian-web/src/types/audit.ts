export type AuditAction =
  | "cr_created"
  | "cr_submitted"
  | "cr_approved"
  | "cr_rejected"
  | "cr_changes_requested"
  | "cr_applied"
  | "policy_updated"
  | "incident_mode_enabled"
  | "incident_mode_disabled"
  | "rule_created"
  | "rule_updated"
  | "rule_deleted";

export interface AuditLog {
  id: string;
  timestamp: string;
  actor_id: string;
  actor_name: string;
  actor_avatar?: string;
  action: AuditAction;
  target_cr_id?: string;
  target_cr_title?: string;
  target_policy_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  risk_level?: "low" | "med" | "high";
}

export interface AuditFilters {
  repo?: string;
  action?: AuditAction | "all";
  actor?: string;
  risk_level?: "low" | "med" | "high" | "all";
  date_from?: string;
  date_to?: string;
}
