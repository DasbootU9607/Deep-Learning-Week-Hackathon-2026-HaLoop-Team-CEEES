import { randomUUID } from "node:crypto";
import { Policy } from "@/types/policy";
import { FileChange, GeneratePlanRequest, GeneratePlanResponse } from "@/lib/server/contracts";

type RiskLevel = "low" | "medium" | "high";

const DESTRUCTIVE_COMMAND_PATTERN = /(rm\s+-rf|drop\s+database|truncate\b|git\s+reset\s+--hard|terraform\s+destroy)/i;
const SECRET_PATTERN = /-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_-]?key|token|secret)\s*[:=]\s*["'][^"']+["']/i;

export function generatePlanFromPrompt(
  request: GeneratePlanRequest,
  policy: Policy,
): GeneratePlanResponse {
  const promptLower = request.prompt.toLowerCase();
  const changes = inferChanges(request);
  const proposedCommands = inferCommands(promptLower);

  const { score, level, reasons } = scoreRisk({
    changes,
    proposedCommands,
    policy,
  });

  const summary = [
    `Proposed ${changes.length} change(s) for branch ${request.context.branch}.`,
    `Backend risk is ${level.toUpperCase()} (${score}/100).`,
  ].join(" ");

  return {
    planId: randomUUID(),
    summary,
    changes,
    proposedCommands,
    backendRisk: {
      score,
      level,
      reasons,
    },
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

  if (/migrat|schema|database|db/.test(promptLower)) {
    commands.push("npm run migrate");
  }

  if (DESTRUCTIVE_COMMAND_PATTERN.test(promptLower)) {
    commands.push("git reset --hard");
  }

  return commands;
}

function scoreRisk(params: {
  changes: FileChange[];
  proposedCommands: string[];
  policy: Policy;
}): { score: number; level: RiskLevel; reasons: string[] } {
  const reasons: string[] = [];
  let score = 15;

  for (const command of params.proposedCommands) {
    if (DESTRUCTIVE_COMMAND_PATTERN.test(command)) {
      score += 80;
      reasons.push(`Destructive command detected: ${command}`);
    }
  }

  for (const change of params.changes) {
    for (const rule of params.policy.path_rules) {
      if (!globMatch(change.path, rule.pattern)) {
        continue;
      }

      if (rule.type === "deny") {
        score += 90;
        reasons.push(`Denied by policy rule ${rule.pattern}`);
      } else if (rule.type === "require_approval") {
        score += 60;
        reasons.push(`Approval required by policy rule ${rule.pattern}`);
      } else {
        reasons.push(`Allowed by policy rule ${rule.pattern}`);
      }
    }

    if (change.newContent && SECRET_PATTERN.test(change.newContent)) {
      score += 20;
      reasons.push(`Potential secret content detected in ${change.path}`);
    }
  }

  if (params.changes.length > 5) {
    score += 30;
    reasons.push("Large blast radius: more than 5 files changed");
  }

  const totalChangedLines = params.changes.reduce((sum, change) => {
    if (!change.newContent) {
      return sum;
    }
    return sum + countLines(change.newContent);
  }, 0);

  if (totalChangedLines > 250) {
    score += 20;
    reasons.push("Large diff size: more than 250 lines");
  }

  score = clamp(score, 0, 100);

  const level =
    score <= params.policy.risk_thresholds.low_max
      ? "low"
      : score <= params.policy.risk_thresholds.med_max
      ? "medium"
      : "high";

  if (reasons.length === 0) {
    reasons.push("No elevated risk signals detected.");
  }

  return { score, level, reasons };
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
