import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReviewDecision, RiskReason } from "@/lib/server/contracts";
import { FileText } from "lucide-react";

interface PlanViewerProps {
  plan?: string;
  review?: ReviewDecision;
  commands?: string[];
  riskReasons?: RiskReason[];
}

export function PlanViewer({ plan, review, commands = [], riskReasons = [] }: PlanViewerProps) {
  if (!plan) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Change Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">No change plan provided.</p>
        </CardContent>
      </Card>
    );
  }

  // Simple markdown-like rendering
  const renderMarkdown = (text: string) => {
    return text
      .split("\n")
      .map((line, i) => {
        if (line.startsWith("### ")) {
          return <h3 key={i} className="text-base font-semibold mt-4 mb-2 text-foreground">{line.slice(4)}</h3>;
        }
        if (line.startsWith("## ")) {
          return <h2 key={i} className="text-lg font-bold mt-6 mb-3 text-foreground">{line.slice(3)}</h2>;
        }
        if (line.startsWith("# ")) {
          return <h1 key={i} className="text-xl font-bold mt-6 mb-3 text-foreground">{line.slice(2)}</h1>;
        }
        if (line.match(/^\d+\. /)) {
          return (
            <li key={i} className="ml-4 text-sm text-muted-foreground list-decimal">
              {line.replace(/^\d+\. /, "")}
            </li>
          );
        }
        if (line.startsWith("- **")) {
          const parts = line.replace("- **", "").split("**:");
          return (
            <li key={i} className="ml-4 text-sm text-muted-foreground list-disc">
              <strong className="text-foreground">{parts[0]}</strong>:{parts[1]}
            </li>
          );
        }
        if (line.startsWith("- ")) {
          return <li key={i} className="ml-4 text-sm text-muted-foreground list-disc">{line.slice(2)}</li>;
        }
        if (line === "") {
          return <div key={i} className="h-2" />;
        }
        // Inline code backticks
        const parts = line.split("`");
        return (
          <p key={i} className="text-sm text-muted-foreground">
            {parts.map((part, j) =>
              j % 2 === 1 ? (
                <code key={j} className="bg-secondary px-1 py-0.5 rounded text-xs font-mono text-foreground">
                  {part}
                </code>
              ) : (
                part
              )
            )}
          </p>
        );
      });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Change Plan
        </CardTitle>
      </CardHeader>
      <CardContent>
        {review && (
          <div className="mb-4 rounded-lg border border-border bg-secondary/20 p-4 text-sm">
            <div className="mb-2 font-medium text-foreground">Why this decision happened</div>
            <div className="space-y-1 text-muted-foreground">
              {review.rationale.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        )}

        {commands.length > 0 && (
          <div className="mb-4 rounded-lg border border-border bg-secondary/20 p-4 text-sm">
            <div className="mb-2 font-medium text-foreground">Proposed commands</div>
            <div className="space-y-2">
              {commands.map((command) => (
                <div
                  key={command}
                  className={`rounded border px-3 py-2 font-mono text-xs ${
                    /(rm\s+-rf|drop\s+database|truncate\b|git\s+reset\s+--hard|terraform\s+destroy)/i.test(command)
                      ? "border-red-500/40 bg-red-500/10 text-red-200"
                      : "border-border bg-background/60 text-foreground"
                  }`}
                >
                  {command}
                </div>
              ))}
            </div>
          </div>
        )}

        {riskReasons.length > 0 && (
          <div className="mb-4 rounded-lg border border-border bg-secondary/20 p-4 text-sm">
            <div className="mb-2 font-medium text-foreground">Risk signals</div>
            <div className="space-y-2">
              {riskReasons.map((reason, index) => (
                <div key={`${reason.message}-${index}`} className="rounded border border-border bg-background/50 px-3 py-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {reason.source} · {reason.category} · weight {reason.weight}
                  </div>
                  <div className="text-sm text-foreground">{reason.message}</div>
                  {reason.affectedPath && <div className="font-mono text-xs text-muted-foreground">{reason.affectedPath}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="prose prose-invert prose-sm max-w-none space-y-1">
          {renderMarkdown(plan)}
        </div>
      </CardContent>
    </Card>
  );
}
