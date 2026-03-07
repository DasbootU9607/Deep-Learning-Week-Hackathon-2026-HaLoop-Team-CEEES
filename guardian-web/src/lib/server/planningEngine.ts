import { randomUUID } from "node:crypto";
import { Policy, PathRule } from "@/types/policy";
import {
  FileChange,
  GeneratePlanRequest,
  GeneratePlanResponse,
  MatchedPolicyRule,
  ReviewDecision,
  RiskReason,
} from "@/lib/server/contracts";

type RiskLevel = "low" | "medium" | "high";

const DESTRUCTIVE_COMMAND_PATTERN =
  /(rm\s+-rf|drop\s+database|truncate\b|git\s+reset\s+--hard|terraform\s+destroy)/i;
const SECRET_PATTERN =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_-]?key|token|secret)\s*[:=]\s*["'][^"']+["']/i;
const PROTECTED_PATH_PATTERNS = [
  /(^|\/)auth(\/|$)/i,
  /(^|\/)migrations(\/|$)/i,
  /(^|\/)schema\.sql$/i,
  /(^|\/)package\.json$/i,
  /(^|\/)infra(\/|$)/i,
];
const SMALL_BLAST_RADIUS_MAX_FILES = 2;
const SMALL_DIFF_SIZE_MAX_LINES = 120;

export function generatePlanFromPrompt(
  request: GeneratePlanRequest,
  policy: Policy,
): GeneratePlanResponse {
  const promptLower = request.prompt.toLowerCase();
  const changes = inferChanges(request);
  const proposedCommands = inferCommands(promptLower);
  const { backendRisk, review } = analyzePlan({
    prompt: request.prompt,
    changes,
    proposedCommands,
    policy,
  });

  const summary = [
    `Proposed ${changes.length} change(s) for branch ${request.context.branch}.`,
    `Backend risk is ${backendRisk.level.toUpperCase()} (${backendRisk.score}/100).`,
    summarizeReviewMode(review.mode),
  ].join(" ");

  return {
    planId: randomUUID(),
    summary,
    changes,
    proposedCommands,
    backendRisk,
    review,
  };
}

