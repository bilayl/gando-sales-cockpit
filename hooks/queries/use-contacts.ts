"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAllPagedResults } from "@/lib/fetch-all-paged-results";
import { queryKeys } from "@/lib/query/query-keys";

export type ContactRecord = {
  id: string;
  properties: Record<string, string | null | undefined>;
};

type ContactsResult = {
  results: ContactRecord[];
  total: number;
  truncated: boolean;
};

export function useContacts(segmentId = "") {
  return useQuery({
    queryKey: queryKeys.contacts.list({ segmentId }),
    queryFn: async (): Promise<ContactsResult> => {
      const params = new URLSearchParams();
      if (segmentId) params.set("segmentId", segmentId);
      return fetchAllPagedResults<ContactRecord>(`/api/contacts?${params.toString()}`);
    },
    staleTime: 45_000,
  });
}
