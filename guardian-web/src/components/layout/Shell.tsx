import { cn } from "@/lib/utils";

interface ShellProps {
  children: React.ReactNode;
  className?: string;
}

export function Shell({ children, className }: ShellProps) {
  return (
    <main className={cn("flex-1 overflow-auto", className)}>
      <div className="p-6 space-y-6">{children}</div>
    </main>
  );
}
