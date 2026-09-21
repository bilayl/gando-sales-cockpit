"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAllPagedResults } from "@/lib/fetch-all-paged-results";
import { apiJson } from "@/lib/query/api-client";
import { queryKeys } from "@/lib/query/query-keys";

export type Company = { id: string; properties: Record<string, string | null | undefined> };
export type Contact = { id: string; properties: Record<string, string | null | undefined> };
export type Segment = { listId: string; name: string; objectTypeId: string; size?: number };
export type Owner = { id: string; firstName?: string; lastName?: string; email?: string };
export type CockpitAssignment = { company_id: string; assignee_cockpit_email: string };

export function useSegments() {
  return useQuery({
    queryKey: queryKeys.segments.all,
    queryFn: async () => {
      const body = await apiJson<{ lists?: Segment[] }>("/api/segments", { cache: "no-store" });
      return body.lists || [];
    },
    staleTime: 5 * 60_000,
  });
}

export function useOwners() {
  return useQuery({
    queryKey: queryKeys.owners.all,
    queryFn: async () => {
      const body = await apiJson<{ results?: Owner[] }>("/api/owners", { cache: "no-store" });
      return body.results || [];
    },
    staleTime: 5 * 60_000,
  });
}

export function useCurrentCockpitUser() {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: () => apiJson<{ email?: string; role?: string }>("/api/auth/me", { cache: "no-store" }),
    staleTime: 10 * 60_000,
  });
}

export function useProspectionAssignments() {
  return useQuery({
    queryKey: queryKeys.prospection.assignments,
    queryFn: async () => {
      const body = await apiJson<{ results?: CockpitAssignment[] }>("/api/prospection/assignments", { cache: "no-store" });
      return body.results || [];
    },
    staleTime: 15_000,
  });
}

export function useCompanies(segmentId?: string) {
  return useQuery({
    queryKey: queryKeys.companies.list({ segmentId: segmentId || null }),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (segmentId) params.set("segmentId", segmentId);
      return fetchAllPagedResults<Company>(`/api/companies?${params.toString()}`);
    },
    placeholderData: previous => previous,
  });
}

export function useContacts(segmentId?: string) {
  return useQuery({
    queryKey: queryKeys.contacts.list({ segmentId: segmentId || null }),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (segmentId) params.set("segmentId", segmentId);
      return fetchAllPagedResults<Contact>(`/api/contacts?${params.toString()}`);
    },
    placeholderData: previous => previous,
  });
}

export function useSyncCrm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiJson("/api/sync?resource=all"),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.companies.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.segments.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.owners.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.prospection.assignments }),
      ]);
    },
  });
}

export function useClaimProspectionSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (companyIds: string[]) =>
      apiJson<{ claimedCompanyIds?: string[] }>("/api/prospection/assignments", {
        method: "POST",
        body: JSON.stringify({ companyIds }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.prospection.assignments });
    },
  });
}

export type ProspectionTaskSummary = {
  openTaskCount: number;
  overdueTaskCount: number;
  todayTaskCount: number;
  nextTask: {
    id: string;
    subject: string;
    status: string;
    priority?: string | null;
    type?: string | null;
    dueAt?: string | null;
    sourceContactId?: string | null;
    sourceContactName?: string | null;
    sourceContactPhone?: string | null;
    sourceContactJobTitle?: string | null;
  } | null;
};

export type OnoffSessionState = {
  configured?: boolean;
  connected?: boolean | null;
  latestProcessingStatus?: string | null;
  latestReceivedAt?: string | null;
  error?: string | null;
};

export function useProspectionSessionData(companyIds: string[], enabled = true) {
  const stableIds = [...companyIds].sort();
  return useQuery({
    queryKey: queryKeys.prospection.session(stableIds),
    queryFn: () => apiJson<{ summaries?: Record<string, ProspectionTaskSummary>; onoff?: OnoffSessionState | null }>(
      "/api/prospection/session",
      {
        method: "POST",
        body: JSON.stringify({ companyIds: stableIds.slice(0, 100) }),
      },
    ),
    enabled: enabled && stableIds.length > 0,
    staleTime: 30_000,
  });
}

export function useCompanyWorkflowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      ...payload
    }: {
      companyId: string;
      action: string;
      reminderAt?: string | null;
      reason?: string;
      createTask?: boolean;
      createNote?: boolean;
    }) => apiJson<any>(`/api/companies/${encodeURIComponent(companyId)}/workflow`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.companies.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.companies.centralized(variables.companyId) }),
        queryClient.invalidateQueries({ queryKey: ["prospection", "session"] }),
      ]);
    },
  });
}
