"use client";

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { apiJson } from "@/lib/query/api-client";
import { queryKeys } from "@/lib/query/query-keys";

export function useKpiEndpoint<T>(
  name: string,
  path: string,
  options?: Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">,
) {
  return useQuery<T, Error>({
    queryKey: queryKeys.kpi.endpoint(name),
    queryFn: () => apiJson<T>(path, { cache: "no-store" }),
    ...options,
  });
}

const CONTINUOUS_TABLES = [
  "public.accounts",
  "public.clients",
  "public.users",
  "public.deposits",
  "public.client_operations",
  "public.fees",
  "public.captures",
  "public.guarantee_activations",
  "public.psp_transactions",
  "public.payments",
];

type SyncResult = {
  success?: boolean;
  completedAt?: string;
  error?: string;
};

export function useKpiSync(canSync: boolean) {
  const queryClient = useQueryClient();

  return useMutation<SyncResult, Error>({
    mutationFn: async () => {
      if (!canSync) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.kpi.all });
        return { success: true, completedAt: new Date().toISOString() };
      }
      const body = await apiJson<SyncResult>("/api/system/supabase-sync", {
        method: "POST",
        body: JSON.stringify({ tables: CONTINUOUS_TABLES }),
      });
      if (body.success === false) throw new Error(body.error || "Synchronisation Gando incomplète");
      return body;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.kpi.all });
    },
  });
}
