"use client";

import Image from "next/image";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { ActorSwitcher } from "./ActorSwitcher";

interface TopbarProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function Topbar({ title, description, children }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-4 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative h-9 w-9 overflow-hidden rounded-lg border border-primary/20 bg-card lg:hidden">
            <Image src="/HaLoop_Logo.png" alt="HaLoop logo" fill sizes="36px" className="object-contain p-1" priority />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground lg:text-2xl">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {children}
          <ActorSwitcher />
          <ThemeToggle />
          <Button variant="ghost" size="icon" className="relative rounded-xl border border-border bg-card hover:bg-accent">
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
          </Button>
        </div>
      </div>
    </header>
  );
}
