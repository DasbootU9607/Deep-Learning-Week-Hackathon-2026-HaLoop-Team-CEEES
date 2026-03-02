import { cn } from "@/lib/utils";

interface ShellProps {
  children: React.ReactNode;
  className?: string;
}

export function Shell({ children, className }: ShellProps) {
  return (
    <main className={cn("flex-1 overflow-auto", className)}>
      <div className="relative mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="pointer-events-none absolute inset-0 halo-grid opacity-40" />
        <div className="relative space-y-6 lg:space-y-8">{children}</div>
      </div>
    </main>
  );
}
