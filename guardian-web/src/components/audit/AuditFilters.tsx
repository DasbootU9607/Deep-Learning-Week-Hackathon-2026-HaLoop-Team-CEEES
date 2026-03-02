"use client";

import { AuditFilters as AuditFiltersType } from "@/types/audit";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface AuditFiltersProps {
  filters: AuditFiltersType;
  onChange: (filters: AuditFiltersType) => void;
}

export function AuditFilters({ filters, onChange }: AuditFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by actor..."
          className="pl-9"
          value={filters.actor ?? ""}
          onChange={(e) => onChange({ ...filters, actor: e.target.value || undefined })}
        />
      </div>

      <Select
        value={filters.action ?? "all"}
        onValueChange={(v) => onChange({ ...filters, action: v as AuditFiltersType["action"] })}
      >
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Action" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Actions</SelectItem>
          <SelectItem value="cr_created">CR Created</SelectItem>
          <SelectItem value="cr_submitted">CR Submitted</SelectItem>
          <SelectItem value="cr_approved">CR Approved</SelectItem>
          <SelectItem value="cr_rejected">CR Rejected</SelectItem>
          <SelectItem value="cr_changes_requested">Changes Requested</SelectItem>
          <SelectItem value="cr_applied">CR Applied</SelectItem>
          <SelectItem value="policy_updated">Policy Updated</SelectItem>
          <SelectItem value="incident_mode_enabled">Incident Enabled</SelectItem>
          <SelectItem value="incident_mode_disabled">Incident Disabled</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.risk_level ?? "all"}
        onValueChange={(v) => onChange({ ...filters, risk_level: v as AuditFiltersType["risk_level"] })}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Risk" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Risk</SelectItem>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="med">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
