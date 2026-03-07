import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AGENT_EVAL_CASES, AgentEvalCase } from "@/evals/agentEvalCases";
import { generatePlanForGoal } from "@/lib/server/backendPlan";
import { GeneratePlanResponse } from "@/lib/server/contracts";

interface EvalMetrics {
  schemaValidRate: number;
  highRiskRecall: number;
  approvalRecall: number;
  falsePositiveRate: number;
  policyHitPrecision: number;
  reasonCoverage: number;
  explanationCompleteness: number;
  avgLatencyMs: number;
}

interface EvalRow {
  label: string;
  provider: "baseline" | "heuristic" | "openai" | "auto";
  metrics: EvalMetrics;
}

interface EvalObservation {
  testCase: AgentEvalCase;
  schemaValid: boolean;
  highRisk: boolean;
  reviewMode?: AgentEvalCase["expectedReviewMode"];
  reasonTexts: string[];
  policyPatterns: string[];
  explanationCompleteness: number;
  latencyMs: number;
}

async function main(): Promise<void> {
  if (!process.env.BACKEND_MODE) {
    process.env.BACKEND_MODE = "demo";
  }

  const gateMode = process.argv.includes("--gate");
  const writeMode = process.argv.includes("--write") || gateMode;

  const before = await runBaselineSuite();
  const afterProvider = resolveAfterProvider();
  const after = await runPlannerSuite({
    label: `After (${afterProvider})`,
    provider: afterProvider,
  });

  const table = renderMarkdownTable([before, after]);
  console.log(table);

  if (writeMode) {
    await persistArtifacts(table, [before, after]);
  }

  if (gateMode) {
    enforceGate(after.metrics);
  }
}

async function runBaselineSuite(): Promise<EvalRow> {
  const results = AGENT_EVAL_CASES.map((testCase) => {
    const startedAt = Date.now();
    const prediction = evaluateBaselineCase(testCase);
    return {
      testCase,
      schemaValid: true,
      highRisk: prediction.highRisk,
      reviewMode: prediction.reviewMode,
      reasonTexts: prediction.reasonTexts,
      policyPatterns: prediction.policyPatterns,
      explanationCompleteness: prediction.explanationCompleteness,
      latencyMs: Math.max(1, Date.now() - startedAt),
    } satisfies EvalObservation;
  });

  return {
    label: "Before (baseline rules)",
    provider: "baseline",
    metrics: summarizeMetrics(results),
  };
}

async function runPlannerSuite(params: {
  label: string;
  provider: "heuristic" | "openai" | "auto";
}): Promise<EvalRow> {
  const results: EvalObservation[] = [];

  for (const testCase of AGENT_EVAL_CASES) {
    const startedAt = Date.now();

    try {
      const generated = await generatePlanForGoal({
        goal: testCase.goal,
        workspaceRoot: "eval-workspace",
        branch: "eval-branch",
        provider: params.provider,
        preferBackground: true,
      });

      results.push({
        testCase,
        schemaValid: true,
        highRisk: generated.response.backendRisk.score >= 70,
        reviewMode: generated.response.review.mode,
        reasonTexts: generated.response.backendRisk.reasons.map((reason) => reason.message),
        policyPatterns: generated.response.review.matchedPolicyRules.map((rule) => rule.pattern),
        explanationCompleteness: scoreExplanationCompleteness(generated.response, testCase),
        latencyMs: Date.now() - startedAt,
      });
    } catch {
      results.push({
        testCase,
        schemaValid: false,
        highRisk: false,
        reasonTexts: [],
        policyPatterns: [],
        explanationCompleteness: 0,
        latencyMs: Date.now() - startedAt,
      });
    }
  }

  return {
    label: params.label,
    provider: params.provider,
    metrics: summarizeMetrics(results),
  };
}

