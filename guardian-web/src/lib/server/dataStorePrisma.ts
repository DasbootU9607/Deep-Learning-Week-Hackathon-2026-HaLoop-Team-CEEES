import { randomUUID } from "node:crypto";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { mockAuditLogs } from "@/_mocks/audit";
import { mockCRs } from "@/_mocks/cr";
import { AuditFilters, AuditLog } from "@/types/audit";
import { CR, CRFilters, CRListItem, PatchFile, RiskLevel } from "@/types/cr";
import { PathRule, Policy } from "@/types/policy";
import {
  ApprovalDecisionEvent,
  IncidentModeState,
  ApprovalRequest,
  GeneratePlanRequest,
  GeneratePlanResponse,
} from "@/lib/server/contracts";
import { AuthenticatedActor } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prismaClient";

export type StoredPlanSnapshot = {
  request: GeneratePlanRequest;
  response: GeneratePlanResponse;
  createdAt: string;
};

type StoredPlan = StoredPlanSnapshot;

const DEFAULT_POLICY: Policy = {
  id: "policy-001",
  name: "Default Governance Policy",
  version: 1,
  is_active: true,
  path_rules: [
    {
      id: "rule-auth-approval",
      pattern: "**/auth/**",
      type: "require_approval",
      description: "Authentication code needs explicit review.",
      created_at: "2026-03-02T08:00:00Z",
      created_by: "system",
    },
    {
      id: "rule-db-approval",
      pattern: "**/migrations/**",
      type: "require_approval",
      description: "Database migrations are high risk.",
      created_at: "2026-03-02T08:00:00Z",
      created_by: "system",
    },
    {
      id: "rule-schema-approval",
      pattern: "**/schema.sql",
      type: "require_approval",
      description: "Schema changes require governance approval.",
      created_at: "2026-03-02T08:00:00Z",
      created_by: "system",
    },
    {
      id: "rule-package-approval",
      pattern: "package.json",
      type: "require_approval",
      description: "Dependency changes require review.",
      created_at: "2026-03-02T08:00:00Z",
      created_by: "system",
    },
    {
      id: "rule-prod-deny",
      pattern: "infra/prod/**",
      type: "deny",
      description: "Direct production infra edits are blocked.",
      created_at: "2026-03-02T08:00:00Z",
      created_by: "system",
    },
  ],
  risk_thresholds: {
    low_max: 39,
    med_max: 69,
    auto_approve_below: 30,
    require_dual_approval_above: 85,
  },
  role_permissions: [
    {
      role: "admin",
      can_approve: true,
      can_reject: true,
      can_configure_policy: true,
      can_toggle_incident: true,
    },
    {
      role: "lead",
      can_approve: true,
      can_reject: true,
      can_configure_policy: true,
      can_toggle_incident: true,
    },
    {
      role: "developer",
      can_approve: true,
      can_reject: false,
      can_configure_policy: false,
      can_toggle_incident: false,
    },
    {
      role: "viewer",
      can_approve: false,
      can_reject: false,
      can_configure_policy: false,
      can_toggle_incident: false,
    },
  ],
  created_at: "2026-03-02T08:00:00Z",
  updated_at: "2026-03-02T08:00:00Z",
  created_by: "system",
};

const DEFAULT_INCIDENT_STATE: IncidentModeState = {
  isIncidentMode: false,
  activatedAt: undefined,
  activatedBy: undefined,
  reason: undefined,
};

const INCIDENT_RECORD_ID = "incident-state";
const INCIDENT_APPROVAL_BLOCKED_CODE = "INCIDENT_MODE_APPROVAL_BLOCKED";
let bootstrapPromise: Promise<void> | undefined;

type TransactionClient = Prisma.TransactionClient;

export async function saveGeneratedPlan(params: {
  request: GeneratePlanRequest;
  response: GeneratePlanResponse;
}): Promise<void> {
  await ensureBootstrapped();
  const prisma = getPrismaClient();
  await prisma.$transaction(async (tx) => {
    await tx.storedPlan.upsert({
      where: { planId: params.response.planId },
      create: {
        planId: params.response.planId,
        requestJson: toJson(params.request),
        responseJson: toJson(params.response),
        createdAt: new Date(),
      },
      update: {
        requestJson: toJson(params.request),
        responseJson: toJson(params.response),
      },
    });

    await appendPlanAuditEventsTx(tx, params.request, params.response);
  });
}

