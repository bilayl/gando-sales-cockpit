"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";

export type SegmentRecord = {
  listId: string;
  name: string;
  objectTypeId: string;
  size?: number;
};

export type OwnerRecord = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

export type CockpitAssignment = {
  company_id: string;
  assignee_cockpit_email: string;
};

async function readJson<T>(url: string, fallback: T): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return fallback;
  return response.json();
}

export function useSegments() {
  return useQuery({
    queryKey: queryKeys.segments.all,
    queryFn: async () => {
      const payload = await readJson<{ lists?: SegmentRecord[] }>("/api/segments", { lists: [] });
      return payload.lists || [];
    },
    staleTime: 5 * 60_000,
  });
}

export function useOwners() {
  return useQuery({
    queryKey: queryKeys.owners.all,
    queryFn: async () => {
      const payload = await readJson<{ results?: OwnerRecord[] }>("/api/owners", { results: [] });
      return payload.results || [];
    },
    staleTime: 5 * 60_000,
  });
}

export function useCurrentCockpitUser() {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => readJson<{ email?: string }>("/api/auth/me", {}),
    staleTime: 10 * 60_000,
  });
}

export function useProspectionAssignments() {
  return useQuery({
    queryKey: queryKeys.prospection.assignments,
    queryFn: async () => {
      const payload = await readJson<{ results?: CockpitAssignment[] }>("/api/prospection/assignments", { results: [] });
      return payload.results || [];
    },
    staleTime: 30_000,
  });
}
