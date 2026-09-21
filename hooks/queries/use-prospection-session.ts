"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";

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

type ProspectionSessionPayload = {
  summaries: Record<string, ProspectionTaskSummary>;
  onoff: OnoffSessionState | null;
};

export function useProspectionSessionData(companyIds: string[], enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.prospection.session(companyIds),
    queryFn: async (): Promise<ProspectionSessionPayload> => {
      if (!companyIds.length) return { summaries: {}, onoff: null };
      const response = await fetch("/api/prospection/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyIds }),
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Impossible de préparer la session");
      return {
        summaries: body.summaries || {},
        onoff: body.onoff || null,
      };
    },
    enabled: enabled && companyIds.length > 0,
    staleTime: 30_000,
  });
}
