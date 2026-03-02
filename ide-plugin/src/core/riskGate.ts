import { GeneratePlanResponse } from "../schemas/contracts";

export type RiskDecision = "ALLOW" | "ALLOW_WITH_WARNING" | "REQUIRE_APPROVAL";

export type RiskEvaluation = {
  localRiskScore: number;
  finalRiskScore: number;
  decision: RiskDecision;
  reasons: string[];
  warning?: string;
};

const destructiveCommandPatterns = [
  /\brm\s+-rf\b/i,
  /\bdrop\s+database\b/i,
  /\btruncate\b/i,
  /\bgit\s+reset\s+--hard\b/i
];

const protectedPathPatterns = [/(^|\/)auth(\/|$)/i, /(^|\/)migrations(\/|$)/i, /(^|\/)schema\.sql$/i, /(^|\/)package\.json$/i];

const secretPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /(api[_-]?key|secret|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i,
  /AKIA[0-9A-Z]{16}/
];

export class RiskGate {
  public evaluate(plan: GeneratePlanResponse): RiskEvaluation {
    let localRiskScore = 0;
    const reasons: string[] = [];

    if (plan.proposedCommands.some((command) => destructiveCommandPatterns.some((pattern) => pattern.test(command)))) {
      localRiskScore += 80;
      reasons.push("Destructive command pattern detected.");
    }

    if (plan.changes.some((change) => protectedPathPatterns.some((pattern) => pattern.test(normalizePath(change.path))))) {
      localRiskScore += 60;
      reasons.push("Protected file path is affected.");
    }

    if (plan.changes.length > 5) {
      localRiskScore += 30;
      reasons.push("Large blast radius: more than 5 files.");
    }

    const totalModifiedLines = plan.changes.reduce((total, change) => {
      if (!change.newContent) {
        return total;
      }
      return total + change.newContent.split(/\r?\n/).length;
    }, 0);

    if (totalModifiedLines > 250) {
      localRiskScore += 20;
      reasons.push("Large diff size: more than 250 lines.");
    }

    if (
      plan.changes.some((change) => {
        const content = change.newContent;
        if (!content) {
          return false;
        }
        return secretPatterns.some((pattern) => pattern.test(content));
      })
    ) {
      localRiskScore += 20;
      reasons.push("Potential secrets detected in generated content.");
    }

    const finalRiskScore = Math.max(localRiskScore, plan.backendRisk.score);
    let decision: RiskDecision = "ALLOW";
    let warning: string | undefined;

    if (finalRiskScore >= 70) {
      decision = "REQUIRE_APPROVAL";
      reasons.push("Final risk >= 70, approval required.");
    } else if (finalRiskScore >= 40) {
      decision = "ALLOW_WITH_WARNING";
      warning = "Moderate risk detected. Applying is allowed but should be reviewed.";
      reasons.push("Final risk between 40 and 69.");
    }

    return {
      localRiskScore,
      finalRiskScore,
      decision,
      reasons,
      warning
    };
  }
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}