function analyzePlan(params: {
  prompt: string;
  changes: FileChange[];
  proposedCommands: string[];
  policy: Policy;
}): {
  backendRisk: GeneratePlanResponse["backendRisk"];
  review: ReviewDecision;
} {
  const reasons: RiskReason[] = [];
  const matchedPolicyRules = new Map<string, MatchedPolicyRule>();
  const semanticMessages = new Set<string>();
  let score = 12;

  for (const command of params.proposedCommands) {
    if (!DESTRUCTIVE_COMMAND_PATTERN.test(command)) {
      continue;
    }

    score += 80;
    reasons.push({
      source: "backend",
      category: "command",
      message: `Destructive command detected: ${command}`,
      weight: 80,
    });
  }

  for (const change of params.changes) {
    const normalizedPath = normalizePath(change.path);

    for (const rule of params.policy.path_rules) {
      if (!globMatch(normalizedPath, rule.pattern)) {
        continue;
      }

      addMatchedPolicyRule(matchedPolicyRules, rule, normalizedPath);

      if (rule.type === "deny") {
        score += 90;
        reasons.push({
          source: "policy",
          category: "path",
          message: `Policy blocks edits to ${normalizedPath} via rule ${rule.pattern}.`,
          affectedPath: normalizedPath,
          weight: 90,
        });
      } else if (rule.type === "require_approval") {
        score += 60;
        reasons.push({
          source: "policy",
          category: "path",
          message: `Protected path rule ${rule.pattern} requires approval for ${normalizedPath}.`,
          affectedPath: normalizedPath,
          weight: 60,
        });
      }
    }

    const semanticReason = toSemanticPathReason(normalizedPath, params.prompt);
    if (semanticReason && !semanticMessages.has(semanticReason.message)) {
      semanticMessages.add(semanticReason.message);
      reasons.push(semanticReason);
      score += semanticReason.weight;
    }

    if (change.newContent && SECRET_PATTERN.test(change.newContent)) {
      score += 60;
      reasons.push({
        source: "backend",
        category: "secret",
        message: `Potential secret content detected in ${normalizedPath}.`,
        affectedPath: normalizedPath,
        weight: 60,
      });
    }
  }

  if (params.changes.length > SMALL_BLAST_RADIUS_MAX_FILES) {
    const blastWeight = params.changes.length > 5 ? 30 : 18;
    score += blastWeight;
    reasons.push({
      source: "backend",
      category: "blast_radius",
      message: `Blast radius includes ${params.changes.length} files, which is above the low-risk limit of ${SMALL_BLAST_RADIUS_MAX_FILES}.`,
      weight: blastWeight,
    });
  }

  const totalChangedLines = params.changes.reduce((sum, change) => {
    if (!change.newContent) {
      return sum;
    }
    return sum + countLines(change.newContent);
  }, 0);

  if (totalChangedLines > SMALL_DIFF_SIZE_MAX_LINES) {
    const diffWeight = totalChangedLines > 250 ? 20 : 12;
    score += diffWeight;
    reasons.push({
      source: "backend",
      category: "diff_size",
      message: `Diff size is ${totalChangedLines} lines, above the low-risk limit of ${SMALL_DIFF_SIZE_MAX_LINES}.`,
      weight: diffWeight,
    });
  }

  score = clamp(score, 0, 100);

  const level =
    score <= params.policy.risk_thresholds.low_max
      ? "low"
      : score <= params.policy.risk_thresholds.med_max
        ? "medium"
        : "high";

  if (reasons.length === 0) {
    reasons.push({
      source: "backend",
      category: "diff_size",
      message: "No elevated risk signals detected.",
      weight: 0,
    });
  }

  const review = buildReviewDecision({
    score,
    level,
    reasons,
    changes: params.changes,
    matchedPolicyRules: Array.from(matchedPolicyRules.values()),
    policy: params.policy,
    totalChangedLines,
    proposedCommands: params.proposedCommands,
  });

  return {
    backendRisk: {
      score,
      level,
      reasons,
    },
    review,
  };
}

function buildReviewDecision(params: {
  score: number;
  level: RiskLevel;
  reasons: RiskReason[];
  changes: FileChange[];
  matchedPolicyRules: MatchedPolicyRule[];
  policy: Policy;
  totalChangedLines: number;
  proposedCommands: string[];
}): ReviewDecision {
  const hasDestructiveCommand = params.proposedCommands.some((command) =>
    DESTRUCTIVE_COMMAND_PATTERN.test(command),
  );
  const hasProtectedPath = params.changes.some((change) =>
    PROTECTED_PATH_PATTERNS.some((pattern) => pattern.test(normalizePath(change.path))),
  );
  const hasSecret = params.reasons.some((reason) => reason.category === "secret");
  const hasDeniedRule = params.matchedPolicyRules.some((rule) => rule.type === "deny");
  const hasRequireApprovalRule = params.matchedPolicyRules.some(
    (rule) => rule.type === "require_approval",
  );

  const guardrailsPassed = {
    destructiveCommands: !hasDestructiveCommand,
    protectedPaths: !hasProtectedPath,
    secrets: !hasSecret,
    blastRadius: params.changes.length <= SMALL_BLAST_RADIUS_MAX_FILES,
    diffSize: params.totalChangedLines <= SMALL_DIFF_SIZE_MAX_LINES,
  };

  const autoApproveBelow =
    params.policy.risk_thresholds.auto_approve_below ?? params.policy.risk_thresholds.low_max;

  if (hasDeniedRule) {
    const deniedRule = params.matchedPolicyRules.find((rule) => rule.type === "deny");
    return {
      mode: "blocked",
      rationale: [
        `Policy rule ${deniedRule?.pattern ?? "unknown"} blocks this request outright.`,
        deniedRule?.matchedPaths.length
          ? `Blocked paths: ${deniedRule.matchedPaths.join(", ")}.`
          : "A denied path rule was matched.",
      ],
      matchedPolicyRules: params.matchedPolicyRules,
      guardrailsPassed,
    };
  }

  const isStrictLowRisk =
    params.score < autoApproveBelow &&
    Object.values(guardrailsPassed).every(Boolean) &&
    params.level === "low";

  if (isStrictLowRisk) {
    return {
      mode: "auto_approved",
      rationale: [
        `Risk score is ${params.score}, below the auto-approve threshold of ${autoApproveBelow}.`,
        `Only ${params.changes.length} file(s) and ${params.totalChangedLines} line(s) are affected.`,
        "Auto-approved because no protected paths, destructive commands, or secret patterns were detected.",
      ],
      matchedPolicyRules: params.matchedPolicyRules,
      guardrailsPassed,
    };
  }

  const requiresApproval =
    params.score > params.policy.risk_thresholds.med_max ||
    hasRequireApprovalRule ||
    !guardrailsPassed.destructiveCommands ||
    !guardrailsPassed.protectedPaths ||
    !guardrailsPassed.secrets;

  if (requiresApproval) {
    return {
      mode: "approval_required",
      rationale: [
        `Approval required because risk score is ${params.score}.`,
        ...toTopRationaleLines(params.reasons, 2),
        params.matchedPolicyRules.length > 0
          ? `Matched policy rules: ${params.matchedPolicyRules
              .map((rule) => `${rule.pattern} (${rule.type})`)
              .join(", ")}.`
          : "No allowlisted low-risk exception applied.",
      ],
      matchedPolicyRules: params.matchedPolicyRules,
      guardrailsPassed,
    };
  }

  return {
    mode: "warning",
    rationale: [
      `Manual approval is not required, but risk score is ${params.score} so review is recommended.`,
      ...toTopRationaleLines(params.reasons, 2),
      `The request affects ${params.changes.length} file(s) and ${params.totalChangedLines} line(s).`,
    ],
    matchedPolicyRules: params.matchedPolicyRules,
    guardrailsPassed,
  };
}

