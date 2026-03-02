"use client";

import { AlertTriangle, X } from "lucide-react";
import { useIncidentMode } from "@/hooks/useIncidentMode";
import { formatRelativeTime } from "@/lib/utils";

export function IncidentBanner() {
  const { isIncidentMode, activatedAt, activatedBy, reason, disableIncidentMode } = useIncidentMode();

  if (!isIncidentMode) return null;

  return (
    <div className="flex items-center justify-between gap-4 bg-red-900/90 border-b border-red-700 px-4 py-2 text-red-100">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-300 animate-pulse" />
        <span className="font-semibold text-sm shrink-0">INCIDENT MODE ACTIVE</span>
        {reason && (
          <span className="text-sm text-red-200 truncate hidden sm:block">— {reason}</span>
        )}
        {activatedBy && activatedAt && (
          <span className="text-xs text-red-300 shrink-0 hidden md:block">
            by {activatedBy} · {formatRelativeTime(activatedAt)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-red-300">All approvals suspended</span>
        <button
          onClick={() => disableIncidentMode()}
          className="rounded p-1 hover:bg-red-800 transition-colors"
          aria-label="Disable incident mode"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
