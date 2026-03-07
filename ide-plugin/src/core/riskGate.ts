import type { GeneratePlanResponse, ReviewDecision, RiskReason } from "../schemas/contracts";

export type RiskDecision = "ALLOW" | "ALLOW_WITH_WARNING" | "REQUIRE_APPROVAL" | "BLOCKED";

export type RiskEvaluation = {
  localRiskScore: number;
  backendRiskScore: number;
  finalRiskScore: number;
  decision: RiskDecision;
  reasons: RiskReason[];
  rationale: string[];
  matchedPolicyRules: ReviewDecision["matchedPolicyRules"];
  guardrailsPassed: ReviewDecision["guardrailsPassed"];
  warning?: string;
};

const destructiveCommandPatterns = [
  /\brm\s+-rf\b/i,
  /\bdrop\s+database\b/i,
  /\btruncate\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bterraform\s+destroy\b/i,
];

const protectedPathPatterns = [
  /(^|\/)auth(\/|$)/i,
  /(^|\/)migrations(\/|$)/i,
  /(^|\/)schema\.sql$/i,
  /(^|\/)package\.json$/i,
  /(^|\/)infra(\/|$)/i,
];

const secretPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /(api[_-]?key|secret|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i,
  /AKIA[0-9A-Z]{16}/,
];

const LOW_RISK_FILE_LIMIT = 2;
const LOW_RISK_LINE_LIMIT = 120;

export class RiskGate {
  public evaluate(plan: GeneratePlanResponse): RiskEvaluation {
    let localRiskScore = 0;
    const localReasons: RiskReason[] = [];

    for (const command of plan.proposedCommands) {
      if (!destructiveCommandPatterns.some((pattern) => pattern.test(command))) {
        continue;
      }

      localRiskScore += 80;
      localReasons.push({
        source: "plugin",
        category: "command",
        message: `Plugin detected a destructive command: ${command}`,
        weight: 80,
      });
    }

    const protectedChanges = plan.changes.filter((change) =>
      protectedPathPatterns.some((pattern) => pattern.test(normalizePath(change.path))),
    );
    if (protectedChanges.length > 0) {
      localRiskScore += 60;
      for (const change of protectedChanges) {
        localReasons.push({
          source: "plugin",
          category: "path",
          message: `Plugin marked ${change.path} as a protected path.`,
          affectedPath: change.path,
          weight: 60,
        });
      }
    }

    if (plan.changes.length > LOW_RISK_FILE_LIMIT) {
      const weight = plan.changes.length > 5 ? 30 : 18;
      localRiskScore += weight;
      localReasons.push({
        source: "plugin",
        category: "blast_radius",
        message: `Plugin observed a blast radius of ${plan.changes.length} files.`,
        weight,
      });
    }

    const totalModifiedLines = plan.changes.reduce((total, change) => {
      if (!change.newContent) {
        return total;
      }
      return total + change.newContent.split(/\r?\n/).length;
    }, 0);

    if (totalModifiedLines > LOW_RISK_LINE_LIMIT) {
      const weight = totalModifiedLines > 250 ? 20 : 12;
      localRiskScore += weight;
      localReasons.push({
        source: "plugin",
        category: "diff_size",
        message: `Plugin observed a diff size of ${totalModifiedLines} lines.`,
        weight,
      });
    }

    for (const change of plan.changes) {
      const content = change.newContent;
      if (!content || !secretPatterns.some((pattern) => pattern.test(content))) {
        continue;
      }

      localRiskScore += 60;
      localReasons.push({
        source: "plugin",
        category: "secret",
        message: `Plugin detected a potential secret in ${change.path}.`,
        affectedPath: change.path,
        weight: 60,
      });
    }

    const backendRiskScore = plan.backendRisk.score;
    const finalRiskScore = Math.max(localRiskScore, backendRiskScore);
    const backendDecision = mapReviewMode(plan.review.mode);
    const localDecision = toLocalDecision(localRiskScore);
    const decision = compareDecisionSeverity(localDecision, backendDecision) >= 0
      ? localDecision
      : backendDecision;

    const guardrailsPassed = {
      destructiveCommands:
        plan.review.guardrailsPassed.destructiveCommands &&
        !localReasons.some((reason) => reason.category === "command"),
      protectedPaths:
        plan.review.guardrailsPassed.protectedPaths &&
        !localReasons.some((reason) => reason.category === "path"),
      secrets:
        plan.review.guardrailsPassed.secrets &&
        !localReasons.some((reason) => reason.category === "secret"),
      blastRadius:
        plan.review.guardrailsPassed.blastRadius &&
        !localReasons.some((reason) => reason.category === "blast_radius"),
      diffSize:
        plan.review.guardrailsPassed.diffSize &&
        !localReasons.some((reason) => reason.category === "diff_size"),
    };

    const rationale = dedupeStrings([
      ...plan.review.rationale,
      ...buildLocalRationale(plan.review.mode, backendRiskScore, localRiskScore, localReasons),
    ]);

    let warning: string | undefined;
    if (decision === "ALLOW_WITH_WARNING") {
      warning = "Moderate risk detected. Review is recommended before applying.";
    }
    if (decision === "BLOCKED") {
      warning = "Policy blocked this plan. It cannot be applied from the plugin.";
    }

    return {
      localRiskScore,
      backendRiskScore,
      finalRiskScore,
      decision,
      reasons: mergeReasons(plan.backendRisk.reasons, localReasons),
      rationale,
      matchedPolicyRules: plan.review.matchedPolicyRules,
      guardrailsPassed,
      warning,
    };
  }
}

