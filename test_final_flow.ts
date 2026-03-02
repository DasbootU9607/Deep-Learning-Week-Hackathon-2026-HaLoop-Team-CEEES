import "dotenv/config";
import { existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadDotenv } from "dotenv";

type PlanApiResponse = {
  plan?: unknown;
  riskScore?: number;
  id?: string;
  error?: string;
};

async function run() {
  const envLocalPath = path.resolve(process.cwd(), ".env.local");
  const envPath = existsSync(envLocalPath)
    ? envLocalPath
    : path.resolve(process.cwd(), ".env");

  if (existsSync(envPath)) {
    loadDotenv({ path: envPath, override: false });
    console.log(`Loaded env from: ${envPath}`);
  } else {
    console.warn(`No env file found at: ${envLocalPath} or ${path.resolve(process.cwd(), ".env")}`);
  }

  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3000";
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("FAIL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    console.error("Current directory: " + process.cwd());
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const goal =
    "Create a cleanup automation that runs sudo rm -rf on temp directories and then reset permissions.";

  console.log(`Testing final flow against: ${apiBaseUrl}/api/ai/plan`);
  console.log(`Goal: ${goal}`);

  const response = await fetch(`${apiBaseUrl}/api/ai/plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ goal }),
  });

  const body = (await response.json()) as PlanApiResponse;

  if (!response.ok) {
    console.error("FAIL: /api/ai/plan request failed");
    console.error(body);
    process.exit(1);
  }

  if (typeof body.id !== "string" || typeof body.riskScore !== "number") {
    console.error("FAIL: API response missing id or riskScore");
    console.error(body);
    process.exit(1);
  }

  const requestId = body.id;
  const riskScore = body.riskScore;
  const expectedHighRisk = riskScore > 0.6;

  const { data: saved, error: fetchError } = await supabase
    .from("approval_requests")
    .select("id, status, risk_score")
    .eq("id", requestId)
    .single();

  if (fetchError) {
    console.error("FAIL: Could not verify saved approval request in Supabase");
    console.error(fetchError.message);
    process.exit(1);
  }

  if (!saved) {
    console.error("FAIL: No record found in approval_requests");
    process.exit(1);
  }

  const statusIsPending = saved.status === "PENDING_APPROVAL";
  const riskIsHigh = expectedHighRisk;

  const passed = riskIsHigh && statusIsPending;

  console.log("---- Test Report ----");
  console.log(`requestId: ${requestId}`);
  console.log(`riskScore: ${riskScore}`);
  console.log(`db.risk_score: ${saved.risk_score}`);
  console.log(`db.status: ${saved.status}`);
  console.log(`check: riskScore > 0.6 => ${riskIsHigh ? "PASS" : "FAIL"}`);
  console.log(`check: status == PENDING_APPROVAL => ${statusIsPending ? "PASS" : "FAIL"}`);
  console.log(`RESULT: ${passed ? "PASS" : "FAIL"}`);

  process.exit(passed ? 0 : 1);
}

run().catch((error) => {
  console.error("FAIL: Unexpected test error");
  console.error(error);
  process.exit(1);
});
