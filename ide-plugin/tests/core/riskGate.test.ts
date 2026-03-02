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
      reasons: []
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
          reasons: ["cross-module change"]
        }
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
    expect(result.reasons.some((reason) => reason.includes("Destructive command"))).toBe(true);
  });

  it("uses max(local, backend) for final risk", () => {
    const gate = new RiskGate();
    const result = gate.evaluate(
      basePlan({
        backendRisk: {
          score: 82,
          level: "high",
          reasons: ["backend high risk"]
        }
      })
    );

    expect(result.finalRiskScore).toBe(82);
    expect(result.decision).toBe("REQUIRE_APPROVAL");
  });
});
