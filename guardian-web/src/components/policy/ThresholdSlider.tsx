"use client";

import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskThreshold } from "@/types/policy";
import { cn } from "@/lib/utils";
import { SlidersHorizontal } from "lucide-react";

interface ThresholdSliderProps {
  thresholds: RiskThreshold;
  onChange: (t: RiskThreshold) => void;
}

export function ThresholdSlider({ thresholds, onChange }: ThresholdSliderProps) {
  const getRiskLabel = (score: number) => {
    if (score > thresholds.med_max) return { label: "High", color: "text-red-400" };
    if (score > thresholds.low_max) return { label: "Medium", color: "text-yellow-400" };
    return { label: "Low", color: "text-green-400" };
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          Risk Thresholds
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Visual score bar */}
        <div className="relative h-6 rounded-full overflow-hidden flex">
          <div
            className="bg-green-500/70 flex items-center justify-center text-[10px] text-white font-medium transition-all"
            style={{ width: `${thresholds.low_max}%` }}
          >
            Low
          </div>
          <div
            className="bg-yellow-500/70 flex items-center justify-center text-[10px] text-white font-medium transition-all"
            style={{ width: `${thresholds.med_max - thresholds.low_max}%` }}
          >
            Med
          </div>
          <div
            className="bg-red-500/70 flex-1 flex items-center justify-center text-[10px] text-white font-medium"
          >
            High
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Low / Medium threshold</label>
              <span className="text-sm font-mono text-green-400">{thresholds.low_max}</span>
            </div>
            <Slider
              min={10}
              max={thresholds.med_max - 5}
              step={1}
              value={[thresholds.low_max]}
              onValueChange={([v]) => onChange({ ...thresholds, low_max: v })}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0 = Low</span>
              <span>{thresholds.low_max} = Low/Med boundary</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Medium / High threshold</label>
              <span className="text-sm font-mono text-yellow-400">{thresholds.med_max}</span>
            </div>
            <Slider
              min={thresholds.low_max + 5}
              max={95}
              step={1}
              value={[thresholds.med_max]}
              onValueChange={([v]) => onChange({ ...thresholds, med_max: v })}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{thresholds.low_max + 1} = Med</span>
              <span>{thresholds.med_max}+ = High</span>
            </div>
          </div>

          {thresholds.auto_approve_below !== undefined && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Auto-approve below</label>
                <span className="text-sm font-mono text-blue-400">{thresholds.auto_approve_below}</span>
              </div>
              <Slider
                min={0}
                max={thresholds.low_max}
                step={1}
                value={[thresholds.auto_approve_below]}
                onValueChange={([v]) => onChange({ ...thresholds, auto_approve_below: v })}
              />
            </div>
          )}

          {thresholds.require_dual_approval_above !== undefined && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Require dual approval above</label>
                <span className="text-sm font-mono text-red-400">{thresholds.require_dual_approval_above}</span>
              </div>
              <Slider
                min={thresholds.med_max}
                max={100}
                step={1}
                value={[thresholds.require_dual_approval_above]}
                onValueChange={([v]) => onChange({ ...thresholds, require_dual_approval_above: v })}
              />
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {[0, 30, 50, 75, 90, 100].map((score) => {
            const { label, color } = getRiskLabel(score);
            return (
              <div key={score} className="rounded bg-secondary/30 p-2">
                <span className="font-mono text-foreground">{score}</span>
                <span className={cn("ml-1", color)}>→ {label}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
