"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GitPullRequest,
  Shield,
  ScrollText,
  AlertOctagon,
  ChevronRight,
} from "lucide-react";
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
    <aside className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <span className="text-sidebar-foreground font-bold text-lg tracking-tight">GUARDIAN</span>
          <div className="text-xs text-muted-foreground leading-none">Change Control</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          const isIncident = href === "/incident";

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                isIncident && isIncidentMode && "text-red-400 hover:text-red-300"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-sidebar-primary" : "text-current opacity-70",
                    isIncident && isIncidentMode && "text-red-400 animate-pulse"
                  )}
                />
                {label}
              </div>
              <div className="flex items-center gap-1">
                {isIncident && isIncidentMode && (
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                )}
                {isActive && (
                  <ChevronRight className="h-3 w-3 opacity-50" />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
            GK
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-sidebar-foreground truncate">Grace Kim</div>
            <div className="text-xs text-muted-foreground">Admin</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
