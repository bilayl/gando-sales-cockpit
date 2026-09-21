"use client";

import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/query/api-client";
import { queryKeys } from "@/lib/query/query-keys";

export function useCompanyCentralized(id?: string | null) {
  return useQuery({
    queryKey: queryKeys.companies.centralized(id || ""),
    queryFn: () => apiJson<any>(`/api/companies/${encodeURIComponent(id || "")}/centralized`, { cache: "no-store" }),
    enabled: Boolean(id),
  });
}
