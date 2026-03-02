import { apiRequest } from "@/lib/api/http";
import { PathRule, Policy, RiskThreshold } from "@/types/policy";

export async function fetchActivePolicy(): Promise<Policy> {
  return apiRequest<Policy>("/api/policy/active");
}

export async function updatePathRules(
  rules: PathRule[],
  riskThresholds?: RiskThreshold,
): Promise<Policy> {
  return apiRequest<Policy>("/api/policy/path-rules", {
    method: "PUT",
    body: JSON.stringify({ rules, riskThresholds }),
  });
}