export async function getStoredPlan(planId: string): Promise<StoredPlanSnapshot | undefined> {
  await ensureBootstrapped();
  const prisma = getPrismaClient();
  const row = await prisma.storedPlan.findUnique({
    where: { planId },
  });
  if (!row) {
    return undefined;
  }

  return {
    request: parseJson(row.requestJson, {} as GeneratePlanRequest),
    response: parseJson(row.responseJson, {} as GeneratePlanResponse),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getApprovalDecision(approvalId: string): Promise<ApprovalDecisionEvent | undefined> {
  await ensureBootstrapped();
  const prisma = getPrismaClient();
  const row = await prisma.approvalTicket.findUnique({
    where: { approvalId },
    select: { decisionJson: true },
  });
  return parseJson(row?.decisionJson, undefined);
}

export async function createApprovalTicket(request: ApprovalRequest): Promise<ApprovalRequest> {
  await ensureBootstrapped();
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.approvalTicket.findUnique({
      where: { approvalId: request.approvalId },
      select: { requestJson: true },
    });
    if (existing) {
      return parseJson(existing.requestJson, request);
    }

    const planRow = await tx.storedPlan.findUnique({
      where: { planId: request.planId },
      select: { requestJson: true, responseJson: true, createdAt: true },
    });

    const plan = planRow
      ? ({
          request: parseJson(planRow.requestJson, {} as GeneratePlanRequest),
          response: parseJson(planRow.responseJson, {} as GeneratePlanResponse),
          createdAt: planRow.createdAt.toISOString(),
        } satisfies StoredPlanSnapshot)
      : undefined;

    const policyRow = await tx.policyState.findUnique({
      where: { id: DEFAULT_POLICY.id },
    });
    const policy = policyRow ? fromPolicyRow(policyRow) : DEFAULT_POLICY;
    const cr = toCRFromApproval(request, plan, policy);

    await tx.changeRequest.create({
      data: toChangeRequestCreateData(cr),
    });

    await tx.approvalTicket.create({
      data: {
        approvalId: request.approvalId,
        requestJson: toJson(request),
        crId: cr.id,
        status: "pending",
      },
    });

    await appendAuditTx(tx, {
      actor_id: request.requestedBy,
      actor_name: request.requestedBy,
      actor_role: request.requestedByRole ?? "developer",
      action: "cr_submitted",
      target_cr_id: cr.id,
      target_cr_title: cr.title,
      risk_level: cr.risk_level,
      details: {
        source: "ide-plugin",
        approval_id: request.approvalId,
        required_approvals: cr.required_approvals,
      },
    });

    return request;
  });
}

