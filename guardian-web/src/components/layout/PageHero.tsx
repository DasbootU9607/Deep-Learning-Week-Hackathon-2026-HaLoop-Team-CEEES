"use client";

import { cn } from "@/lib/utils";

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description: string;
  rightSlot?: React.ReactNode;
  className?: string;
}

export function PageHero({ eyebrow, title, description, rightSlot, className }: PageHeroProps) {
  return (
    <section className={cn("glass-panel rounded-3xl p-5 sm:p-6 lg:p-8", className)}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-2">
          {eyebrow && <p className="text-xs uppercase tracking-[0.14em] text-primary">{eyebrow}</p>}
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-4xl">{title}</h2>
          <p className="text-sm text-muted-foreground sm:text-base">{description}</p>
        </div>
        {rightSlot && <div className="flex flex-wrap items-center gap-2">{rightSlot}</div>}
      </div>
    </section>
  );
}
