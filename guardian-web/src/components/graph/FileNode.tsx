import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { FileCode } from "lucide-react";
import { cn, getRiskBgColor } from "@/lib/utils";
import { RiskLevel } from "@/types/cr";

interface FileNodeData {
  label: string;
  risk_level?: RiskLevel;
  metadata?: Record<string, unknown>;
  onClick?: () => void;
}

export const FileNode = memo(({ data, selected }: NodeProps<FileNodeData>) => {
  const riskClass = data.risk_level ? getRiskBgColor(data.risk_level) : "bg-secondary text-secondary-foreground border-border";

  return (
    <div
      className={cn(
        "min-w-[120px] rounded-lg border-2 px-3 py-2 cursor-pointer transition-all",
        selected ? "shadow-lg shadow-primary/20 border-primary" : "border-border",
        "bg-card hover:border-primary/50"
      )}
      onClick={data.onClick}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !border-border" />
      <div className="flex items-center gap-2">
        <FileCode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-mono font-medium truncate max-w-[100px]">{data.label}</span>
      </div>
      {data.risk_level && (
        <div className={cn("mt-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold inline-flex border", riskClass)}>
          {data.risk_level}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground !border-border" />
    </div>
  );
});
FileNode.displayName = "FileNode";
