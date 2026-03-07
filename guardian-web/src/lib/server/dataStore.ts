import { isProdBackendMode } from "@/lib/server/backendMode";
import { AuditFilters, AuditLog } from "@/types/audit";
import { CR, CRFilters, CRListItem, RiskLevel } from "@/types/cr";
import { PathRule, Policy } from "@/types/policy";
import {
  ApprovalDecisionEvent,
  ApprovalRequest,
  GeneratePlanRequest,
  GeneratePlanResponse,
  IncidentModeState,
} from "@/lib/server/contracts";
import { AuthenticatedActor } from "@/lib/server/auth";
import * as demoStore from "@/lib/server/dataStoreDemo";
import * as prodStore from "@/lib/server/dataStorePrisma";

export type StoredPlanSnapshot = {
  request: GeneratePlanRequest;
  response: GeneratePlanResponse;
  createdAt: string;
};

const INCIDENT_APPROVAL_BLOCKED_CODE = "INCIDENT_MODE_APPROVAL_BLOCKED";

type StoreModule = {
  saveGeneratedPlan: (params: {
    request: GeneratePlanRequest;
    response: GeneratePlanResponse;
  }) => Promise<void>;
  getStoredPlan: (planId: string) => Promise<StoredPlanSnapshot | undefined>;
  getApprovalDecision: (approvalId: string) => Promise<ApprovalDecisionEvent | undefined>;
  createApprovalTicket: (request: ApprovalRequest) => Promise<ApprovalRequest>;
  listCRs: (filters?: CRFilters) => Promise<CRListItem[]>;
  getCRById: (id: string) => Promise<CR | undefined>;
  applyReviewAction: (params: {
    crId: string;
    action: "approved" | "rejected" | "changes_requested";
    actor: AuthenticatedActor;
    comment?: string;
  }) => Promise<CR | undefined>;
  listAuditLogs: (filters?: AuditFilters) => Promise<AuditLog[]>;
  getActivePolicy: () => Promise<Policy>;
  getIncidentModeState: () => Promise<IncidentModeState>;
  setIncidentModeState: (params: {
    enabled: boolean;
    actor: AuthenticatedActor;
    reason?: string;
  }) => Promise<IncidentModeState>;
  updatePathRules: (
    rules: PathRule[],
    riskThresholds?: Policy["risk_thresholds"],
    actor?: AuthenticatedActor,
  ) => Promise<Policy>;
  isIncidentModeApprovalError: (error: unknown) => boolean;
};

function getStore(): StoreModule {
  return (isProdBackendMode() ? prodStore : demoStore) as unknown as StoreModule;
}

export { INCIDENT_APPROVAL_BLOCKED_CODE };

export async function saveGeneratedPlan(params: {
  request: GeneratePlanRequest;
  response: GeneratePlanResponse;
}): Promise<void> {
  return getStore().saveGeneratedPlan(params);
}

export async function getStoredPlan(planId: string): Promise<StoredPlanSnapshot | undefined> {
  return getStore().getStoredPlan(planId);
}

export async function getApprovalDecision(approvalId: string): Promise<ApprovalDecisionEvent | undefined> {
  return getStore().getApprovalDecision(approvalId);
}

export async function createApprovalTicket(request: ApprovalRequest): Promise<ApprovalRequest> {
  return getStore().createApprovalTicket(request);
}

export async function listCRs(filters: CRFilters = {}): Promise<CRListItem[]> {
  return getStore().listCRs(filters);
}

export async function getCRById(id: string): Promise<CR | undefined> {
  return getStore().getCRById(id);
}

export async function applyReviewAction(params: {
  crId: string;
  action: "approved" | "rejected" | "changes_requested";
  actor: AuthenticatedActor;
  comment?: string;
}): Promise<CR | undefined> {
  return getStore().applyReviewAction(params);
}

export async function listAuditLogs(filters: AuditFilters = {}): Promise<AuditLog[]> {
  return getStore().listAuditLogs(filters);
}

export async function getActivePolicy(): Promise<Policy> {
  return getStore().getActivePolicy();
}

export async function getIncidentModeState(): Promise<IncidentModeState> {
  return getStore().getIncidentModeState();
}

export async function setIncidentModeState(params: {
  enabled: boolean;
  actor: AuthenticatedActor;
  reason?: string;
}): Promise<IncidentModeState> {
  return getStore().setIncidentModeState(params);
}

export async function updatePathRules(
  rules: PathRule[],
  riskThresholds?: Policy["risk_thresholds"],
  actor?: AuthenticatedActor,
): Promise<Policy> {
  return getStore().updatePathRules(rules, riskThresholds, actor);
}

export function isIncidentModeApprovalError(error: unknown): boolean {
  return getStore().isIncidentModeApprovalError(error);
}

export function toRiskLevel(score: number): RiskLevel {
  if (score >= 70) {
    return "high";
  }

  if (score >= 40) {
    return "med";
  }

  return "low";
}