export async function listCRs(filters: CRFilters = {}): Promise<CRListItem[]> {
  await ensureBootstrapped();
  const prisma = getPrismaClient();

  const where: Prisma.ChangeRequestWhereInput = {};
  if (filters.repo && filters.repo !== "all") {
    where.repo = filters.repo;
  }
  if (filters.status && filters.status !== "all") {
    where.status = filters.status;
  }
  if (filters.risk_level && filters.risk_level !== "all") {
    where.riskLevel = filters.risk_level;
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { repo: { contains: filters.search, mode: "insensitive" } },
      { branch: { contains: filters.search, mode: "insensitive" } },
      { createdByName: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.changeRequest.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return rows.map((row) => {
    const approvals = parseJson(row.approvalsJson, [] as CR["approvals"]);
    const labels = parseJson(row.labelsJson, [] as string[]);

    return {
      id: row.id,
      repo: row.repo,
      branch: row.branch,
      title: row.title,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
      created_by_name: row.createdByName,
      status: row.status as CR["status"],
      risk_score: row.riskScore,
      risk_level: row.riskLevel as RiskLevel,
      approvals_count: approvals.filter((approval) => approval.action === "approved").length,
      required_approvals: row.requiredApprovals,
      labels,
    } satisfies CRListItem;
  });
}

export async function getCRById(id: string): Promise<CR | undefined> {
  await ensureBootstrapped();
  const prisma = getPrismaClient();
  const row = await prisma.changeRequest.findUnique({
    where: { id },
  });
  if (!row) {
    return undefined;
  }

  const cr = fromChangeRequestRow(row);
  return enrichCRFromStoredPlan(prisma, cr);
}

export async function applyReviewAction(params: {
  crId: string;
  action: "approved" | "rejected" | "changes_requested";
  actor: AuthenticatedActor;
  comment?: string;
}): Promise<CR | undefined> {
  await ensureBootstrapped();
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const incident = await tx.incidentState.findUnique({
      where: { id: INCIDENT_RECORD_ID },
      select: { isIncidentMode: true },
    });
    if (incident?.isIncidentMode) {
      throw createIncidentModeApprovalError();
    }

    const row = await tx.changeRequest.findUnique({
      where: { id: params.crId },
    });
    if (!row) {
      return undefined;
    }

    const cr = fromChangeRequestRow(row);
    const now = new Date().toISOString();
    const reviewer = params.actor.name;
    const reviewerId = params.actor.id;

    if (
      params.action === "approved" &&
      cr.approvals.some((approval) => approval.action === "approved" && approval.reviewer_id === reviewerId)
    ) {
      throw new Error("A reviewer cannot approve the same CR twice.");
    }

    cr.approvals.push({
      id: randomUUID(),
      reviewer_id: reviewerId,
      reviewer_name: reviewer,
      action: params.action,
      comment: params.comment,
      created_at: now,
    });

    if (params.action === "approved") {
      const approvedCount = cr.approvals.filter((approval) => approval.action === "approved").length;
      cr.status = approvedCount >= cr.required_approvals ? "approved" : "pending_approval";
    }

    if (params.action === "rejected") {
      cr.status = "rejected";
    }

    if (params.action === "changes_requested") {
      cr.status = "changes_requested";
    }

    cr.updated_at = now;

    await tx.changeRequest.update({
      where: { id: cr.id },
      data: {
        status: cr.status,
        updatedAt: new Date(cr.updated_at),
        approvalsJson: toJson(cr.approvals),
      },
    });

    const linkedApproval = await tx.approvalTicket.findFirst({
      where: { crId: cr.id },
      select: {
        approvalId: true,
      },
    });
    if (linkedApproval) {
      const isApproved = params.action === "approved" && cr.status === "approved";
      if (isApproved || params.action === "rejected" || params.action === "changes_requested") {
        await tx.approvalTicket.update({
          where: { approvalId: linkedApproval.approvalId },
          data: {
            status: isApproved ? "approved" : "denied",
            decisionJson: toJson({
              approvalId: linkedApproval.approvalId,
              decision: isApproved ? "approved" : "denied",
              reviewer,
              reason:
                params.comment ??
                (params.action === "changes_requested" ? "Changes requested by reviewer." : undefined),
              decidedAt: now,
            } satisfies ApprovalDecisionEvent),
          },
        });
      }
    }

    await appendAuditTx(tx, {
      actor_id: reviewerId,
      actor_name: reviewer,
      actor_role: params.actor.role,
      action:
        params.action === "approved"
          ? "cr_approved"
          : params.action === "rejected"
          ? "cr_rejected"
          : "cr_changes_requested",
      target_cr_id: cr.id,
      target_cr_title: cr.title,
      risk_level: cr.risk_level,
      details: params.comment ? { comment: params.comment } : undefined,
    });

    return enrichCRFromStoredPlan(tx, cr);
  });
}

export async function listAuditLogs(filters: AuditFilters = {}): Promise<AuditLog[]> {
  await ensureBootstrapped();
  const prisma = getPrismaClient();

  const where: Prisma.AuditEntryWhereInput = {};
  if (filters.action && filters.action !== "all") {
    where.action = filters.action;
  }
  if (filters.actor) {
    where.actorName = { contains: filters.actor, mode: "insensitive" };
  }
  if (filters.risk_level && filters.risk_level !== "all") {
    where.riskLevel = filters.risk_level;
  }
  if (filters.date_from || filters.date_to) {
    where.timestamp = {
      ...(filters.date_from ? { gte: new Date(filters.date_from) } : {}),
      ...(filters.date_to ? { lte: new Date(filters.date_to) } : {}),
    };
  }

  const rows = await prisma.auditEntry.findMany({
    where,
    orderBy: { timestamp: "desc" },
  });

  return rows
    .map((row) => fromAuditRow(row))
    .filter((log) => {
      if (!filters.repo) {
        return true;
      }

      const logRepo = String(log.details?.repo ?? "");
      if (logRepo && logRepo !== filters.repo) {
        return false;
      }
      return true;
    });
}