function evaluateBaselineCase(testCase: AgentEvalCase): {
  highRisk: boolean;
  reviewMode: AgentEvalCase["expectedReviewMode"];
  reasonTexts: string[];
  policyPatterns: string[];
  explanationCompleteness: number;
} {
  const goal = testCase.goal.toLowerCase();
  const reasonTexts: string[] = [];
  const policyPatterns: string[] = [];
  let highRisk = false;
  let reviewMode: AgentEvalCase["expectedReviewMode"] = "auto_approved";

  if (/auth|login|jwt|permission/.test(goal)) {
    highRisk = true;
    reviewMode = "approval_required";
    reasonTexts.push("Auth-related change detected.");
    policyPatterns.push("**/auth/**");
  }

  if (/migrat|schema|database|db/.test(goal)) {
    highRisk = true;
    reviewMode = "approval_required";
    reasonTexts.push("Database change detected.");
    policyPatterns.push("**/migrations/**");
  }

  if (/package\.json|dependency|dependencies|npm/.test(goal)) {
    highRisk = true;
    reviewMode = "approval_required";
    reasonTexts.push("Dependency update detected.");
    policyPatterns.push("package.json");
  }

  if (/infra\/prod|production routing|production infra/.test(goal)) {
    highRisk = true;
    reviewMode = "blocked";
    reasonTexts.push("Production infra change detected.");
  }

  if (/refactor|multi-file|cross-module|workflow/.test(goal) && !highRisk) {
    reviewMode = "auto_approved";
    reasonTexts.push("Refactor detected.");
  }

  const explanationSections = [
    reasonTexts.length > 0,
    reviewMode !== undefined,
    false,
    policyPatterns.length > 0 || testCase.expectedPolicyPatterns.length === 0,
  ];

  return {
    highRisk,
    reviewMode,
    reasonTexts,
    policyPatterns,
    explanationCompleteness: ratio(
      explanationSections.filter(Boolean).length,
      explanationSections.length,
    ),
  };
}

function scoreExplanationCompleteness(
  response: GeneratePlanResponse,
  testCase: AgentEvalCase,
): number {
  const checks = [
    response.review.rationale.length > 0,
    response.backendRisk.reasons.length > 0,
    Object.keys(response.review.guardrailsPassed).length === 5,
    testCase.expectedPolicyPatterns.length === 0 || response.review.matchedPolicyRules.length > 0,
  ];

  return ratio(checks.filter(Boolean).length, checks.length);
}

function summarizeMetrics(results: EvalObservation[]): EvalMetrics {
  const highRiskCases = results.filter((item) => item.testCase.expectedHighRisk);
  const approvalCases = results.filter(
    (item) => item.testCase.expectedReviewMode === "approval_required" || item.testCase.expectedReviewMode === "blocked",
  );
  const lowRiskCases = results.filter((item) => !item.testCase.expectedHighRisk);

  return {
    schemaValidRate: ratio(results.filter((item) => item.schemaValid).length, results.length),
    highRiskRecall: ratio(
      highRiskCases.filter((item) => item.highRisk).length,
      Math.max(1, highRiskCases.length),
    ),
    approvalRecall: ratio(
      approvalCases.filter((item) =>
        item.reviewMode === "approval_required" || item.reviewMode === "blocked",
      ).length,
      Math.max(1, approvalCases.length),
    ),
    falsePositiveRate: ratio(
      lowRiskCases.filter((item) => item.highRisk).length,
      Math.max(1, lowRiskCases.length),
    ),
    policyHitPrecision: ratio(
      results.reduce((sum, item) => sum + scorePolicyPrecision(item), 0),
      Math.max(1, results.length),
    ),
    reasonCoverage: ratio(
      results.filter((item) => coversReasonTokens(item.testCase, item.reasonTexts)).length,
      Math.max(1, results.length),
    ),
    explanationCompleteness: ratio(
      results.reduce((sum, item) => sum + item.explanationCompleteness, 0),
      Math.max(1, results.length),
    ),
    avgLatencyMs: Math.round(
      results.reduce((sum, item) => sum + item.latencyMs, 0) / Math.max(1, results.length),
    ),
  };
}

function scorePolicyPrecision(observation: EvalObservation): number {
  const expected = observation.testCase.expectedPolicyPatterns;
  const predicted = observation.policyPatterns;

  if (predicted.length === 0) {
    return expected.length === 0 ? 1 : 0;
  }

  const matches = predicted.filter((pattern) => expected.includes(pattern)).length;
  return matches / predicted.length;
}

