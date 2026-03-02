"use client";

import { useState } from "react";
import { Policy, PathRule, RiskThreshold } from "@/types/policy";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RuleList } from "./RuleList";
import { ThresholdSlider } from "./ThresholdSlider";
import { Badge } from "@/components/ui/badge";
import { Save, Shield, Users } from "lucide-react";
import { toast } from "sonner";

interface PolicyEditorProps {
  policy: Policy;
  onSaveRules: (input: { rules: PathRule[]; riskThresholds: RiskThreshold }) => void;
}

export function PolicyEditor({ policy, onSaveRules }: PolicyEditorProps) {
  const [rules, setRules] = useState<PathRule[]>(policy.path_rules);
  const [thresholds, setThresholds] = useState<RiskThreshold>(policy.risk_thresholds);
  const [isDirty, setIsDirty] = useState(false);

  const handleRulesChange = (newRules: PathRule[]) => {
    setRules(newRules);
    setIsDirty(true);
  };

  const handleThresholdsChange = (t: RiskThreshold) => {
    setThresholds(t);
    setIsDirty(true);
  };

  const handleSave = () => {
    onSaveRules({ rules, riskThresholds: thresholds });
    setIsDirty(false);
    toast.success("Policy saved successfully");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">{policy.name}</h2>
          <Badge variant="secondary">v{policy.version}</Badge>
          {policy.is_active && <Badge className="bg-green-600 text-white">Active</Badge>}
        </div>
        <Button size="sm" disabled={!isDirty} onClick={handleSave}>
          <Save className="h-4 w-4 mr-1" />
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">
            <Shield className="h-4 w-4 mr-1.5" />
            Path Rules
          </TabsTrigger>
          <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
          <TabsTrigger value="roles">
            <Users className="h-4 w-4 mr-1.5" />
            Roles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <RuleList rules={rules} onChange={handleRulesChange} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="thresholds" className="mt-4">
          <ThresholdSlider thresholds={thresholds} onChange={handleThresholdsChange} />
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Role Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Approve</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Reject</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Policy</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Incident</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policy.role_permissions.map((rp, idx) => (
                      <tr key={rp.role} className={idx % 2 === 0 ? "" : "bg-secondary/10"}>
                        <td className="px-4 py-3 font-medium capitalize">{rp.role}</td>
                        {[rp.can_approve, rp.can_reject, rp.can_configure_policy, rp.can_toggle_incident].map((v, i) => (
                          <td key={i} className="px-4 py-3 text-center">
                            {v ? (
                              <span className="text-green-400 text-lg">✓</span>
                            ) : (
                              <span className="text-muted-foreground text-lg">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