export async function getActivePolicy(): Promise<Policy> {
  await ensureBootstrapped();
  const prisma = getPrismaClient();
  const row = await prisma.policyState.findUnique({
    where: { id: DEFAULT_POLICY.id },
  });
  if (!row) {
    return DEFAULT_POLICY;
  }
  return fromPolicyRow(row);
}

export async function getIncidentModeState(): Promise<IncidentModeState> {
  await ensureBootstrapped();
  const prisma = getPrismaClient();
  const row = await prisma.incidentState.findUnique({
    where: { id: INCIDENT_RECORD_ID },
  });
  if (!row) {
    return DEFAULT_INCIDENT_STATE;
  }

  return {
    isIncidentMode: row.isIncidentMode,
    activatedAt: row.activatedAt?.toISOString(),
    activatedBy: row.activatedBy ?? undefined,
    reason: row.reason ?? undefined,
  };
}

export async function setIncidentModeState(params: {
  enabled: boolean;
  actor: AuthenticatedActor;
  reason?: string;
}): Promise<IncidentModeState> {
  await ensureBootstrapped();
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const nowIso = now.toISOString();
    const actor = params.actor;
    const current = await tx.incidentState.findUnique({
      where: { id: INCIDENT_RECORD_ID },
    });

    let next: IncidentModeState;
    if (params.enabled) {
      await tx.incidentState.upsert({
        where: { id: INCIDENT_RECORD_ID },
        create: {
          id: INCIDENT_RECORD_ID,
          isIncidentMode: true,
          activatedAt: now,
          activatedBy: actor.name,
          reason: params.reason?.trim() || null,
        },
        update: {
          isIncidentMode: true,
          activatedAt: now,
          activatedBy: actor.name,
          reason: params.reason?.trim() || null,
        },
      });

      await appendAuditTx(tx, {
        actor_id: actor.id,
        actor_name: actor.name,
        actor_role: actor.role,
        action: "incident_mode_enabled",
        details: params.reason ? { reason: params.reason } : undefined,
        risk_level: "high",
      });

      next = {
        isIncidentMode: true,
        activatedAt: nowIso,
        activatedBy: actor.name,
        reason: params.reason?.trim() || undefined,
      };
    } else {
      const durationMinutes =
        current?.activatedAt
          ? Math.max(0, Math.round((now.getTime() - current.activatedAt.getTime()) / 60_000))
          : 0;

      await tx.incidentState.upsert({
        where: { id: INCIDENT_RECORD_ID },
        create: {
          id: INCIDENT_RECORD_ID,
          isIncidentMode: false,
          activatedAt: null,
          activatedBy: null,
          reason: null,
        },
        update: {
          isIncidentMode: false,
          activatedAt: null,
          activatedBy: null,
          reason: null,
        },
      });

      await appendAuditTx(tx, {
        actor_id: actor.id,
        actor_name: actor.name,
        actor_role: actor.role,
        action: "incident_mode_disabled",
        details: {
          ...(params.reason ? { reason: params.reason } : {}),
          duration_minutes: durationMinutes,
        },
        risk_level: "med",
      });

      next = {
        isIncidentMode: false,
        activatedAt: undefined,
        activatedBy: undefined,
        reason: undefined,
      };
    }

    return next;
  });
}

export async function updatePathRules(
  rules: PathRule[],
  riskThresholds?: Policy["risk_thresholds"],
  actor?: AuthenticatedActor,
): Promise<Policy> {
  await ensureBootstrapped();
  if (riskThresholds && riskThresholds.low_max >= riskThresholds.med_max) {
    throw new Error("Invalid thresholds: low_max must be smaller than med_max.");
  }

  const prisma = getPrismaClient();
  return prisma.$transaction(async (tx) => {
    const current = await tx.policyState.findUnique({
      where: { id: DEFAULT_POLICY.id },
    });
    const now = new Date().toISOString();

    const currentPolicy = current ? fromPolicyRow(current) : DEFAULT_POLICY;
    const nextPolicy: Policy = {
      ...currentPolicy,
      path_rules: rules,
      risk_thresholds: riskThresholds ?? currentPolicy.risk_thresholds,
      version: currentPolicy.version + 1,
      updated_at: now,
    };

    await tx.policyState.upsert({
      where: { id: DEFAULT_POLICY.id },
      create: toPolicyCreateData(nextPolicy),
      update: toPolicyUpdateData(nextPolicy),
    });

    await appendAuditTx(tx, {
      actor_id: actor?.id ?? "policy-admin",
      actor_name: actor?.name ?? "Policy Admin",
      actor_role: actor?.role ?? "admin",
      action: "policy_updated",
      target_policy_id: nextPolicy.id,
      details: {
        rule_count: rules.length,
        thresholds_updated: Boolean(riskThresholds),
      },
      risk_level: "med",
    });

    return nextPolicy;
  });
}

