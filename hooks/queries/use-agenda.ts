"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/query/api-client";
import { queryKeys } from "@/lib/query/query-keys";

export type AgendaMeeting = {
  id: string;
  properties?: {
    hs_meeting_title?: string;
    hs_meeting_start_time?: string;
    hs_meeting_end_time?: string;
    hs_meeting_outcome?: string;
    hs_meeting_location?: string;
    hs_meeting_body?: string;
    hs_timestamp?: string;
  };
};

export type AgendaTask = {
  id: string;
  properties?: {
    hs_task_subject?: string;
    hs_task_body?: string;
    hs_task_status?: string;
    hs_task_priority?: string;
    hs_task_type?: string;
    hs_timestamp?: string;
  };
};

export type AgendaReminder = {
  id: string;
  properties?: {
    firstname?: string;
    lastname?: string;
    email?: string;
    company?: string;
    date_prochaine_relance?: string;
    statut_de_lappel?: string;
    referly_reason_to_reach_out?: string;
  };
};

export type AgendaStats = {
  meetings: number;
  tasks: number;
  completedTasks: number;
  reminders: number;
  total: number;
};

export type AgendaPayload = {
  results?: AgendaMeeting[];
  tasks?: AgendaTask[];
  reminders?: AgendaReminder[];
  stats?: AgendaStats;
  warnings?: string[];
};

export function useAgenda(start: string, end: string) {
  return useQuery({
    queryKey: queryKeys.agenda.range(start, end),
    queryFn: () => apiJson<AgendaPayload>(
      `/api/agenda?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      { cache: "no-store" },
    ),
    placeholderData: previous => previous,
    staleTime: 30_000,
  });
}

export function useUpdateMeetingStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiJson(`/api/meetings/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: { hs_meeting_outcome: status } }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
  });
}
