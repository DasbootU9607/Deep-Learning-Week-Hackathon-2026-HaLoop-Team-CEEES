export type UiStatus =
  | "IDLE"
  | "COLLECTING_CONTEXT"
  | "DRAFTING_PLAN"
  | "PREVIEW_READY"
  | "WAITING_APPROVAL"
  | "APPROVED"
  | "APPLYING"
  | "APPLIED"
  | "DENIED"
  | "ROLLED_BACK"
  | "ERROR";

export type PlanChangeView = {
  path: string;
  action: "create" | "update" | "delete";
};

export type PlanView = {
  planId: string;
  summary: string;
  changes: PlanChangeView[];
  proposedCommands: string[];
  backendRisk: {
    score: number;
    level: "low" | "medium" | "high";
    reasons: string[];
  };
};

export type RiskView = {
  localRiskScore: number;
  finalRiskScore: number;
  decision: "ALLOW" | "ALLOW_WITH_WARNING" | "REQUIRE_APPROVAL";
  reasons: string[];
  warning?: string;
};

export type PluginUiState = {
  status: UiStatus;
  canApply: boolean;
  isBusy: boolean;
  approvalId?: string;
  plan?: PlanView;
  risk?: RiskView;
  error?: string;
  events: string[];
};