function createIncidentModeApprovalError(): Error {
  const error = new Error("Approvals are suspended during Incident Mode.");
  (error as Error & { code?: string }).code = INCIDENT_APPROVAL_BLOCKED_CODE;
  return error;
}

export function isIncidentModeApprovalError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (error as Error & { code?: string }).code === INCIDENT_APPROVAL_BLOCKED_CODE;
}

async function ensureBootstrapped(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrap().catch((error) => {
      bootstrapPromise = undefined;
      throw error;
    });
  }
  await bootstrapPromise;
}

async function bootstrap(): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.policyState.upsert({
    where: { id: DEFAULT_POLICY.id },
    create: toPolicyCreateData(DEFAULT_POLICY),
    update: {},
  });

  await prisma.incidentState.upsert({
    where: { id: INCIDENT_RECORD_ID },
    create: {
      id: INCIDENT_RECORD_ID,
      isIncidentMode: false,
      activatedAt: null,
      activatedBy: null,
      reason: null,
    },
    update: {},
  });

  if (String(process.env.PROD_BOOTSTRAP_SAMPLE_DATA ?? "").toLowerCase() !== "true") {
    return;
  }

  const crCount = await prisma.changeRequest.count();
  if (crCount === 0) {
    for (const cr of mockCRs) {
      await prisma.changeRequest.create({
        data: toChangeRequestCreateData(cr),
      });
    }
  }

  const auditCount = await prisma.auditEntry.count();
  if (auditCount === 0) {
    for (const log of mockAuditLogs) {
      await prisma.auditEntry.create({
        data: {
          id: log.id,
          timestamp: new Date(log.timestamp),
          actorId: log.actor_id,
          actorName: log.actor_name,
          actorAvatar: log.actor_avatar ?? null,
          action: log.action,
          targetCrId: log.target_cr_id ?? null,
          targetCrTitle: log.target_cr_title ?? null,
          targetPolicyId: log.target_policy_id ?? null,
          detailsJson:
            log.details || log.actor_role
              ? toJson({ ...(log.details ?? {}), actor_role: log.actor_role })
              : undefined,
          ipAddress: log.ip_address ?? null,
          riskLevel: log.risk_level ?? null,
        },
      });
    }
  }
}

function toChangeRequestCreateData(cr: CR): Prisma.ChangeRequestCreateInput {
  return {
    id: cr.id,
    repo: cr.repo,
    branch: cr.branch,
    title: cr.title,
    description: cr.description ?? null,
    createdAt: new Date(cr.created_at),
    updatedAt: new Date(cr.updated_at),
    createdBy: cr.created_by,
    createdByName: cr.created_by_name,
    status: cr.status,
    riskScore: cr.risk_score,
    riskLevel: cr.risk_level,
    plan: cr.plan ?? null,
    patchSummaryJson: toJson(cr.patch_summary),
    blastRadiusJson: toJson(cr.blast_radius),
    evidenceJson: toJson(cr.evidence),
    approvalsJson: toJson(cr.approvals),
    requiredApprovals: cr.required_approvals,
    prUrl: cr.pr_url ?? null,
    commitSha: cr.commit_sha ?? null,
    labelsJson: toJson(cr.labels ?? []),
  };
}

function fromChangeRequestRow(row: Prisma.ChangeRequestGetPayload<Record<string, never>>): CR {
  return {
    id: row.id,
    repo: row.repo,
    branch: row.branch,
    title: row.title,
    description: row.description ?? undefined,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    created_by: row.createdBy,
    created_by_name: row.createdByName,
    status: row.status as CR["status"],
    risk_score: row.riskScore,
    risk_level: row.riskLevel as RiskLevel,
    plan: row.plan ?? undefined,
    proposed_commands: undefined,
    patch_summary: parseJson(row.patchSummaryJson, [] as CR["patch_summary"]),
    blast_radius: parseJson(row.blastRadiusJson, { nodes: [], edges: [] } as CR["blast_radius"]),
    evidence: parseJson(row.evidenceJson, [] as CR["evidence"]),
    approvals: parseJson(row.approvalsJson, [] as CR["approvals"]),
    required_approvals: row.requiredApprovals,
    pr_url: row.prUrl ?? undefined,
    commit_sha: row.commitSha ?? undefined,
    labels: parseJson(row.labelsJson, [] as string[]),
  };
}

