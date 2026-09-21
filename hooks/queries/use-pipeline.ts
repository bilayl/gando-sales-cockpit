"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DealRoomDeal } from "@/lib/deal-room-types";
import type { SDCode, SDDocumentStatus, SDRoomMode } from "@/lib/sd-room-types";
import { apiJson } from "@/lib/query/api-client";
import { queryKeys } from "@/lib/query/query-keys";

export type PipelineRoom = {
  id: string;
  hubspot_deal_id: string;
  title: string;
  company_name: string;
  crm_link: string | null;
  prospect_logo_url: string | null;
  meeting_booking_url: string | null;
  room_mode: SDRoomMode;
  share_token: string;
  status: "draft" | "published" | "archived";
  current_stage: string;
  created_at: string;
  updated_at: string;
  documents: Array<{
    room_id: string;
    code: SDCode;
    status: SDDocumentStatus;
    source_mode: "manual" | "agent" | "mixed";
    version: number;
    published_version: number | null;
    updated_at: string;
  }>;
  opens: number;
  uniqueVisitors: number;
  lastViewedAt: string | null;
  openComments: number;
  crmConnected: boolean;
};

export function usePipelineDeals() {
  return useQuery({
    queryKey: queryKeys.pipeline.deals,
    queryFn: async () => {
      const body = await apiJson<{ results?: DealRoomDeal[] }>("/api/deals", { cache: "no-store" });
      return body.results || [];
    },
    staleTime: 30_000,
  });
}

export function usePipelineRooms() {
  return useQuery({
    queryKey: queryKeys.pipeline.rooms,
    queryFn: async () => {
      const body = await apiJson<{ results?: PipelineRoom[] }>("/api/sd-rooms", { cache: "no-store" });
      return body.results || [];
    },
    staleTime: 15_000,
  });
}

export function useUpdatePipelineRoomMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roomId, roomMode }: { roomId: string; roomMode: SDRoomMode }) =>
      apiJson("/api/sd-rooms", {
        method: "PATCH",
        body: JSON.stringify({ roomId, roomMode }),
      }),
    onMutate: async variables => {
      await queryClient.cancelQueries({ queryKey: queryKeys.pipeline.rooms });
      const previous = queryClient.getQueryData<PipelineRoom[]>(queryKeys.pipeline.rooms);
      queryClient.setQueryData<PipelineRoom[]>(queryKeys.pipeline.rooms, current =>
        (current || []).map(room => room.id === variables.roomId ? { ...room, room_mode: variables.roomMode } : room),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.pipeline.rooms, context.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.rooms });
    },
  });
}

export function useCreatePipelineRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      dealId,
      payload,
    }: {
      dealId?: string;
      payload: {
        title: string;
        companyName: string;
        meetingBookingUrl: string;
        roomMode: SDRoomMode;
      };
    }) =>
      apiJson<any>(
        dealId ? `/api/deals/${encodeURIComponent(dealId)}/sd-room` : "/api/sd-rooms",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.rooms }),
        queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.deals }),
      ]);
    },
  });
}
