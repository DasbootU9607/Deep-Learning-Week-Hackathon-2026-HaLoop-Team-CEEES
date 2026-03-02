"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, GitPullRequest, Shield, ScrollText, AlertOctagon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIncidentMode } from "@/hooks/useIncidentMode";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cr", label: "Change Requests", icon: GitPullRequest },
  { href: "/policies", label: "Policies", icon: Shield },
  { href: "/audit", label: "Audit Logs", icon: ScrollText },
  { href: "/incident", label: "Incident", icon: AlertOctagon },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isIncidentMode } = useIncidentMode();

  return (
    <aside className="hidden h-full w-72 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="border-b border-sidebar-border px-6 py-6">
        <Link href="/" className="glass-muted flex items-center gap-3 px-3 py-2.5 transition-transform hover:-translate-y-0.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <span className="block text-base font-semibold tracking-tight text-sidebar-foreground">HaLoop</span>
            <span className="block text-xs text-muted-foreground">AI Governance Control Plane</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-4 py-5">
        <p className="px-2 pb-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">Workspace</p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          const isIncident = href === "/incident";

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "glass-muted text-sidebar-foreground shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                isIncident && isIncidentMode && "text-red-500 hover:text-red-500"
              )}
            >
              <span className="flex items-center gap-3">
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-sidebar-primary" : "text-current opacity-80",
                    isIncident && isIncidentMode && "text-red-500 animate-pulse"
                  )}
                />
                {label}
              </span>
              <span className="flex items-center gap-1">
                {isIncident && isIncidentMode && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                {isActive && <ChevronRight className="h-3 w-3 opacity-60" />}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-6 py-5">
        <div className="glass-muted flex items-center gap-3 px-3 py-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">HL</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-sidebar-foreground">HaLoop Admin</div>
            <div className="text-xs text-muted-foreground">System Operator</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
