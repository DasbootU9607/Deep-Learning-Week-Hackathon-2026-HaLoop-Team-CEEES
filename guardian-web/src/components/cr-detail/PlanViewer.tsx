import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface PlanViewerProps {
  plan?: string;
}

export function PlanViewer({ plan }: PlanViewerProps) {
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
        <div className="prose prose-invert prose-sm max-w-none space-y-1">
          {renderMarkdown(plan)}
        </div>
      </CardContent>
    </Card>
  );
}
