"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/components/theme/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000 },
        },
      })
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ThemedApp>{children}</ThemedApp>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function ThemedApp({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <>
      {children}
      <Toaster position="bottom-right" theme={theme === "dark" ? "dark" : "light"} richColors />
    </>
  );
}
