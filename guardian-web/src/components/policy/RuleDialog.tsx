"use client";

import { useState } from "react";
import { PathRule, PathRuleType } from "@/types/policy";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: PathRule;
  onSave: (rule: Partial<PathRule>) => void;
}

export function RuleDialog({ open, onOpenChange, rule, onSave }: RuleDialogProps) {
  const [pattern, setPattern] = useState(rule?.pattern ?? "");
  const [type, setType] = useState<PathRuleType>(rule?.type ?? "require_approval");
  const [description, setDescription] = useState(rule?.description ?? "");

  const handleSave = () => {
    if (!pattern.trim()) return;
    onSave({ pattern: pattern.trim(), type, description: description.trim() || undefined });
    onOpenChange(false);
    setPattern("");
    setDescription("");
    setType("require_approval");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit Rule" : "Add Rule"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="pattern">Path Pattern (glob)</Label>
            <Input
              id="pattern"
              placeholder="e.g. src/payments/**"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">Use glob patterns. E.g. <code className="bg-secondary px-1 rounded">src/payments/**</code></p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Rule Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as PathRuleType)}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="require_approval">Require Approval</SelectItem>
                <SelectItem value="allow">Allow (Auto-approve)</SelectItem>
                <SelectItem value="deny">Deny</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="Why this rule exists..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!pattern.trim()}>
            {rule ? "Update" : "Add"} Rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