function resolveAfterProvider(): "heuristic" | "openai" | "auto" {
  const raw = String(process.env.EVAL_AFTER_PROVIDER ?? "heuristic").trim().toLowerCase();
  if (raw === "heuristic" || raw === "openai") {
    return raw;
  }
  return "auto";
}

function coversReasonTokens(testCase: AgentEvalCase, reasons: string[]): boolean {
  if (testCase.expectedReasonTokens.length === 0) {
    return true;
  }
  const haystack = reasons.join(" ").toLowerCase();
  return testCase.expectedReasonTokens.every((token) => haystack.includes(token.toLowerCase()));
}

function ratio(numerator: number, denominator: number): number {
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return Number((numerator / denominator).toFixed(3));
}

function renderMarkdownTable(rows: EvalRow[]): string {
  const header = [
    "| Variant | Provider | Schema Valid | High-Risk Recall | Approval Recall | False Positive Rate | Policy Hit Precision | Reason Coverage | Explanation Completeness | Avg Latency (ms) |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];

  const body = rows.map((row) => {
    const m = row.metrics;
    return `| ${row.label} | ${row.provider} | ${formatPct(m.schemaValidRate)} | ${formatPct(m.highRiskRecall)} | ${formatPct(m.approvalRecall)} | ${formatPct(m.falsePositiveRate)} | ${formatPct(m.policyHitPrecision)} | ${formatPct(m.reasonCoverage)} | ${formatPct(m.explanationCompleteness)} | ${m.avgLatencyMs} |`;
  });

  return [...header, ...body].join("\n");
}

async function persistArtifacts(table: string, rows: EvalRow[]): Promise<void> {
  const docsPath = path.join(process.cwd(), "..", "docs", "backend-eval-benchmarks.md");
  const artifactDir = path.join(process.cwd(), "eval-results");
  const artifactPath = path.join(artifactDir, "latest-agent-evals.json");

  const content = [
    "# Backend Eval Benchmarks",
    "",
    `Generated at: ${new Date().toISOString()}`,
    "",
    table,
    "",
    "Run command:",
    "`npm run eval:gate`",
    "",
  ].join("\n");

  await writeFile(docsPath, content, "utf8");
  await mkdir(artifactDir, { recursive: true });
  await writeFile(
    artifactPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        rows,
      },
      null,
      2,
    ),
    "utf8",
  );
}

function enforceGate(metrics: EvalMetrics): void {
  const minSchemaValid = boundedThreshold(process.env.EVAL_GATE_MIN_SCHEMA_VALID, 0.98);
  const minHighRiskRecall = boundedThreshold(process.env.EVAL_GATE_MIN_HIGH_RISK_RECALL, 0.8);
  const minApprovalRecall = boundedThreshold(process.env.EVAL_GATE_MIN_APPROVAL_RECALL, 0.8);
  const minExplanationCompleteness = boundedThreshold(
    process.env.EVAL_GATE_MIN_EXPLANATION_COMPLETENESS,
    0.9,
  );

  const failures: string[] = [];
  if (metrics.schemaValidRate < minSchemaValid) {
    failures.push(`schema_valid_rate ${metrics.schemaValidRate} < ${minSchemaValid}`);
  }
  if (metrics.highRiskRecall < minHighRiskRecall) {
    failures.push(`high_risk_recall ${metrics.highRiskRecall} < ${minHighRiskRecall}`);
  }
  if (metrics.approvalRecall < minApprovalRecall) {
    failures.push(`approval_recall ${metrics.approvalRecall} < ${minApprovalRecall}`);
  }
  if (metrics.explanationCompleteness < minExplanationCompleteness) {
    failures.push(
      `explanation_completeness ${metrics.explanationCompleteness} < ${minExplanationCompleteness}`,
    );
  }

  if (failures.length > 0) {
    throw new Error(`Eval gate failed: ${failures.join("; ")}`);
  }
}

function boundedThreshold(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(String(raw ?? ""));
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, parsed));
}

function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
