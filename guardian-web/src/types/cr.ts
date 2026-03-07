import type { ReviewDecision, RiskReason } from "@/lib/server/contracts";

export type CRStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "applied";

export type RiskLevel = "low" | "med" | "high";

export interface PatchFile {
  path: string;
  additions: number;
  deletions: number;
  risk_rules_hit: string[];
  risk_level: RiskLevel;
  is_protected?: boolean;
  risk_categories?: Array<RiskReason["category"]>;
}

export interface BlastRadiusNode {
  id: string;
  type: "file" | "service" | "database" | "external";
  label: string;
  risk_level?: RiskLevel;
  metadata?: Record<string, unknown>;
}

export interface BlastRadiusEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface BlastRadius {
  nodes: BlastRadiusNode[];
  edges: BlastRadiusEdge[];
}

export interface EvidenceItem {
  type: "test" | "log" | "sast" | "sca" | "lint";
  status: "passed" | "failed" | "warning" | "skipped";
  kind?: "recommended" | "executed";
  name: string;
  command?: string;
  scope?: string;
  url?: string;
  summary?: string;
  details?: string;
}

export interface Approval {
  id: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_avatar?: string;
  action: "approved" | "rejected" | "changes_requested";
  comment?: string;
  created_at: string;
}

export interface CR {
  id: string;
  repo: string;
  branch: string;
  title: string;
  description?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name: string;
  status: CRStatus;
  risk_score: number;
  risk_level: RiskLevel;
  review?: ReviewDecision;
  risk_reasons?: RiskReason[];
  risk_breakdown?: {
    local_score?: number;
    backend_score: number;
    final_score: number;
  };
  plan?: string;
  proposed_commands?: string[];
  patch_summary: PatchFile[];
  blast_radius: BlastRadius;
  evidence: EvidenceItem[];
  approvals: Approval[];
  policy_snapshot_id?: string;
  required_approvals: number;
  pr_url?: string;
  commit_sha?: string;
  labels?: string[];
}

export interface CRListItem {
  id: string;
  repo: string;
  branch: string;
  title: string;
  created_at: string;
  updated_at: string;
  created_by_name: string;
  status: CRStatus;
  risk_score: number;
  risk_level: RiskLevel;
  approvals_count: number;
  required_approvals: number;
  labels?: string[];
}

export interface CRFilters {
  repo?: string;
  status?: CRStatus | "all";
  risk_level?: RiskLevel | "all";
  search?: string;
}
