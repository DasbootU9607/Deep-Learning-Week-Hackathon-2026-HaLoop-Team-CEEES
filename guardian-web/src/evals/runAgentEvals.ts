import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AGENT_EVAL_CASES, AgentEvalCase } from "@/evals/agentEvalCases";
import { generatePlanForGoal } from "@/lib/server/backendPlan";

interface EvalMetrics {
  schemaValidRate: number;
  highRiskRecall: number;
  approvalRecall: number;
  reasonCoverage: number;
  avgLatencyMs: number;
}

interface EvalRow {
  label: string;
  provider: "heuristic" | "openai" | "auto";
  metrics: EvalMetrics;
}

async function main(): Promise<void> {
  if (!process.env.BACKEND_MODE) {
    process.env.BACKEND_MODE = "demo";
  }

  const gateMode = process.argv.includes("--gate");
  const writeMode = process.argv.includes("--write") || gateMode;

  const before = await runSuite({
    label: "Before (heuristic)",
    provider: "heuristic",
  });
  const afterProvider = resolveAfterProvider();
  const after = await runSuite({
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

async function runSuite(params: {
  label: string;
  provider: "heuristic" | "openai" | "auto";
}): Promise<EvalRow> {
  const results = [];
  for (const testCase of AGENT_EVAL_CASES) {
    const startedAt = Date.now();
    let schemaValid = false;
    let highRisk = false;
    let reasonCoverage = false;

    try {
      const generated = await generatePlanForGoal({
        goal: testCase.goal,
        workspaceRoot: "eval-workspace",
        branch: "eval-branch",
        provider: params.provider,
        preferBackground: true,
      });

      schemaValid = true;
      highRisk = generated.response.backendRisk.score >= 70;
      reasonCoverage = coversReasonTokens(testCase, generated.response.backendRisk.reasons);
    } catch {
      schemaValid = false;
      highRisk = false;
      reasonCoverage = false;
    }

    const latencyMs = Date.now() - startedAt;
    results.push({
      case: testCase,
      schemaValid,
      highRisk,
      reasonCoverage,
      latencyMs,
    });
  }

  const highRiskCases = results.filter((item) => item.case.expectedHighRisk);
  const expectedApprovalCases = highRiskCases;

  const metrics: EvalMetrics = {
    schemaValidRate: ratio(results.filter((item) => item.schemaValid).length, results.length),
    highRiskRecall: ratio(
      highRiskCases.filter((item) => item.highRisk).length,
      Math.max(1, highRiskCases.length),
    ),
    approvalRecall: ratio(
      expectedApprovalCases.filter((item) => item.highRisk).length,
      Math.max(1, expectedApprovalCases.length),
    ),
    reasonCoverage: ratio(
      results.filter((item) => item.reasonCoverage).length,
      Math.max(1, results.length),
    ),
    avgLatencyMs: Math.round(
      results.reduce((sum, item) => sum + item.latencyMs, 0) / Math.max(1, results.length),
    ),
  };

  return {
    label: params.label,
    provider: params.provider,
    metrics,
  };
}

function resolveAfterProvider(): "heuristic" | "openai" | "auto" {
  const raw = String(process.env.EVAL_AFTER_PROVIDER ?? "auto").trim().toLowerCase();
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
    "| Variant | Provider | Schema Valid | High-Risk Recall | Approval Recall | Reason Coverage | Avg Latency (ms) |",
    "|---|---|---:|---:|---:|---:|---:|",
  ];

  const body = rows.map((row) => {
    const m = row.metrics;
    return `| ${row.label} | ${row.provider} | ${formatPct(m.schemaValidRate)} | ${formatPct(m.highRiskRecall)} | ${formatPct(m.approvalRecall)} | ${formatPct(m.reasonCoverage)} | ${m.avgLatencyMs} |`;
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
  const minHighRiskRecall = boundedThreshold(process.env.EVAL_GATE_MIN_HIGH_RISK_RECALL, 0.75);
  const minApprovalRecall = boundedThreshold(process.env.EVAL_GATE_MIN_APPROVAL_RECALL, 0.75);

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
