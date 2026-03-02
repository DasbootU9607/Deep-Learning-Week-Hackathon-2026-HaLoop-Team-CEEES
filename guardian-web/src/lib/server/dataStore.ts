import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { mockAuditLogs } from "@/_mocks/audit";
import { mockCRs } from "@/_mocks/cr";
import { AuditFilters, AuditLog } from "@/types/audit";
import { CR, CRFilters, CRListItem, PatchFile, RiskLevel } from "@/types/cr";
import { PathRule, Policy } from "@/types/policy";
import {
  ApprovalDecisionEvent,
  ApprovalRequest,
  GeneratePlanRequest,
  GeneratePlanResponse,
} from "@/lib/server/contracts";

type StoredPlan = {
  request: GeneratePlanRequest;
  response: GeneratePlanResponse;
  createdAt: string;
};

type ApprovalTicket = {
  request: ApprovalRequest;
  crId: string;
  status: "pending" | "approved" | "denied";
  decision?: ApprovalDecisionEvent;
};

type StoreState = {
  policy: Policy;
  crs: CR[];
  audits: AuditLog[];
  plans: Record<string, StoredPlan>;
  approvals: Record<string, ApprovalTicket>;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "integration-store.json");

let writeChain: Promise<unknown> = Promise.resolve();

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

export async function saveGeneratedPlan(params: {
  request: GeneratePlanRequest;
  response: GeneratePlanResponse;
}): Promise<void> {
  await withWrite(async (db) => {
    db.plans[params.response.planId] = {
      request: params.request,
      response: params.response,
      createdAt: new Date().toISOString(),
    };
  });
}

export async function getApprovalDecision(approvalId: string): Promise<ApprovalDecisionEvent | undefined> {
  const db = await readStore();
  return db.approvals[approvalId]?.decision;
}

export async function createApprovalTicket(request: ApprovalRequest): Promise<ApprovalRequest> {
  return withWrite(async (db) => {
    const existing = db.approvals[request.approvalId];
    if (existing) {
      return existing.request;
    }

    const plan = db.plans[request.planId];
    const cr = toCRFromApproval(request, plan);
    db.crs.unshift(cr);

    db.approvals[request.approvalId] = {
      request,
      crId: cr.id,
      status: "pending",
    };

    appendAudit(db, {
      actor_id: request.requestedBy,
      actor_name: request.requestedBy,
      action: "cr_submitted",
      target_cr_id: cr.id,
      target_cr_title: cr.title,
      risk_level: cr.risk_level,
      details: {
        source: "ide-plugin",
        approval_id: request.approvalId,
      },
    });

    return request;
  });
}

export async function listCRs(filters: CRFilters = {}): Promise<CRListItem[]> {
  const db = await readStore();
  const filtered = db.crs.filter((cr) => matchCRFilters(cr, filters));

  return filtered
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
    .map((cr) => ({
      id: cr.id,
      repo: cr.repo,
      branch: cr.branch,
      title: cr.title,
      created_at: cr.created_at,
      updated_at: cr.updated_at,
      created_by_name: cr.created_by_name,
      status: cr.status,
      risk_score: cr.risk_score,
      risk_level: cr.risk_level,
      approvals_count: cr.approvals.filter((approval) => approval.action === "approved").length,
      required_approvals: cr.required_approvals,
      labels: cr.labels,
    }));
}

export async function getCRById(id: string): Promise<CR | undefined> {
  const db = await readStore();
  return db.crs.find((cr) => cr.id === id);
}

