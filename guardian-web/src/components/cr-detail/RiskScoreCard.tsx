import { RiskLevel } from "@/types/cr";
import { cn, getRiskBgColor, getRiskScoreColor } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import type { ReviewDecision } from "@/lib/server/contracts";

interface RiskScoreCardProps {
  score: number;
  level: RiskLevel;
  requiredApprovals: number;
  approvalsCount: number;
  review?: ReviewDecision;
  riskBreakdown?: {
    local_score?: number;
    backend_score: number;
    final_score: number;
  };
}

const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Low Risk",
  med: "Medium Risk",
  high: "High Risk",
};

export function RiskScoreCard({
  score,
  level,
  requiredApprovals,
  approvalsCount,
  review,
  riskBreakdown,
}: RiskScoreCardProps) {
  const pct = riskBreakdown?.final_score ?? score;
  const trackColor = level === "high" ? "#ef4444" : level === "med" ? "#eab308" : "#22c55e";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          Risk Assessment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Score circle */}
          <div className="relative h-20 w-20 shrink-0">
            <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke={trackColor}
                strokeWidth="8"
                strokeDasharray={`${(pct / 100) * 201} 201`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-2xl font-bold", getRiskScoreColor(score))}>{score}</span>
              <span className="text-[10px] text-muted-foreground">/ 100</span>
            </div>
          </div>

          <div className="space-y-2 flex-1">
            <div>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold",
                  getRiskBgColor(level)
                )}
              >
                {RISK_LABELS[level]}
              </span>
            </div>

            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{approvalsCount}</span>
              {" / "}
              <span className="font-medium text-foreground">{requiredApprovals}</span>
              {" approvals required"}
              {requiredApprovals > 1 && (
                <div className="text-xs text-yellow-400 mt-1">
                  Dual approval required for high-risk CRs
                </div>
              )}
            </div>

            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: trackColor }}
              />
            </div>

            {riskBreakdown && (
              <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
                <div className="rounded border border-border bg-secondary/20 px-2 py-1">
                  <div className="text-muted-foreground">Local</div>
                  <div className="font-semibold text-foreground">{riskBreakdown.local_score ?? 0}</div>
                </div>
                <div className="rounded border border-border bg-secondary/20 px-2 py-1">
                  <div className="text-muted-foreground">Backend</div>
                  <div className="font-semibold text-foreground">{riskBreakdown.backend_score}</div>
                </div>
                <div className="rounded border border-border bg-secondary/20 px-2 py-1">
                  <div className="text-muted-foreground">Final</div>
                  <div className="font-semibold text-foreground">{riskBreakdown.final_score}</div>
                </div>
              </div>
            )}

            {review && (
              <div className="rounded-lg border border-border bg-secondary/20 p-3 text-xs text-muted-foreground">
                <div className="mb-2 font-medium text-foreground">Why this decision happened</div>
                <div className="space-y-1">
                  {review.rationale.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