function fromAuditRow(
  row: Prisma.AuditEntryGetPayload<Record<string, never>>,
): AuditLog {
  const details = parseJson(row.detailsJson, undefined as Record<string, unknown> | undefined);
  return {
    id: row.id,
    timestamp: row.timestamp.toISOString(),
    actor_id: row.actorId,
    actor_name: row.actorName,
    actor_role: (details?.actor_role as AuditLog["actor_role"]) ?? undefined,
    actor_avatar: row.actorAvatar ?? undefined,
    action: row.action as AuditLog["action"],
    target_cr_id: row.targetCrId ?? undefined,
    target_cr_title: row.targetCrTitle ?? undefined,
    target_policy_id: row.targetPolicyId ?? undefined,
    details:
      details && "actor_role" in details
        ? Object.fromEntries(Object.entries(details).filter(([key]) => key !== "actor_role"))
        : details,
    ip_address: row.ipAddress ?? undefined,
    risk_level: (row.riskLevel as AuditLog["risk_level"]) ?? undefined,
  };
}

function fromPolicyRow(row: Prisma.PolicyStateGetPayload<Record<string, never>>): Policy {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    is_active: row.isActive,
    path_rules: parseJson(row.pathRulesJson, [] as PathRule[]),
    risk_thresholds: parseJson(row.riskThresholdsJson, DEFAULT_POLICY.risk_thresholds),
    role_permissions: parseJson(row.rolePermissionsJson, DEFAULT_POLICY.role_permissions),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    created_by: row.createdBy,
  };
}

function toPolicyCreateData(policy: Policy): Prisma.PolicyStateCreateInput {
  return {
    id: policy.id,
    name: policy.name,
    version: policy.version,
    isActive: policy.is_active,
    pathRulesJson: toJson(policy.path_rules),
    riskThresholdsJson: toJson(policy.risk_thresholds),
    rolePermissionsJson: toJson(policy.role_permissions),
    createdAt: new Date(policy.created_at),
    updatedAt: new Date(policy.updated_at),
    createdBy: policy.created_by,
  };
}

function toPolicyUpdateData(policy: Policy): Prisma.PolicyStateUpdateInput {
  return {
    name: policy.name,
    version: policy.version,
    isActive: policy.is_active,
    pathRulesJson: toJson(policy.path_rules),
    riskThresholdsJson: toJson(policy.risk_thresholds),
    rolePermissionsJson: toJson(policy.role_permissions),
    updatedAt: new Date(policy.updated_at),
    createdBy: policy.created_by,
  };
}

async function appendAuditTx(
  tx: TransactionClient,
  payload: Omit<AuditLog, "id" | "timestamp">,
): Promise<void> {
  await tx.auditEntry.create({
    data: {
      id: `log-${randomUUID()}`,
      timestamp: new Date(),
      actorId: payload.actor_id,
      actorName: payload.actor_name,
      actorAvatar: payload.actor_avatar ?? null,
      action: payload.action,
      targetCrId: payload.target_cr_id ?? null,
      targetCrTitle: payload.target_cr_title ?? null,
      targetPolicyId: payload.target_policy_id ?? null,
      detailsJson: payload.details
        ? toJson({ ...payload.details, actor_role: payload.actor_role })
        : payload.actor_role
          ? toJson({ actor_role: payload.actor_role })
          : undefined,
      ipAddress: payload.ip_address ?? null,
      riskLevel: payload.risk_level ?? null,
    },
  });
}

