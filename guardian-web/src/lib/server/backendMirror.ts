import { randomUUID } from "node:crypto";
import {
  ApprovalDecisionEvent,
  ApprovalRequest,
  GeneratePlanResponse,
} from "@/lib/server/contracts";
import {
  insertAuditLog,
  isSqliteMirrorAvailable,
  listCompactAuditRows,
  upsertApprovalRequest,
  upsertProfile,
  updateApprovalStatus,
} from "@/lib/server/sqliteMirrorDb";

type MirrorStatus =
  | "pending"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "cancelled"
  | "applied";

type MirrorRiskLevel = "low" | "med" | "high" | "critical";

export interface CompactAuditEvent {
  created_at: string;
  event_type: string;
  event_payload: Record<string, unknown>;
}

export async function mirrorPluginApprovalRequest(params: {
  request: ApprovalRequest;
  branchName?: string;
  summary?: string;
  planPayload?: GeneratePlanResponse;
}): Promise<void> {
  if (!isSqliteMirrorAvailable()) {
    return;
  }

  const requesterId = await ensureProfileId(params.request.requestedBy, "developer");
  const riskScore = clampRiskScore(params.request.risk.score);
  const title =
    params.summary?.trim() || `AI Plan ${params.request.planId.slice(0, 8)} pending approval`;

  upsertApprovalRequest({
    id: params.request.approvalId,
    title,
    requesterId,
    branchName: params.branchName ?? "ai/generated",
    planJson:
      params.planPayload ??
      ({
        planId: params.request.planId,
        summary: params.summary ?? "",
      } satisfies Record<string, unknown>),
    touchedPaths: params.request.blastRadius.files,
    riskScore,
    riskLevel: toRiskLevel(riskScore),
    status: "pending_approval",
    policyHits: params.request.risk.reasons,
    reviewerIds: [],
    createdAt: params.request.createdAt,
  });

  insertAuditLog({
    requestId: params.request.approvalId,
    actorId: requesterId,
    eventType: "APPROVAL_REQUEST_CREATED",
    eventPayload: {
      source: "plugin",
      risk_score: riskScore,
      reasons: params.request.risk.reasons,
    },
  });
}

export async function mirrorApprovalDecision(params: {
  approvalId: string;
  decision: ApprovalDecisionEvent["decision"] | "changes_requested";
  reviewer: string;
  reason?: string;
}): Promise<boolean> {
  if (!isSqliteMirrorAvailable()) {
    return false;
  }

  const status = toStatusFromDecision(params.decision);
  const reviewerId = await ensureProfileId(params.reviewer, "reviewer");

  const updated = updateApprovalStatus({
    requestId: params.approvalId,
    status,
  });
  if (!updated) {
    return false;
  }

  insertAuditLog({
    requestId: params.approvalId,
    actorId: reviewerId,
    eventType: "APPROVAL_STATUS_UPDATED",
    eventPayload: {
      decision: params.decision,
      status,
      reviewer: params.reviewer,
      reason: params.reason ?? null,
    },
  });

  return true;
}

export async function persistStandalonePlanRequest(params: {
  goal: string;
  planPayload: Record<string, unknown>;
  riskScore: number;
  riskReasons: string[];
  requestedBy?: string;
  branchName?: string;
}): Promise<string | undefined> {
  if (!isSqliteMirrorAvailable()) {
    return undefined;
  }

  const requestedBy = params.requestedBy?.trim() || "api-user";
  const requesterId = await ensureProfileId(requestedBy, "developer");
  const riskScore = clampRiskScore(params.riskScore);
  const requestId = randomUUID();
  const status: MirrorStatus = riskScore >= 70 ? "pending_approval" : "approved";

  upsertApprovalRequest({
    id: requestId,
    title: params.goal.trim().slice(0, 200) || "AI generated plan",
    requesterId,
    branchName: params.branchName ?? "ai/generated",
    planJson: params.planPayload,
    touchedPaths: coerceTouchedPaths(params.planPayload),
    riskScore,
    riskLevel: toRiskLevel(riskScore),
    status,
    policyHits: params.riskReasons,
    reviewerIds: [],
  });

  insertAuditLog({
    requestId,
    actorId: requesterId,
    eventType: "PLAN_GENERATED",
    eventPayload: {
      source: "api/ai/plan",
      risk_score: riskScore,
    },
  });

  return requestId;
}

export async function listCompactAuditEvents(limit = 50): Promise<CompactAuditEvent[] | undefined> {
  if (!isSqliteMirrorAvailable()) {
    return undefined;
  }

  const rows = listCompactAuditRows(limit);

  return rows.map((row) => ({
    created_at: String(row.created_at),
    event_type: String(row.event_type),
    event_payload: parseJsonObject(row.event_payload),
  }));
}

async function ensureProfileId(
  displayName: string,
  role: "developer" | "reviewer" | "security" | "admin",
): Promise<string> {
  return upsertProfile({ displayName, role });
}

function toRiskLevel(score: number): MirrorRiskLevel {
  if (score >= 90) {
    return "critical";
  }
  if (score >= 70) {
    return "high";
  }
  if (score >= 40) {
    return "med";
  }
  return "low";
}

function toStatusFromDecision(
  decision: ApprovalDecisionEvent["decision"] | "changes_requested",
): MirrorStatus {
  if (decision === "approved") {
    return "approved";
  }
  if (decision === "changes_requested") {
    return "changes_requested";
  }
  return "rejected";
}

function clampRiskScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function coerceTouchedPaths(planPayload: Record<string, unknown>): string[] {
  const changes = planPayload.changes;
  if (!Array.isArray(changes)) {
    return [];
  }

  return changes
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }
      const maybePath = (item as { path?: unknown }).path;
      return typeof maybePath === "string" ? maybePath : "";
    })
    .filter((path) => path.length > 0);
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}
