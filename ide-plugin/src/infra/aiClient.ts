import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { Logger } from "./logger";
import { getConfiguredBackendUrl, resolveBackendUrl } from "./backendUrl";
import { GeneratePlanRequest, GeneratePlanResponse, generatePlanResponseSchema } from "../schemas/contracts";

export class AIClient {
  public constructor(private readonly logger: Logger) {}

  public async generatePlan(request: GeneratePlanRequest): Promise<GeneratePlanResponse> {
    const { apiKey } = getConfig();
    const backendUrl = (await resolveBackendUrl(this.logger)) || getConfiguredBackendUrl();
    if (!backendUrl) {
      this.logger.warn("aiGov.backendUrl is not configured; using local mock response.");
      return buildMockPlan(request);
    }

    const endpoint = `${backendUrl}/generate-plan`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Generate plan failed at ${endpoint}: ${response.status} ${response.statusText}`);
    }

    const payload: unknown = await response.json();
    try {
      return generatePlanResponseSchema.parse(payload);
    } catch (error) {
      throw new Error(`Schema mismatch for generate plan response: ${toErrorMessage(error)}`);
    }
  }
}

function buildMockPlan(request: GeneratePlanRequest): GeneratePlanResponse {
  const promptLower = request.prompt.toLowerCase();
  const highRisk = /auth|migration|schema|package\.json|drop database|rm -rf|reset --hard/.test(promptLower);
  const destructive = /drop database|rm -rf|reset --hard|truncate/.test(promptLower);
  const highRiskPath = promptLower.includes("package") ? "package.json" : "auth/mock-guard.ts";

  const changes = highRisk
    ? [
        {
          path: highRiskPath,
          action: "update" as const,
          newContent: "// Mock high-risk change generated without backend.\nexport const guarded = true;\n"
        }
      ]
    : [
        {
          path: "ai-generated/quick-note.md",
          action: "create" as const,
          newContent: `# AI Draft\n\nPrompt:\n${request.prompt}\n\nGenerated at ${new Date().toISOString()}\n`
        }
      ];

  return {
    planId: randomUUID(),
    summary: highRisk
      ? "High-risk mock plan generated because backend is not configured."
      : "Low-risk mock plan generated because backend is not configured.",
    changes,
    proposedCommands: destructive ? ["git reset --hard"] : [],
    backendRisk: {
      score: highRisk ? 82 : 18,
      level: highRisk ? "high" : "low",
      reasons: highRisk ? ["Protected path touched in mock mode."] : ["Simple generated markdown file."]
    }
  };
}

function getConfig(): { apiKey: string } {
  const config = vscode.workspace.getConfiguration("aiGov");
  return {
    apiKey: String(config.get<string>("apiKey") ?? "").trim()
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