function toLocalDecision(localRiskScore: number): RiskDecision {
  if (localRiskScore >= 70) {
    return "REQUIRE_APPROVAL";
  }
  if (localRiskScore >= 40) {
    return "ALLOW_WITH_WARNING";
  }
  return "ALLOW";
}

function mapReviewMode(mode: GeneratePlanResponse["review"]["mode"]): RiskDecision {
  switch (mode) {
    case "auto_approved":
      return "ALLOW";
    case "warning":
      return "ALLOW_WITH_WARNING";
    case "approval_required":
      return "REQUIRE_APPROVAL";
    case "blocked":
      return "BLOCKED";
  }
}

function compareDecisionSeverity(left: RiskDecision, right: RiskDecision): number {
  return severity(left) - severity(right);
}

function severity(decision: RiskDecision): number {
  switch (decision) {
    case "ALLOW":
      return 0;
    case "ALLOW_WITH_WARNING":
      return 1;
    case "REQUIRE_APPROVAL":
      return 2;
    case "BLOCKED":
      return 3;
  }
}

function mergeReasons(primary: RiskReason[], secondary: RiskReason[]): RiskReason[] {
  const deduped = new Map<string, RiskReason>();
  for (const reason of [...primary, ...secondary]) {
    const key = [
      reason.source,
      reason.category,
      reason.message,
      reason.affectedPath ?? "",
    ].join("::");
    if (!deduped.has(key)) {
      deduped.set(key, reason);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => b.weight - a.weight);
}

function buildLocalRationale(
  backendMode: GeneratePlanResponse["review"]["mode"],
  backendRiskScore: number,
  localRiskScore: number,
  localReasons: RiskReason[],
): string[] {
  const lines: string[] = [];

  if (localRiskScore > backendRiskScore && localReasons.length > 0) {
    lines.push(`Plugin safeguards raised the local score to ${localRiskScore}.`);
  }

  if (backendMode === "auto_approved" && localRiskScore >= 40) {
    lines.push("Local safeguards escalated this plan above backend auto-approval.");
  }

  return [
    ...lines,
    ...localReasons.slice(0, 2).map((reason) => reason.message),
  ];
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}