function inferChanges(request: GeneratePlanRequest): FileChange[] {
  const prompt = request.prompt.toLowerCase();
  const explicitDelete = /\b(delete|remove)\b/.test(prompt);

  const primaryPath =
    inferPathFromPrompt(prompt) ??
    request.context.activeFile ??
    "src/ai/generated-change.ts";

  if (explicitDelete) {
    return [
      {
        path: primaryPath,
        action: "delete",
      },
    ];
  }

  const action: "create" | "update" = request.context.activeFile ? "update" : "create";

  const content = [
    "// AI-generated draft change.",
    `// Prompt: ${request.prompt}`,
    `// Session: ${request.sessionId}`,
    "",
    "export const aiGovDraft = true;",
  ].join("\n");

  const changes: FileChange[] = [
    {
      path: primaryPath,
      action,
      newContent: content,
    },
  ];

  if (/test|spec/.test(prompt)) {
    const testPath = primaryPath.endsWith(".ts")
      ? primaryPath.replace(/\.ts$/, ".test.ts")
      : `${primaryPath}.test.ts`;
    changes.push({
      path: testPath,
      action: "create",
      newContent: [
        "describe('ai-generated change', () => {",
        "  it('is a placeholder', () => {",
        "    expect(true).toBe(true);",
        "  });",
        "});",
      ].join("\n"),
    });
  }

  if (/(refactor|multi-file|workflow|cross-module)/.test(prompt)) {
    const supportPaths = [
      "src/ai/generated-helper.ts",
      "src/ai/generated-workflow.ts",
    ];

    for (const supportPath of supportPaths) {
      changes.push({
        path: supportPath,
        action: "create",
        newContent: buildExpandedDraft(request.prompt, supportPath),
      });
    }
  }

  return changes;
}

function inferPathFromPrompt(prompt: string): string | undefined {
  if (/(auth|login|permission|jwt)/.test(prompt)) {
    return "src/auth/guard.ts";
  }

  if (/(migrat|schema|database|db)/.test(prompt)) {
    return "db/migrations/20260302_auto.sql";
  }

  if (/package\.json|dependency|dependencies|npm/.test(prompt)) {
    return "package.json";
  }

  if (/(infra|terraform|k8s|helm)/.test(prompt) && /\b(prod|production)\b/.test(prompt)) {
    return "infra/prod/deployment.yaml";
  }

  if (/(infra|terraform|k8s|helm)/.test(prompt)) {
    return "infra/deployment.yaml";
  }

  if (/test|spec/.test(prompt)) {
    return "src/ai/generated.test.ts";
  }

  return undefined;
}

