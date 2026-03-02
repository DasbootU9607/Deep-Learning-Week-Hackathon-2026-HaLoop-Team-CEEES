"use client";

import { useState } from "react";
import { PathRule } from "@/types/policy";
import { Button } from "@/components/ui/button";
import { RuleDialog } from "./RuleDialog";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

const TYPE_CONFIG = {
  require_approval: { label: "Require Approval", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", icon: AlertTriangle },
  allow: { label: "Allow", color: "text-green-400 bg-green-400/10 border-green-400/20", icon: CheckCircle },
  deny: { label: "Deny", color: "text-red-400 bg-red-400/10 border-red-400/20", icon: XCircle },
};

interface RuleListProps {
  rules: PathRule[];
  onChange: (rules: PathRule[]) => void;
}

export function RuleList({ rules, onChange }: RuleListProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PathRule | undefined>();

  const handleSave = (partial: Partial<PathRule>) => {
    if (editingRule) {
      onChange(rules.map((r) => (r.id === editingRule.id ? { ...r, ...partial } : r)));
    } else {
      const newRule: PathRule = {
        id: `rule-${Date.now()}`,
        pattern: partial.pattern!,
        type: partial.type!,
        description: partial.description,
        created_at: new Date().toISOString(),
        created_by: "Grace Kim",
      };
      onChange([...rules, newRule]);
    }
    setEditingRule(undefined);
  };

  const handleEdit = (rule: PathRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    onChange(rules.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rules.length} path rules configured</p>
        <Button
          size="sm"
          onClick={() => {
            setEditingRule(undefined);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Rule
        </Button>
      </div>

      <div className="space-y-2">
        {rules.map((rule) => {
          const config = TYPE_CONFIG[rule.type];
          const Icon = config.icon;
          return (
            <div
              key={rule.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-secondary/20 transition-colors group"
            >
              <Icon className={cn("h-4 w-4 shrink-0", config.color.split(" ")[0])} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-foreground">{rule.pattern}</code>
                  <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", config.color)}>
                    {config.label}
                  </span>
                </div>
                {rule.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(rule)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(rule.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <RuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
        onSave={handleSave}
      />
    </div>
  );
}