async function appendPlanAuditEventsTx(
  tx: TransactionClient,
  request: GeneratePlanRequest,
  response: GeneratePlanResponse,
): Promise<void> {
  const actorName = request.requestedBy?.trim() || "AI Planner";
  const actorId = actorName.toLowerCase().replace(/\s+/g, "-");
  const baseDetails = {
    review_mode: response.review.mode,
    rationale: response.review.rationale,
    score: response.backendRisk.score,
    files: response.changes.map((change) => change.path),
  };

  await appendAuditTx(tx, {
    actor_id: actorId,
    actor_name: actorName,
    actor_role: "developer",
    action: "plan_generated",
    risk_level: toRiskLevel(response.backendRisk.score),
    details: baseDetails,
  });

  if (response.review.mode === "auto_approved") {
    await appendAuditTx(tx, {
      actor_id: actorId,
      actor_name: actorName,
      actor_role: "developer",
      action: "auto_approved_low_risk",
      risk_level: "low",
      details: baseDetails,
    });
  }

  if (response.review.mode === "approval_required") {
    await appendAuditTx(tx, {
      actor_id: actorId,
      actor_name: actorName,
      actor_role: "developer",
      action: "approval_required_high_risk",
      risk_level: toRiskLevel(response.backendRisk.score),
      details: baseDetails,
    });
  }
}

function toCRFromApproval(request: ApprovalRequest, plan: StoredPlan | undefined, policy: Policy): CR {
  const now = new Date().toISOString();

  const repo = plan ? path.basename(plan.request.context.workspaceRoot) : "workspace";
  const branch = plan?.request.context.branch ?? "ai/generated";

  const riskLevel = toRiskLevel(request.risk.score);
  const patchSummary = buildPatchSummary(plan);
  const requiredApprovals = toRequiredApprovals(request.risk.score, policy);

  return {
    id: request.approvalId,
    repo,
    branch,
    title: `AI Plan ${request.planId.slice(0, 8)} pending approval`,
    description: "Generated by IDE plugin and waiting for reviewer decision.",
    created_at: request.createdAt || now,
    updated_at: now,
    created_by: request.requestedBy,
    created_by_name: request.requestedBy,
    status: "pending_approval",
    risk_score: request.risk.score,
    risk_level: riskLevel,
    plan: buildPlanMarkdown(plan, request),
    proposed_commands: plan?.response.proposedCommands ?? [],
    review: plan?.response.review ?? request.risk.review,
    risk_reasons: request.risk.reasons,
    risk_breakdown: {
      local_score: request.risk.localScore,
      backend_score: request.risk.backendScore,
      final_score: request.risk.score,
    },
    patch_summary: patchSummary,
    blast_radius: buildBlastRadius(patchSummary, repo),
    evidence: toEvidenceFromRequest(request),
    approvals: [],
    required_approvals: requiredApprovals,
    labels: [
      "plugin",
      request.risk.review.mode === "auto_approved" ? "auto-approved" : "approval-required",
    ],
  };
}

function buildPatchSummary(plan?: StoredPlan): PatchFile[] {
  if (!plan) {
    return [];
  }

  return plan.response.changes.map((change) => {
    const additions = change.newContent ? countLines(change.newContent) : 0;
    const deletions = change.action === "delete" ? 1 : 0;

    return {
      path: change.path,
      additions,
      deletions,
      risk_rules_hit: plan.response.review.matchedPolicyRules
        .filter((rule) => rule.matchedPaths.includes(change.path))
        .map((rule) => rule.pattern)
        .slice(0, 2),
      risk_level: toRiskLevel(plan.response.backendRisk.score),
      is_protected: plan.response.review.matchedPolicyRules.some((rule) =>
        rule.matchedPaths.includes(change.path),
      ),
      risk_categories: plan.response.backendRisk.reasons
        .filter((reason) => reason.affectedPath === change.path)
        .map((reason) => reason.category),
    };
  });
}

function buildBlastRadius(patchSummary: PatchFile[], repo: string): CR["blast_radius"] {
  const serviceNodeId = "service-root";
  const nodes: CR["blast_radius"]["nodes"] = patchSummary.map((file, index) => {
    return {
      id: `file-${index + 1}`,
      type: "file",
      label: file.path,
      risk_level: file.risk_level,
    };
  });

  nodes.push({
    id: serviceNodeId,
    type: "service",
    label: repo,
    risk_level: patchSummary.some((file) => file.risk_level === "high")
      ? "high"
      : patchSummary.some((file) => file.risk_level === "med")
      ? "med"
      : "low",
  });

  const edges = patchSummary.map((_, index) => ({
    id: `edge-${index + 1}`,
    source: `file-${index + 1}`,
    target: serviceNodeId,
  }));

  return {
    nodes,
    edges,
  };
}

