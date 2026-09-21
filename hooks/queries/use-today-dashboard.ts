"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";

export type TodayContact = {
  id: string;
  properties: Record<string, string | null | undefined>;
  ownership?: "MINE" | "UNASSIGNED" | "OTHER";
  assignee?: string | null;
};

export type TodayTask = {
  id: string;
  properties: Record<string, string | null | undefined>;
  cockpitAssignee?: { email?: string | null; displayName?: string | null } | null;
  associations?: {
    contact?: { id: string; properties?: Record<string, string | null | undefined> } | null;
    company?: { id: string; properties?: Record<string, string | null | undefined> } | null;
  };
};

export type TodayPayload = {
  member?: { email?: string; displayName?: string | null };
  results?: TodayContact[];
  mineCount?: number;
  availableCount?: number;
  callableCount?: number;
  totalActionable?: number;
  callWindow?: string;
  error?: string;
};

export type OnoffStatus = {
  configured?: boolean;
  connected?: boolean | null;
  latestProcessingStatus?: string | null;
  error?: string | null;
};

export type AgendaPayload = {
  results?: any[];
  reminders?: TodayContact[];
  warnings?: string[];
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Impossible de charger les données.");
  return body as T;
}

function dayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function useTodayDashboard() {
  const range = dayRange();
  const agendaKey = ["agenda", "today", range.start.slice(0, 10)] as const;

  const today = useQuery({
    queryKey: ["today", "dashboard"],
    queryFn: () => getJson<TodayPayload>("/api/today"),
    staleTime: 10_000,
  });

  const onoff = useQuery({
    queryKey: ["onoff", "status"],
    queryFn: () => getJson<OnoffStatus>("/api/onoff/status"),
    staleTime: 30_000,
  });

  const todayTasks = useQuery({
    queryKey: queryKeys.tasks.list({ period: "today" }),
    queryFn: async () => (await getJson<{ results?: TodayTask[] }>("/api/tasks?period=today")).results || [],
    staleTime: 10_000,
  });

  const overdueTasks = useQuery({
    queryKey: queryKeys.tasks.list({ period: "overdue" }),
    queryFn: async () => (await getJson<{ results?: TodayTask[] }>("/api/tasks?period=overdue")).results || [],
    staleTime: 10_000,
  });

  const agenda = useQuery({
    queryKey: agendaKey,
    queryFn: () => getJson<AgendaPayload>(
      `/api/agenda?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`,
    ),
    staleTime: 10_000,
  });

  return {
    today,
    onoff,
    todayTasks,
    overdueTasks,
    agenda,
    agendaKey,
    isPending: today.isPending,
    isFetching: today.isFetching || onoff.isFetching || todayTasks.isFetching || overdueTasks.isFetching || agenda.isFetching,
  };
}
