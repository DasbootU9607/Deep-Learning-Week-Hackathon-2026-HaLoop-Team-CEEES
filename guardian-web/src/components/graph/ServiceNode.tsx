import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Server, Database, Globe } from "lucide-react";
import { cn, getRiskBgColor } from "@/lib/utils";
import { RiskLevel } from "@/types/cr";

interface ServiceNodeData {
  label: string;
  type?: "service" | "database" | "external";
  risk_level?: RiskLevel;
  metadata?: Record<string, unknown>;
  onClick?: () => void;
}

const TYPE_ICON = {
  service: Server,
  database: Database,
  external: Globe,
};

export const ServiceNode = memo(({ data, selected }: NodeProps<ServiceNodeData>) => {
  const Icon = TYPE_ICON[data.type ?? "service"];
  const riskClass = data.risk_level
    ? getRiskBgColor(data.risk_level)
    : "bg-secondary text-secondary-foreground border-border";

  return (
    <div
      className={cn(
        "min-w-[140px] rounded-lg border-2 px-3 py-2 cursor-pointer transition-all",
        selected ? "shadow-lg shadow-primary/20 border-primary" : "border-border",
        "bg-card hover:border-primary/50"
      )}
      onClick={data.onClick}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !border-border" />
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs font-medium truncate max-w-[110px]">{data.label}</span>
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        {data.risk_level && (
          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold border", riskClass)}>
            {data.risk_level}
          </span>
        )}
        {data.type && (
          <span className="rounded bg-secondary text-muted-foreground px-1.5 py-0.5 text-[10px]">
            {data.type}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground !border-border" />
    </div>
  );
});
ServiceNode.displayName = "ServiceNode";
