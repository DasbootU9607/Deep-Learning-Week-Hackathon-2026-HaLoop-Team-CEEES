#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
REVIEWER="${REVIEWER:-Integration Bot}"
AUTH_TOKEN="${AUTH_TOKEN:-haloop-lead-token}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd jq
require_cmd uuidgen

json_post() {
  local url="$1"
  local body="$2"
  curl -sS -X POST "$url" -H 'Content-Type: application/json' -H "Authorization: Bearer $AUTH_TOKEN" -d "$body"
}

create_high_risk_plan() {
  local branch="$1"
  local session_id
  session_id="$(uuidgen | tr '[:upper:]' '[:lower:]')"
  json_post "$BASE_URL/generate-plan" "$(jq -nc \
    --arg sessionId "$session_id" \
    --arg prompt "Modify auth guard and update security checks" \
    --arg workspaceRoot "$(pwd)" \
    --arg branch "$branch" \
    '{sessionId:$sessionId,prompt:$prompt,context:{workspaceRoot:$workspaceRoot,branch:$branch,activeFile:"src/auth/guard.ts",openTabs:["src/auth/guard.ts"]}}')"
}

create_approval_from_plan() {
  local plan_json="$1"
  local approval_id
  approval_id="$(uuidgen | tr '[:upper:]' '[:lower:]')"
  jq -nc \
    --arg approvalId "$approval_id" \
    --arg planId "$(echo "$plan_json" | jq -r '.planId')" \
    --arg sessionId "$(uuidgen | tr '[:upper:]' '[:lower:]')" \
    --arg requestedBy "integration-test" \
    --arg createdAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --argjson score "$(echo "$plan_json" | jq '.backendRisk.score')" \
    --argjson backendScore "$(echo "$plan_json" | jq '.backendRisk.score')" \
    --argjson reasons "$(echo "$plan_json" | jq '.backendRisk.reasons')" \
    --argjson review "$(echo "$plan_json" | jq '.review')" \
    --argjson files "$(echo "$plan_json" | jq '[.changes[].path]')" \
    '{approvalId:$approvalId, planId:$planId, sessionId:$sessionId, requestedBy:$requestedBy, requestedByRole:"developer", risk:{score:$score, backendScore:$backendScore, level:"high", reasons:$reasons, review:$review}, blastRadius:{files:$files, commandCount:0}, createdAt:$createdAt}'
}

set_incident_mode() {
  local enabled="$1"
  local reason="$2"
  curl -sS -X PUT "$BASE_URL/api/incident" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d "$(jq -nc --argjson enabled "$enabled" --arg reason "$reason" '{enabled:$enabled,reason:$reason}')" >/dev/null
}

echo "[0/8] Verifying policy update (rules + thresholds)"
POLICY_BEFORE="$(curl -sS "$BASE_URL/api/policy/active")"
UPDATED_POLICY="$(curl -sS -X PUT "$BASE_URL/api/policy/path-rules" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "$(jq -nc --argjson rules "$(echo "$POLICY_BEFORE" | jq '.path_rules')" --argjson riskThresholds "$(echo "$POLICY_BEFORE" | jq '.risk_thresholds | .med_max = 68')" '{rules:$rules,riskThresholds:$riskThresholds}')")"

if [[ "$(echo "$UPDATED_POLICY" | jq '.risk_thresholds.med_max')" != "68" ]]; then
  echo "Policy threshold update failed" >&2
  exit 1
fi

echo "[1/8] Creating high-risk plan"
PLAN_A="$(create_high_risk_plan "feat/integration-approve")"
if [[ "$(echo "$PLAN_A" | jq -r '.backendRisk.level')" != "high" ]]; then
  echo "Expected high risk plan, got: $(echo "$PLAN_A" | jq -r '.backendRisk.level')" >&2
  exit 1
fi

APPROVAL_A_REQ="$(create_approval_from_plan "$PLAN_A")"
APPROVAL_A="$(json_post "$BASE_URL/approvals" "$APPROVAL_A_REQ")"
APPROVAL_A_ID="$(echo "$APPROVAL_A" | jq -r '.approvalId')"

echo "[2/8] Verifying pending state"
PENDING_CODE="$(curl -sS -o /tmp/aigov-decision-a.json -w '%{http_code}' "$BASE_URL/approvals/$APPROVAL_A_ID/decision")"
if [[ "$PENDING_CODE" != "204" ]]; then
  echo "Expected 204 pending decision, got $PENDING_CODE" >&2
  exit 1