export async function applyReviewAction(params: {
  crId: string;
  action: "approved" | "rejected" | "changes_requested";
  reviewer?: string;
  comment?: string;
}): Promise<CR | undefined> {
  return withWrite(async (db) => {
    const cr = db.crs.find((candidate) => candidate.id === params.crId);
    if (!cr) {
      return undefined;
    }

    const now = new Date().toISOString();
    const reviewer = params.reviewer ?? "Web Reviewer";

    cr.approvals.push({
      id: randomUUID(),
      reviewer_id: reviewer.toLowerCase().replace(/\s+/g, "-"),
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

    const linkedApproval = Object.values(db.approvals).find((ticket) => ticket.crId === cr.id);
    if (linkedApproval) {
      const isApproved = params.action === "approved" && cr.status === "approved";
      if (isApproved || params.action === "rejected" || params.action === "changes_requested") {
        linkedApproval.status = isApproved ? "approved" : "denied";
        linkedApproval.decision = {
          approvalId: linkedApproval.request.approvalId,
          decision: isApproved ? "approved" : "denied",
          reviewer,
          reason:
            params.comment ??
            (params.action === "changes_requested" ? "Changes requested by reviewer." : undefined),
          decidedAt: now,
        };
      }
    }

    appendAudit(db, {
      actor_id: reviewer.toLowerCase().replace(/\s+/g, "-"),
      actor_name: reviewer,
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

    return cr;
  });
}

export async function listAuditLogs(filters: AuditFilters = {}): Promise<AuditLog[]> {
  const db = await readStore();

  return db.audits
    .filter((entry) => matchAuditFilters(entry, filters))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

export async function getActivePolicy(): Promise<Policy> {
  const db = await readStore();
  return db.policy;
}

export async function updatePathRules(rules: PathRule[]): Promise<Policy> {
  return withWrite(async (db) => {
    db.policy.path_rules = rules;
    db.policy.version += 1;
    db.policy.updated_at = new Date().toISOString();

    appendAudit(db, {
      actor_id: "policy-admin",
      actor_name: "Policy Admin",
      action: "policy_updated",
      target_policy_id: db.policy.id,
      details: { rule_count: rules.length },
      risk_level: "med",
    });

    return db.policy;
  });
}

async function readStore(): Promise<StoreState> {
  await ensureStoreFile();

  const raw = await fs.readFile(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw) as StoreState;

  if (!parsed.plans) {
    parsed.plans = {};
  }
  if (!parsed.approvals) {
    parsed.approvals = {};
  }

  return parsed;
}

async function writeStore(data: StoreState): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

async function ensureStoreFile(): Promise<void> {
  try {
    await fs.access(DATA_FILE);
  } catch {
    const initial = createDefaultStore();
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

function withWrite<T>(mutate: (state: StoreState) => Promise<T> | T): Promise<T> {
  const operation = async (): Promise<T> => {
    const state = await readStore();
    const result = await mutate(state);
    await writeStore(state);
    return result;
  };

  const next = writeChain.then(operation, operation);
  writeChain = next.then(
    () => undefined,
    () => undefined,
  );

  return next;
}

function createDefaultStore(): StoreState {
  return {
    policy: deepClone(DEFAULT_POLICY),
    crs: deepClone(mockCRs),
    audits: deepClone(mockAuditLogs),
    plans: {},
    approvals: {},
  };
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function appendAudit(
  store: StoreState,
  payload: Omit<AuditLog, "id" | "timestamp">,
): void {
  store.audits.push({
    id: `log-${randomUUID()}`,
    timestamp: new Date().toISOString(),
    ...payload,
  });
}

function matchCRFilters(cr: CR, filters: CRFilters): boolean {
  if (filters.repo && filters.repo !== "all" && cr.repo !== filters.repo) {
    return false;
  }

  if (filters.status && filters.status !== "all" && cr.status !== filters.status) {
    return false;
  }

  if (filters.risk_level && filters.risk_level !== "all" && cr.risk_level !== filters.risk_level) {
    return false;
  }

  if (filters.search) {
    const search = filters.search.toLowerCase();
    const haystack = [cr.title, cr.repo, cr.branch, cr.created_by_name].join(" ").toLowerCase();
    if (!haystack.includes(search)) {
      return false;
    }
  }

  return true;
}

function matchAuditFilters(log: AuditLog, filters: AuditFilters): boolean {
  if (filters.action && filters.action !== "all" && log.action !== filters.action) {
    return false;
  }

  if (filters.actor && !log.actor_name.toLowerCase().includes(filters.actor.toLowerCase())) {
    return false;
  }

  if (filters.risk_level && filters.risk_level !== "all" && log.risk_level !== filters.risk_level) {
    return false;
  }

  if (filters.date_from) {
    const from = Date.parse(filters.date_from);
    if (!Number.isNaN(from) && Date.parse(log.timestamp) < from) {
      return false;
    }
  }

  if (filters.date_to) {
    const to = Date.parse(filters.date_to);
    if (!Number.isNaN(to) && Date.parse(log.timestamp) > to) {
      return false;
    }
  }

  if (filters.repo) {
    const logRepo = String(log.details?.repo ?? "");
    if (logRepo && logRepo !== filters.repo) {
      return false;
    }
  }

  return true;
}

function toCRFromApproval(request: ApprovalRequest, plan?: StoredPlan): CR {
  const now = new Date().toISOString();

  const repo = plan ? path.basename(plan.request.context.workspaceRoot) : "workspace";
  const branch = plan?.request.context.branch ?? "ai/generated";

  const riskLevel = toRiskLevel(request.risk.score);
  const patchSummary = buildPatchSummary(plan);

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
    patch_summary: patchSummary,
    blast_radius: buildBlastRadius(patchSummary, repo),
    evidence: [
      {
        type: "test",
        status: "skipped",
        name: "Automated tests",
        summary: "Tests were not run yet; awaiting approval.",
      },
      {
        type: "lint",
        status: "skipped",
        name: "Lint checks",
        summary: "Not executed while waiting for approval.",
      },
    ],
    approvals: [],
    required_approvals: 1,
    labels: ["plugin", "approval-required"],
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
      risk_rules_hit: plan.response.backendRisk.reasons.slice(0, 2),
      risk_level: toRiskLevel(plan.response.backendRisk.score),
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
    "### Proposed File Changes",
    ...changeLines,
    "",
    "### Backend Risk Reasons",
    ...plan.response.backendRisk.reasons.map((reason) => `- ${reason}`),
  ].join("\n");
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
