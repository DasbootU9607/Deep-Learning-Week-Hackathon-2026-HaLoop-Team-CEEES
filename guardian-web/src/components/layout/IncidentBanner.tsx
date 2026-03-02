"use client";

import { AlertTriangle, X } from "lucide-react";
import { useIncidentMode } from "@/hooks/useIncidentMode";
import { formatRelativeTime } from "@/lib/utils";

export function IncidentBanner() {
  const { isIncidentMode, activatedAt, activatedBy, reason, disableIncidentMode } = useIncidentMode();

  if (!isIncidentMode) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-red-400/45 bg-red-100/85 px-4 py-2.5 text-red-800 backdrop-blur-xl dark:border-red-500/35 dark:bg-red-500/20 dark:text-red-100 sm:px-6 lg:px-10">
      <div className="flex min-w-0 items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse text-red-600 dark:text-red-300" />
        <span className="shrink-0 text-sm font-semibold tracking-wide">INCIDENT MODE ACTIVE</span>
        {reason && <span className="hidden truncate text-sm text-red-700 dark:text-red-200 sm:block">- {reason}</span>}
        {activatedBy && activatedAt && (
          <span className="hidden shrink-0 text-xs text-red-700 dark:text-red-300 md:block">
            by {activatedBy} | {formatRelativeTime(activatedAt)}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden text-xs text-red-700 dark:text-red-300 sm:block">All approvals are suspended</span>
        <button
          onClick={() => disableIncidentMode()}
          className="rounded-md p-1 transition-colors hover:bg-red-200/70 dark:hover:bg-red-700/40"
          aria-label="Disable incident mode"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