function buildPlanMarkdown(plan: StoredPlan | undefined, request: ApprovalRequest): string {
  if (!plan) {
    return [
      "## Change Plan",
      "",
      "Plan details were not persisted before approval request.",
      "",
      `- Plan ID: ${request.planId}`,
      `- Session ID: ${request.sessionId}`,
      `- Requested By: ${request.requestedBy}`,
    ].join("\n");
  }

  const changeLines = plan.response.changes.map((change) => `- ${change.action.toUpperCase()} ${change.path}`);

  return [
    "## Change Plan",
    "",
    plan.response.summary,
    "",
    "### Why This Decision Happened",
    ...plan.response.review.rationale.map((reason) => `- ${reason}`),
    "",
    "### Proposed File Changes",
    ...changeLines,
    "",
    "### Proposed Commands",
    ...(plan.response.proposedCommands.length > 0
      ? plan.response.proposedCommands.map((command) => `- ${command}`)
      : ["- No commands proposed."]),
    "",
    "### Backend Risk Reasons",
    ...plan.response.backendRisk.reasons.map((reason) => `- ${reason.message}`),
  ].join("\n");
}

async function enrichCRFromStoredPlan(
  client: Pick<TransactionClient, "approvalTicket" | "storedPlan">,
  cr: CR,
): Promise<CR> {
  const linkedApproval = await client.approvalTicket.findFirst({
    where: { crId: cr.id },
    select: { requestJson: true },
  });
  if (!linkedApproval) {
    return cr;
  }

  const request = parseJson(linkedApproval.requestJson, {} as ApprovalRequest);
  const planRow = await client.storedPlan.findUnique({
    where: { planId: request.planId },
    select: { requestJson: true, responseJson: true, createdAt: true },
  });

  const plan = planRow
    ? ({
        request: parseJson(planRow.requestJson, {} as GeneratePlanRequest),
        response: parseJson(planRow.responseJson, {} as GeneratePlanResponse),
        createdAt: planRow.createdAt.toISOString(),
      } satisfies StoredPlanSnapshot)
    : undefined;

  if (!plan) {
    return {
      ...cr,
      review: request.risk.review,
      risk_reasons: request.risk.reasons,
      risk_breakdown: {
        local_score: request.risk.localScore,
        backend_score: request.risk.backendScore,
        final_score: request.risk.score,
      },
      evidence: toEvidenceFromRequest(request),
    };
  }

  return {
    ...cr,
    plan: buildPlanMarkdown(plan, request),
    proposed_commands: plan.response.proposedCommands,
    review: plan.response.review,
    risk_reasons: request.risk.reasons,
    risk_breakdown: {
      local_score: request.risk.localScore,
      backend_score: request.risk.backendScore,
      final_score: request.risk.score,
    },
    patch_summary: buildPatchSummary(plan),
    evidence: toEvidenceFromRequest(request),
  };
}

function toRequiredApprovals(score: number, policy: Policy): number {
  const threshold = policy.risk_thresholds.require_dual_approval_above ?? 101;
  return score >= threshold ? 2 : 1;
}

function toEvidenceFromRequest(request: ApprovalRequest): CR["evidence"] {
  if (request.verificationEvidence && request.verificationEvidence.length > 0) {
    return request.verificationEvidence.map((item) => ({
      type: item.type,
      status: item.status,
      kind: item.kind,
      name: item.name,
      command: item.command,
      scope: item.scope,
      url: item.url,
      summary: item.summary,
      details: item.details,
    }));
  }

  return [
    {
      type: "test",
      status: "skipped",
      kind: "recommended",
      name: "Automated tests",
      command: "npm test",
      summary: "Recommended check: tests were not executed before approval.",
    },
    {
      type: "lint",
      status: "skipped",
      kind: "recommended",
      name: "Lint checks",
      command: "npm run lint",
      summary: "Recommended check: lint was not executed before approval.",
    },
  ];
}

function toRiskLevel(score: number): RiskLevel {
  if (score >= 70) {
    return "high";
  }

  if (score >= 40) {
    return "med";
  }

  return "low";
}

function countLines(text: string): number {
  if (!text) {
    return 0;
  }
  return text.split("\n").length;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseJson<T>(value: Prisma.JsonValue | null | undefined, fallback: T): T {
  if (value === undefined || value === null) {
    return fallback;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return fallback;
  }
}
