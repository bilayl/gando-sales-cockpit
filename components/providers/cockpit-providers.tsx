"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { createCockpitQueryClient } from "@/lib/query/query-client";

export function CockpitProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createCockpitQueryClient);

  return (
    <NuqsAdapter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </NuqsAdapter>
  );
}
