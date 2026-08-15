"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const status =
            typeof error === "object" && error !== null && "status" in error
              ? Number(error.status)
              : undefined;
          if (status === 401 || status === 403 || status === 404) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster richColors position="top-right" />
        {process.env.NODE_ENV === "development" && (
          <div className="fixed right-3 bottom-20 z-[60] min-[800px]:bottom-3">
            <ReactQueryDevtools
              buttonPosition="relative"
              initialIsOpen={false}
            />
          </div>
        )}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
