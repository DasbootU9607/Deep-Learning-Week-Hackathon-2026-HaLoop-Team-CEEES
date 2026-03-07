import { EvidenceItem } from "@/types/cr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, AlertTriangle, MinusCircle, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_ICON: Record<EvidenceItem["status"], React.ReactNode> = {
  passed: <CheckCircle className="h-4 w-4 text-green-400" />,
  failed: <XCircle className="h-4 w-4 text-red-400" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-400" />,
  skipped: <MinusCircle className="h-4 w-4 text-muted-foreground" />,
};

const TYPE_LABEL: Record<EvidenceItem["type"], string> = {
  test: "Tests",
  log: "Logs",
  sast: "SAST",
  sca: "SCA",
  lint: "Lint",
};

interface EvidencePanelProps {
  evidence: EvidenceItem[];
}

export function EvidencePanel({ evidence }: EvidencePanelProps) {
  if (evidence.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Evidence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">No evidence attached yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FlaskConical className="h-4 w-4" />
          Evidence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {evidence.map((item, idx) => (
          <div
            key={idx}
            className={cn(
              "rounded-md border p-3",
              item.status === "failed" && "border-red-500/30 bg-red-500/5",
              item.status === "warning" && "border-yellow-500/30 bg-yellow-500/5",
              item.status === "passed" && "border-green-500/30 bg-green-500/5",
              item.status === "skipped" && "border-border bg-secondary/20"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {STATUS_ICON[item.status]}
                <div>
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground rounded bg-secondary px-1.5 py-0.5">
                    {TYPE_LABEL[item.type]}
                  </span>
                  {item.kind && (
                    <span className="ml-2 text-xs text-muted-foreground rounded border border-border px-1.5 py-0.5">
                      {item.kind === "executed" ? "Executed check" : "Recommended check"}
                    </span>
                  )}
                </div>
              </div>
              {item.url && (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline shrink-0">
                  View →
                </a>
              )}
            </div>
            {item.summary && (
              <p className="mt-1.5 text-xs text-muted-foreground ml-6">{item.summary}</p>
            )}
            {(item.command || item.scope) && (
              <p className="mt-1 text-xs text-foreground/80 ml-6">
                {item.command ? <code className="font-mono">{item.command}</code> : null}
                {item.command && item.scope ? " in " : null}
                {item.scope ? <span className="font-mono">{item.scope}</span> : null}
              </p>
            )}
            {item.details && (
              <p className="mt-1 text-xs text-foreground/80 ml-6 font-mono bg-secondary/50 rounded p-2">{item.details}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
