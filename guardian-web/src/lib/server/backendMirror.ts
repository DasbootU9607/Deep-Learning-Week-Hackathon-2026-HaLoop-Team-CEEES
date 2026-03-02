import { randomUUID } from "node:crypto";
import {
  ApprovalDecisionEvent,
  ApprovalRequest,
  GeneratePlanResponse,
} from "@/lib/server/contracts";
import { getSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

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
  const client = getSupabaseAdminClient();
  if (!client) {
    return;
  }

  const requesterId = await ensureProfileId(params.request.requestedBy, "developer");
  const riskScore = clampRiskScore(params.request.risk.score);
  const title =
    params.summary?.trim() || `AI Plan ${params.request.planId.slice(0, 8)} pending approval`;

  const { error: upsertError } = await client
    .from("approval_requests")
    .upsert(
      {
        id: params.request.approvalId,
        title,
        requester_id: requesterId,
        branch_name: params.branchName ?? "ai/generated",
        plan_json:
          params.planPayload ??
          ({
            planId: params.request.planId,
            summary: params.summary ?? "",
          } satisfies Record<string, unknown>),
        touched_paths: params.request.blastRadius.files,
        risk_score: riskScore,
        risk_level: toRiskLevel(riskScore),
        status: "pending_approval" satisfies MirrorStatus,
        policy_hits: params.request.risk.reasons,
        reviewer_ids: [],
        created_at: params.request.createdAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

  if (upsertError) {
    throw new Error(`Supabase upsert approval request failed: ${upsertError.message}`);
  }

  const { error: auditError } = await client.from("audit_logs").insert({
    request_id: params.request.approvalId,
    actor_id: requesterId,
    event_type: "APPROVAL_REQUEST_CREATED",
    event_payload: {
      source: "plugin",
      risk_score: riskScore,
      reasons: params.request.risk.reasons,
    },
  });

  if (auditError) {
    throw new Error(`Supabase insert audit log failed: ${auditError.message}`);
  }
}

export async function mirrorApprovalDecision(params: {
  approvalId: string;
  decision: ApprovalDecisionEvent["decision"] | "changes_requested";
  reviewer: string;
  reason?: string;
}): Promise<boolean> {
  const client = getSupabaseAdminClient();
  if (!client) {
    return false;
  }

  const status = toStatusFromDecision(params.decision);
  const reviewerId = await ensureProfileId(params.reviewer, "reviewer");

  const { data: updated, error: updateError } = await client
    .from("approval_requests")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.approvalId)
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(`Supabase update approval status failed: ${updateError.message}`);
  }

  if (!updated) {
    return false;
  }

  const { error: auditError } = await client.from("audit_logs").insert({
    request_id: params.approvalId,
    actor_id: reviewerId,
    event_type: "APPROVAL_STATUS_UPDATED",
    event_payload: {
      decision: params.decision,
      status,
      reviewer: params.reviewer,
      reason: params.reason ?? null,
    },
  });

  if (auditError) {
    throw new Error(`Supabase insert decision audit log failed: ${auditError.message}`);
  }

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
  const client = getSupabaseAdminClient();
  if (!client) {
    return undefined;
  }

  const requestedBy = params.requestedBy?.trim() || "api-user";
  const requesterId = await ensureProfileId(requestedBy, "developer");
  const riskScore = clampRiskScore(params.riskScore);
  const requestId = randomUUID();
  const status: MirrorStatus = riskScore >= 70 ? "pending_approval" : "approved";

  const { error: insertError } = await client.from("approval_requests").insert({
    id: requestId,
    title: params.goal.trim().slice(0, 200) || "AI generated plan",
    requester_id: requesterId,
    branch_name: params.branchName ?? "ai/generated",
    plan_json: params.planPayload,
    touched_paths: coerceTouchedPaths(params.planPayload),
    risk_score: riskScore,
    risk_level: toRiskLevel(riskScore),
    status,
    policy_hits: params.riskReasons,
    reviewer_ids: [],
    updated_at: new Date().toISOString(),
  });

  if (insertError) {
    throw new Error(`Supabase insert plan request failed: ${insertError.message}`);
  }

  const { error: auditError } = await client.from("audit_logs").insert({
    request_id: requestId,
    actor_id: requesterId,
    event_type: "PLAN_GENERATED",
    event_payload: {
      source: "api/ai/plan",
      risk_score: riskScore,
    },
  });

  if (auditError) {
    throw new Error(`Supabase insert plan audit log failed: ${auditError.message}`);
  }

  return requestId;
}

export async function listCompactAuditEvents(limit = 50): Promise<CompactAuditEvent[] | undefined> {
  const client = getSupabaseAdminClient();
  if (!client) {
    return undefined;
  }

  const { data, error } = await client
    .from("audit_logs")
    .select("created_at, event_type, event_payload")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 200)));

  if (error) {
    throw new Error(`Supabase audit fetch failed: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    created_at: String(row.created_at),
    event_type: String(row.event_type),
    event_payload:
      row.event_payload && typeof row.event_payload === "object"
        ? (row.event_payload as Record<string, unknown>)
        : {},
  }));
}

async function ensureProfileId(
  displayName: string,
  role: "developer" | "reviewer" | "security" | "admin",
): Promise<string> {
  const client = getSupabaseAdminClient();
  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedName = displayName.trim() || "Unknown User";
  const email = toSyntheticEmail(normalizedName);

  const { data, error } = await client
    .from("profiles")
    .upsert(
      {
        email,
        display_name: normalizedName,
        role,
      },
      { onConflict: "email" },
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`Supabase upsert profile failed: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("Supabase upsert profile returned empty id.");
  }

  return String(data.id);
}

function toSyntheticEmail(displayName: string): string {
  const slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `${slug || "user"}@local.demo`;
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
