"use client";

import { BlastRadiusNode } from "@/types/cr";
import { cn, getRiskBgColor } from "@/lib/utils";
import { X, FileCode, Server, Database, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

const TYPE_ICON = {
  file: FileCode,
  service: Server,
  database: Database,
  external: Globe,
};

interface NodeDetailDrawerProps {
  node: BlastRadiusNode | null;
  onClose: () => void;
}

export function NodeDetailDrawer({ node, onClose }: NodeDetailDrawerProps) {
  if (!node) return null;

  const Icon = TYPE_ICON[node.type] ?? Server;

  return (
    <div className="absolute right-0 top-0 h-full w-72 bg-card border-l border-border shadow-xl z-10 flex flex-col animate-in slide-in-from-right-4 duration-200">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">{node.label}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Type</p>
          <span className="text-sm capitalize">{node.type}</span>
        </div>

        {node.risk_level && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Risk Level</p>
            <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", getRiskBgColor(node.risk_level))}>
              {node.risk_level.toUpperCase()}
            </span>
          </div>
        )}

        {node.metadata && Object.keys(node.metadata).length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Metadata</p>
            <div className="space-y-1.5 rounded-md bg-secondary/30 p-3">
              {Object.entries(node.metadata).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                  <span className="font-mono text-foreground">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