fi

echo "[3/8] Approving CR"
curl -sS -X POST "$BASE_URL/api/cr/$APPROVAL_A_ID/approve" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "$(jq -nc --arg comment "Approved by integration test" '{comment:$comment}')" >/tmp/aigov-approve-a.json

DECISION_A="$(curl -sS "$BASE_URL/approvals/$APPROVAL_A_ID/decision")"
if [[ "$(echo "$DECISION_A" | jq -r '.decision')" != "approved" ]]; then
  echo "Expected approved decision" >&2
  exit 1
fi

echo "[4/8] Creating second high-risk plan and rejecting"
PLAN_B="$(create_high_risk_plan "feat/integration-deny")"
APPROVAL_B_REQ="$(create_approval_from_plan "$PLAN_B")"
APPROVAL_B="$(json_post "$BASE_URL/approvals" "$APPROVAL_B_REQ")"
APPROVAL_B_ID="$(echo "$APPROVAL_B" | jq -r '.approvalId')"

curl -sS -X POST "$BASE_URL/api/cr/$APPROVAL_B_ID/reject" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "$(jq -nc --arg comment "Denied by integration test" '{comment:$comment}')" >/tmp/aigov-reject-b.json

DECISION_B="$(curl -sS "$BASE_URL/approvals/$APPROVAL_B_ID/decision")"
if [[ "$(echo "$DECISION_B" | jq -r '.decision')" != "denied" ]]; then
  echo "Expected denied decision" >&2
  exit 1
fi

echo "[5/8] Verifying realtime decision stream"
PLAN_D="$(create_high_risk_plan "feat/integration-realtime")"
APPROVAL_D_REQ="$(create_approval_from_plan "$PLAN_D")"
APPROVAL_D="$(json_post "$BASE_URL/approvals" "$APPROVAL_D_REQ")"
APPROVAL_D_ID="$(echo "$APPROVAL_D" | jq -r '.approvalId')"

curl -sS -N "$BASE_URL/approvals/$APPROVAL_D_ID/events" > /tmp/aigov-sse-check.txt &
SSE_PID=$!
sleep 1
curl -sS -X POST "$BASE_URL/api/cr/$APPROVAL_D_ID/approve" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "$(jq -nc --arg comment "Realtime approval check" '{comment:$comment}')" >/tmp/aigov-approve-d.json
sleep 1
if [[ -n "${SSE_PID:-}" ]]; then
  kill "$SSE_PID" >/dev/null 2>&1 || true
fi

if ! grep -q '"decision":"approved"' /tmp/aigov-sse-check.txt; then
  echo "Expected approved decision event in SSE stream output" >&2
  cat /tmp/aigov-sse-check.txt >&2 || true
  exit 1
fi

echo "[6/8] Enabling incident mode and checking approval block"
set_incident_mode true "Integration test incident lock"

PLAN_C="$(create_high_risk_plan "feat/integration-incident")"
APPROVAL_C_REQ="$(create_approval_from_plan "$PLAN_C")"
APPROVAL_C="$(json_post "$BASE_URL/approvals" "$APPROVAL_C_REQ")"
APPROVAL_C_ID="$(echo "$APPROVAL_C" | jq -r '.approvalId')"

BLOCK_CODE="$(curl -sS -o /tmp/aigov-incident-block.json -w '%{http_code}' -X POST "$BASE_URL/api/cr/$APPROVAL_C_ID/approve" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "$(jq -nc --arg comment "Should be blocked" '{comment:$comment}')")"

if [[ "$BLOCK_CODE" != "409" ]]; then
  echo "Expected approval block status 409 during incident mode, got $BLOCK_CODE" >&2
  exit 1
fi

echo "[7/8] Disabling incident mode"
set_incident_mode false "Integration test complete"

echo "[8/8] Restoring policy baseline"
curl -sS -X PUT "$BASE_URL/api/policy/path-rules" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "$(jq -nc --argjson rules "$(echo "$POLICY_BEFORE" | jq '.path_rules')" --argjson riskThresholds "$(echo "$POLICY_BEFORE" | jq '.risk_thresholds')" '{rules:$rules,riskThresholds:$riskThresholds}')" >/dev/null

echo "Integration checks passed: policy persistence, approval allow/deny, realtime events, and incident blocking all work."
