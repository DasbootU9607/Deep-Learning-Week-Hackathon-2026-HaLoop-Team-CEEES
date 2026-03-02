export type PathRuleType = "allow" | "deny" | "require_approval";
export type RoleType = "admin" | "lead" | "developer" | "viewer";

export interface PathRule {
  id: string;
  pattern: string;
  type: PathRuleType;
  description?: string;
  created_at: string;
  created_by: string;
}

export interface RiskThreshold {
  low_max: number;
  med_max: number;
  auto_approve_below?: number;
  require_dual_approval_above?: number;
}

export interface RolePermission {
  role: RoleType;
  can_approve: boolean;
  can_reject: boolean;
  can_configure_policy: boolean;
  can_toggle_incident: boolean;
}

export interface Policy {
  id: string;
  name: string;
  version: number;
  is_active: boolean;
  path_rules: PathRule[];
  risk_thresholds: RiskThreshold;
  role_permissions: RolePermission[];
  created_at: string;
  updated_at: string;
  created_by: string;
}
