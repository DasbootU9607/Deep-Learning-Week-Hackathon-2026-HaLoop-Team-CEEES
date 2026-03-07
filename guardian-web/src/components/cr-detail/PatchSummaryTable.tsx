import { PatchFile } from "@/types/cr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, getRiskBgColor } from "@/lib/utils";
import { FileDiff, Plus, Minus } from "lucide-react";

interface PatchSummaryTableProps {
  files: PatchFile[];
}

export function PatchSummaryTable({ files }: PatchSummaryTableProps) {
  const totalAdditions = files.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = files.reduce((s, f) => s + f.deletions, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileDiff className="h-4 w-4" />
            Patch Summary
          </CardTitle>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-green-400">
              <Plus className="h-3 w-3" />
              {totalAdditions}
            </span>
            <span className="flex items-center gap-1 text-red-400">
              <Minus className="h-3 w-3" />
              {totalDeletions}
            </span>
            <span className="text-muted-foreground">{files.length} files</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {files.map((file, idx) => (
            <div
              key={idx}
              className={cn(
                "flex items-center gap-3 px-6 py-3 transition-colors hover:bg-secondary/20",
                file.is_protected && "bg-yellow-500/5"
              )}
            >
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
                  getRiskBgColor(file.risk_level)
                )}
              >
                {file.risk_level}
              </span>
              <span className="flex-1 font-mono text-xs text-foreground truncate">{file.path}</span>
              <div className="flex items-center gap-2 text-xs shrink-0">
                <span className="text-green-400">+{file.additions}</span>
                <span className="text-red-400">-{file.deletions}</span>
              </div>
              {file.risk_rules_hit.length > 0 && (
                <div className="hidden md:flex gap-1 shrink-0">
                  {file.risk_rules_hit.map((rule) => (
                    <span key={rule} className="rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 px-1.5 py-0.5 text-xs">
                      {rule}
                    </span>
                  ))}
                </div>
              )}
              {file.is_protected && (
                <span className="rounded border border-yellow-500/30 bg-yellow-500/10 px-1.5 py-0.5 text-xs text-yellow-300">
                  protected
                </span>
              )}
              {file.risk_categories && file.risk_categories.length > 0 && (
                <div className="hidden lg:flex gap-1 shrink-0">
                  {Array.from(new Set(file.risk_categories)).map((category) => (
                    <span key={category} className="rounded border border-border bg-secondary/40 px-1.5 py-0.5 text-xs text-muted-foreground">
                      {category}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
