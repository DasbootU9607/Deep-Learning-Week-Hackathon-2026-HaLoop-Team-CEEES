"use client";

import { CRFilters as CRFiltersType } from "@/types/cr";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

const REPOS = ["all", "payments-service", "user-service", "inventory-service", "api-gateway", "analytics-service"];

interface CRFiltersProps {
  filters: CRFiltersType;
  onChange: (filters: CRFiltersType) => void;
}

export function CRFilters({ filters, onChange }: CRFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by title, repo, branch..."
          className="pl-9"
          value={filters.search ?? ""}
          onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
        />
      </div>

      <Select
        value={filters.repo ?? "all"}
        onValueChange={(v) => onChange({ ...filters, repo: v === "all" ? undefined : v })}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Repository" />
        </SelectTrigger>
        <SelectContent>
          {REPOS.map((r) => (
            <SelectItem key={r} value={r}>
              {r === "all" ? "All Repos" : r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.status ?? "all"}
        onValueChange={(v) => onChange({ ...filters, status: v as CRFiltersType["status"] })}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="pending_approval">Pending</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
          <SelectItem value="changes_requested">Changes Requested</SelectItem>
          <SelectItem value="applied">Applied</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.risk_level ?? "all"}
        onValueChange={(v) => onChange({ ...filters, risk_level: v as CRFiltersType["risk_level"] })}
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
