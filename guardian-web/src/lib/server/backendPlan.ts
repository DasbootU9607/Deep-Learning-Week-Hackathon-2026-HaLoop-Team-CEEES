import { randomUUID } from "node:crypto";
import {
  GeneratePlanRequest,
  GeneratePlanResponse,
  generatePlanRequestSchema,
  generatePlanResponseSchema,
} from "@/lib/server/contracts";
import { getActivePolicy } from "@/lib/server/dataStore";
import { generatePlanFromPrompt } from "@/lib/server/planningEngine";

export interface GoalPlanOptions {
  goal: string;
  workspaceRoot?: string;
  branch?: string;
  activeFile?: string;
  selectedText?: string;
  openTabs?: string[];
  sessionId?: string;
}

export interface GoalPlanResult {
  request: GeneratePlanRequest;
  response: GeneratePlanResponse;
  compactPlan: Record<string, unknown>;
  riskScore: number;
}

export async function generatePlanForGoal(options: GoalPlanOptions): Promise<GoalPlanResult> {
  const payload = generatePlanRequestSchema.parse({
    sessionId: options.sessionId ?? randomUUID(),
    prompt: options.goal.trim(),
    context: {
      workspaceRoot: options.workspaceRoot?.trim() || "workspace",
      branch: options.branch?.trim() || "ai/generated",
      activeFile: options.activeFile?.trim() || undefined,
      selectedText: options.selectedText?.trim() || undefined,
      openTabs: options.openTabs ?? [],
    },
  });

  const policy = await getActivePolicy();
  const generated = generatePlanFromPrompt(payload, policy);
  const response = generatePlanResponseSchema.parse(generated);

  return {
    request: payload,
    response,
    compactPlan: toCompactPlan(options.goal, response),
    riskScore: response.backendRisk.score / 100,
  };
}

function toCompactPlan(goal: string, response: GeneratePlanResponse): Record<string, unknown> {
  return {
    task_name: deriveTaskName(goal),
    summary: response.summary,
    estimated_risk: response.backendRisk.level,
    commands: response.proposedCommands,
    required_dependencies: inferDependencies(response),
    touched_paths: response.changes.map((change) => change.path),
    changes: response.changes.map((change) => ({
      path: change.path,
      action: change.action,
    })),
    risk_reasons: response.backendRisk.reasons,
  };
}

function deriveTaskName(goal: string): string {
  const cleaned = goal.trim();
  if (!cleaned) {
    return "AI generated task";
  }

  if (cleaned.length <= 72) {
    return cleaned;
  }

  return `${cleaned.slice(0, 69)}...`;
}

function inferDependencies(response: GeneratePlanResponse): string[] {
  const dependencies = new Set<string>();

  for (const command of response.proposedCommands) {
    const npmMatch = command.match(/npm\s+(?:i|install)\s+([@a-z0-9._/-]+)/i);
    if (npmMatch?.[1]) {
      dependencies.add(npmMatch[1]);
    }
  }

  const touchesPackageJson = response.changes.some((change) => /(^|\/)package\.json$/i.test(change.path));
  if (touchesPackageJson) {
    dependencies.add("package.json");
  }

  return Array.from(dependencies);
}
