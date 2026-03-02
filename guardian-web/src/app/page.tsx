import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles, Workflow, LayoutDashboard, GitPullRequest, ScrollText, Shield, AlertOctagon } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function RootPage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <div className="pointer-events-none absolute inset-0 halo-grid opacity-45" />

      <div className="relative mx-auto flex w-full max-w-[1180px] flex-col gap-8">
        <header className="flex items-center justify-between">
          <div className="glass-muted inline-flex items-center gap-2 rounded-2xl px-3 py-2">
            <div className="relative h-7 w-7 overflow-hidden rounded-md border border-primary/20 bg-card">
              <Image src="/HaLoop_Logo.png" alt="HaLoop logo" fill sizes="28px" className="object-contain p-0.5" priority />
            </div>
            <span className="text-sm font-semibold tracking-tight">HaLoop</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/dashboard" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Open dashboard
            </Link>
          </div>
        </header>

        <section className="glass-panel rounded-[2rem] p-6 sm:p-9 lg:p-12">
          <div className="max-w-4xl space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs uppercase tracking-[0.13em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              HaLoop
            </p>
            <div className="relative h-20 w-56 sm:h-24 sm:w-64 lg:h-28 lg:w-72">
              <Image src="/HaLoop_Logo.png" alt="HaLoop logo" fill sizes="288px" className="object-contain object-left" priority />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Faster AI changes. Safer releases.
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              One workspace for plans, approvals, policy, and incident control.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_28px_rgba(0,122,255,0.25)] transition-transform hover:-translate-y-0.5"
              >
                Open workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/cr"
                className="inline-flex items-center rounded-2xl border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Change queue
              </Link>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            { href: "/dashboard", icon: LayoutDashboard, title: "Dashboard", body: "Live status and risk overview." },
            { href: "/cr", icon: GitPullRequest, title: "Change Requests", body: "Review and decide incoming changes." },
            { href: "/audit", icon: ScrollText, title: "Audit Logs", body: "Track every governance action." },
            { href: "/policies", icon: Shield, title: "Policies", body: "Edit rules and thresholds." },
            { href: "/incident", icon: AlertOctagon, title: "Incident", body: "Pause approvals during incidents." },
            { href: "/dashboard", icon: Workflow, title: "Plan Intelligence", body: "Understand plan impact quickly." },
          ].map((item) => (
            <Link key={item.title} href={item.href} className="glass-panel rounded-2xl p-5 transition-all hover:-translate-y-1 hover:shadow-xl">
              <item.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary">
                Open
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