function inferCommands(promptLower: string): string[] {
  const commands: string[] = [];

  if (/test|spec|unit/.test(promptLower)) {
    commands.push("npm test");
  }

  if (/lint|format|style/.test(promptLower)) {
    commands.push("npm run lint");
  }

  if (/migrat|schema|database|db/.test(promptLower)) {
    commands.push("npm run migrate");
  }

  if (DESTRUCTIVE_COMMAND_PATTERN.test(promptLower)) {
    commands.push("git reset --hard");
  }

  return commands;
}

function buildExpandedDraft(prompt: string, filePath: string): string {
  const lines = Array.from({ length: 48 }, (_, index) => {
    return `export const generatedLine${index + 1} = "${filePath}:${index + 1}:${prompt.slice(0, 24)}";`;
  });

  return [
    "// AI-generated expanded draft for multi-file review.",
    ...lines,
  ].join("\n");
}

function addMatchedPolicyRule(
  matchedPolicyRules: Map<string, MatchedPolicyRule>,
  rule: PathRule,
  matchedPath: string,
): void {
  const existing = matchedPolicyRules.get(rule.id);
  if (existing) {
    if (!existing.matchedPaths.includes(matchedPath)) {
      existing.matchedPaths.push(matchedPath);
    }
    return;
  }

  matchedPolicyRules.set(rule.id, {
    id: rule.id,
    pattern: rule.pattern,
    type: rule.type,
    description: rule.description,
    matchedPaths: [matchedPath],
  });
}

function toSemanticPathReason(path: string, prompt: string): RiskReason | undefined {
  if (/(^|\/)auth(\/|$)|login|permission|jwt/i.test(path) || /auth|login|permission|jwt/i.test(prompt)) {
    return {
      source: "backend",
      category: "path",
      message:
        "This request modifies authentication code, so it is treated as identity/security-sensitive.",
      affectedPath: path,
      weight: 24,
    };
  }

  if (/(^|\/)migrations(\/|$)|schema\.sql$/i.test(path) || /migrat|schema|database|db/i.test(prompt)) {
    return {
      source: "backend",
      category: "path",
      message:
        "This request changes database structure, so rollback complexity and data integrity risk are higher.",
      affectedPath: path,
      weight: 22,
    };
  }

  if (/(^|\/)package\.json$/i.test(path) || /package\.json|dependency|dependencies|npm/i.test(prompt)) {
    return {
      source: "backend",
      category: "path",
      message:
        "This request changes dependencies, which can affect supply-chain trust and runtime behavior.",
      affectedPath: path,
      weight: 18,
    };
  }

  if (/(^|\/)infra(\/|$)/i.test(path) || /infra|terraform|k8s|helm/i.test(prompt)) {
    return {
      source: "backend",
      category: "path",
      message:
        "This request modifies infrastructure or deployment configuration, so service blast radius is elevated.",
      affectedPath: path,
      weight: 18,
    };
  }

  return undefined;
}

function toTopRationaleLines(reasons: RiskReason[], maxItems: number): string[] {
  return reasons
    .filter((reason) => reason.weight > 0)
    .slice(0, maxItems)
    .map((reason) => reason.message);
}

function summarizeReviewMode(mode: ReviewDecision["mode"]): string {
  switch (mode) {
    case "auto_approved":
      return "Review mode: auto-approved.";
    case "warning":
      return "Review mode: warning.";
    case "approval_required":
      return "Review mode: approval required.";
    case "blocked":
      return "Review mode: blocked by policy.";
  }
}

function globMatch(input: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "::DOUBLE_STAR::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DOUBLE_STAR::/g, ".*");

  const regex = new RegExp(`^${escaped}$`);
  return regex.test(input);
}

function countLines(text: string): number {
  if (text.length === 0) {
    return 0;
  }
  return text.split("\n").length;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
