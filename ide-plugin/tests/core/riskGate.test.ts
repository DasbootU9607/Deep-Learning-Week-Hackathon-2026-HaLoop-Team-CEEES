import { describe, expect, it } from "vitest";
import { RiskGate } from "../../src/core/riskGate";
import { GeneratePlanResponse } from "../../src/schemas/contracts";

function basePlan(overrides: Partial<GeneratePlanResponse> = {}): GeneratePlanResponse {
  return {
    planId: "plan-1",
    summary: "test",
    changes: [
      {
        path: "src/example.ts",
        action: "update",
        newContent: "export const value = 1;\n"
      }
    ],
    proposedCommands: [],
    backendRisk: {
      score: 10,
      level: "low",
      reasons: [],
    },
    review: {
      mode: "auto_approved",
      rationale: ["Risk score is 10, below the auto-approve threshold."],
      matchedPolicyRules: [],
      guardrailsPassed: {
        destructiveCommands: true,
        protectedPaths: true,
        secrets: true,
        blastRadius: true,
        diffSize: true,
      },
    },
    ...overrides
  };
}

describe("RiskGate", () => {
  it("returns ALLOW for low-risk plan", () => {
    const gate = new RiskGate();
    const result = gate.evaluate(basePlan());

    expect(result.decision).toBe("ALLOW");
    expect(result.finalRiskScore).toBe(10);
  });

  it("returns ALLOW_WITH_WARNING when backend risk is medium", () => {
    const gate = new RiskGate();
    const result = gate.evaluate(
      basePlan({
        backendRisk: {
          score: 55,
          level: "medium",
          reasons: [
            {
              source: "backend",
              category: "blast_radius",
              message: "Cross-module change observed.",
              weight: 18,
            },
          ],
        },
        review: {
          mode: "warning",
          rationale: ["Manual approval is not required, but review is recommended."],
          matchedPolicyRules: [],
          guardrailsPassed: {
            destructiveCommands: true,
            protectedPaths: true,
            secrets: true,
            blastRadius: false,
            diffSize: true,
          },
        },
      })
    );

    expect(result.decision).toBe("ALLOW_WITH_WARNING");
    expect(result.finalRiskScore).toBe(55);
    expect(result.warning).toBeTruthy();
  });

  it("returns REQUIRE_APPROVAL for destructive command", () => {
    const gate = new RiskGate();
    const result = gate.evaluate(
      basePlan({
        proposedCommands: ["rm -rf /tmp/demo"]
      })
    );

    expect(result.decision).toBe("REQUIRE_APPROVAL");
    expect(result.finalRiskScore).toBeGreaterThanOrEqual(70);
    expect(result.reasons.some((reason) => /destructive command/i.test(reason.message))).toBe(true);
  });

  it("uses max(local, backend) for final risk", () => {
    const gate = new RiskGate();
    const result = gate.evaluate(
      basePlan({
        backendRisk: {
          score: 82,
          level: "high",
          reasons: [
            {
              source: "policy",
              category: "path",
              message: "Backend marked auth path as protected.",
              affectedPath: "src/auth/guard.ts",
              weight: 60,
            },
          ],
        },
        review: {
          mode: "approval_required",
          rationale: ["Approval required because a protected path was modified."],
          matchedPolicyRules: [
            {
              id: "rule-auth",
              pattern: "**/auth/**",
              type: "require_approval",
              matchedPaths: ["src/auth/guard.ts"],
            },
          ],
          guardrailsPassed: {
            destructiveCommands: true,
            protectedPaths: false,
            secrets: true,
            blastRadius: true,
            diffSize: true,
          },
        },
      })
    );

    expect(result.finalRiskScore).toBe(82);
    expect(result.decision).toBe("REQUIRE_APPROVAL");
  });

  it("returns BLOCKED when backend review blocks the plan", () => {
    const gate = new RiskGate();
    const result = gate.evaluate(
      basePlan({
        backendRisk: {
          score: 100,
          level: "high",
          reasons: [
            {
              source: "policy",
              category: "path",
              message: "Policy blocks production infra edits.",
              affectedPath: "infra/prod/deploy.yaml",
              weight: 90,
            },
          ],
        },
        review: {
          mode: "blocked",
          rationale: ["Policy blocks this request outright."],
          matchedPolicyRules: [
            {
              id: "rule-prod-deny",
              pattern: "infra/prod/**",
              type: "deny",
              matchedPaths: ["infra/prod/deploy.yaml"],
            },
          ],
          guardrailsPassed: {
            destructiveCommands: true,
            protectedPaths: false,
            secrets: true,
            blastRadius: true,
            diffSize: true,
          },
        },
      })
    );

    expect(result.decision).toBe("BLOCKED");
    expect(result.warning).toContain("blocked");
  });
});
