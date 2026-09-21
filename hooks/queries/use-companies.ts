"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAllPagedResults } from "@/lib/fetch-all-paged-results";
import { queryKeys } from "@/lib/query/query-keys";

export type CompanyRecord = {
  id: string;
  properties: Record<string, string | null | undefined>;
};

type CompaniesResult = {
  results: CompanyRecord[];
  total: number;
  truncated: boolean;
};

export function useCompanies(segmentId = "") {
  return useQuery({
    queryKey: queryKeys.companies.list({ segmentId }),
    queryFn: async (): Promise<CompaniesResult> => {
      const params = new URLSearchParams();
      if (segmentId) params.set("segmentId", segmentId);
      return fetchAllPagedResults<CompanyRecord>(`/api/companies?${params.toString()}`);
    },
    staleTime: 45_000,
  });
}
