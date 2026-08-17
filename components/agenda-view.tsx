"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  BellRing,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListTodo,
  Loader2,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MEETING_STATUSES, meetingStatusBadge, meetingStatusDot, meetingStatusLabel } from "@/lib/statuses";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type HMeeting = {
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

type HTask = {
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

type HReminder = {
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

type EventKind = "meeting" | "task" | "reminder";

type DayEvent = {
  id: string;
  recordId: string;
  kind: EventKind;
  title: string;
  start: Date;
  end: Date;
  location?: string;
  status?: string;
  description?: string;
  isPresentation?: boolean;
};

type AgendaStats = {
  meetings: number;
  tasks: number;
  completedTasks: number;
  reminders: number;
  total: number;
};

const HOUR_HEIGHT = 48;
const GRID_START = 8;
const GRID_END = 20;
const GRID_HEIGHT = (GRID_END - GRID_START) * HOUR_HEIGHT;
const MAX_RANGE_DAYS = 31;
const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const DAY_NAMES_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function startOfWeek(date: Date) {
  const value = startOfDay(date);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return value;
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function differenceInDays(start: Date, end: Date) {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86_400_000);
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit" }).format(date);
}

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date);
}

function formatPeriod(start: Date, end: Date) {
  if (sameDay(start, end)) {
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(start);
  }
  return `${formatDay(start)} ${new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(start)} – ${formatDay(end)} ${formatMonthYear(end)}`;
}

function formatDuration(milliseconds: number) {
  const minutes = Math.round(milliseconds / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${String(remainingMinutes).padStart(2, "0")}` : `${hours}h`;
}

function toDateInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateInput(value: string) {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) return null;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return Number.isNaN(date.getTime()) ? null : date;
}

function eventTop(event: DayEvent) {
  const minutes = event.start.getHours() * 60 + event.start.getMinutes();
  return Math.max(0, minutes - GRID_START * 60) * (HOUR_HEIGHT / 60);
}

function eventHeight(event: DayEvent, top: number) {
  const startMinutes = event.start.getHours() * 60 + event.start.getMinutes();
  const endMinutes = event.end.getHours() * 60 + event.end.getMinutes();
  const duration = Math.max(30, endMinutes - startMinutes);
  const height = Math.min(duration * (HOUR_HEIGHT / 60), Math.max(0, GRID_HEIGHT - top));
  return Math.max(26, height);
}

function layoutDay(events: DayEvent[]) {
  const sorted = [...events].sort((left, right) => left.start.getTime() - right.start.getTime() || left.end.getTime() - right.end.getTime());
  const columns: number[] = [];
  const placements = sorted.map(event => {
    const availableColumn = columns.findIndex(end => end <= event.start.getTime());
    if (availableColumn === -1) {
      columns.push(event.end.getTime());
      return columns.length - 1;
    }
    columns[availableColumn] = Math.max(columns[availableColumn], event.end.getTime());
    return availableColumn;
  });

  return sorted.map((event, index) => {
    let span = 1;
    for (let comparedIndex = 0; comparedIndex < sorted.length; comparedIndex++) {
      if (index === comparedIndex) continue;
      if (event.start < sorted[comparedIndex].end && event.end > sorted[comparedIndex].start) {
        span = Math.max(span, placements[comparedIndex] + 1);
      }
    }
    return { event, column: placements[index], span };
  });
}

function eventLabel(kind: EventKind) {
  if (kind === "meeting") return "Rendez-vous";
  if (kind === "task") return "Tâche HubSpot";
  return "Rappel HubSpot";
}

function eventIcon(kind: EventKind) {
  if (kind === "task") return ListTodo;
  if (kind === "reminder") return BellRing;
  return CalendarCheck2;
}

function eventClasses(kind: EventKind) {
  if (kind === "task") return "border-dashed border-primary/35 bg-primary/[0.07] hover:bg-primary/[0.12]";
  if (kind === "reminder") return "border-primary/20 bg-primary/[0.045] shadow-[inset_3px_0_0_hsl(var(--primary))] hover:bg-primary/[0.09]";
  return "border-primary/30 bg-primary/[0.12] hover:bg-primary/[0.17]";
}

export function AgendaView() {
  const [today] = useState(() => new Date());
  const [rangeStart, setRangeStart] = useState(() => startOfWeek(new Date()));
  const [rangeEnd, setRangeEnd] = useState(() => addDays(startOfWeek(new Date()), 6));
  const [meetings, setMeetings] = useState<HMeeting[]>([]);
  const [tasks, setTasks] = useState<HTask[]>([]);
  const [reminders, setReminders] = useState<HReminder[]>([]);
  const [stats, setStats] = useState<AgendaStats>({ meetings: 0, tasks: 0, completedTasks: 0, reminders: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceFilter, setSourceFilter] = useState<EventKind | "all">("all");
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState<DayEvent | null>(null);
  const [editMeeting, setEditMeeting] = useState<{ id: string; title: string; start: Date; status: string } | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const loadAgenda = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const endExclusive = addDays(rangeEnd, 1);
      const response = await fetch(`/api/agenda?start=${encodeURIComponent(startOfDay(rangeStart).toISOString())}&end=${encodeURIComponent(startOfDay(endExclusive).toISOString())}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Impossible de charger l’agenda HubSpot");
      setMeetings(data.results || []);
      setTasks(data.tasks || []);
      setReminders(data.reminders || []);
      setStats(data.stats || { meetings: 0, tasks: 0, completedTasks: 0, reminders: 0, total: 0 });
      if (data.warnings?.length) setError(`Certaines sources HubSpot n’ont pas pu être chargées : ${data.warnings.join(", ")}.`);
    } catch (reason) {
      setMeetings([]);
      setTasks([]);
      setReminders([]);
      setStats({ meetings: 0, tasks: 0, completedTasks: 0, reminders: 0, total: 0 });
      setError(reason instanceof Error ? reason.message : "Impossible de charger l’agenda HubSpot");
    } finally {
      setLoading(false);
    }
  }, [rangeEnd, rangeStart]);

  useEffect(() => {
    void loadAgenda();
  }, [loadAgenda]);

  const days = useMemo(() => {
    const count = Math.min(MAX_RANGE_DAYS, differenceInDays(rangeStart, rangeEnd) + 1);
    return Array.from({ length: Math.max(1, count) }, (_, index) => addDays(rangeStart, index));
  }, [rangeEnd, rangeStart]);

  const allEvents = useMemo(() => {
    const meetingEvents = meetings.flatMap(meeting => {
      const startValue = meeting.properties?.hs_meeting_start_time || meeting.properties?.hs_timestamp;
      if (!startValue) return [];
      const start = new Date(startValue);
      if (Number.isNaN(start.getTime())) return [];
      const endValue = meeting.properties?.hs_meeting_end_time;
      const end = endValue ? new Date(endValue) : new Date(start.getTime() + 60 * 60_000);
      const properties = meeting.properties || {};
      const isPresentation = [
        properties.hs_meeting_title,
        properties.hs_meeting_body,
        properties.hs_meeting_location,
      ].some(value => value?.toLowerCase().includes("meet.brevo.com/gando-presentation"));
      return [{
        id: `meeting-${meeting.id}`,
        recordId: meeting.id,
        kind: "meeting",
        title: meeting.properties?.hs_meeting_title || "Rendez-vous",
        start,
        end,
        location: meeting.properties?.hs_meeting_location,
        status: meeting.properties?.hs_meeting_outcome,
        isPresentation,
      } satisfies DayEvent];
    });

    const taskEvents = tasks.flatMap(task => {
      if (task.properties?.hs_task_status === "COMPLETED") return [];
      const startValue = task.properties?.hs_timestamp;
      if (!startValue) return [];
      const start = new Date(startValue);
      if (Number.isNaN(start.getTime())) return [];
      return [{
        id: `task-${task.id}`,
        recordId: task.id,
        kind: "task",
        title: task.properties?.hs_task_subject || "Tâche HubSpot",
        start,
        end: new Date(start.getTime() + 30 * 60_000),
        status: task.properties?.hs_task_status,
        description: task.properties?.hs_task_body,
      } satisfies DayEvent];
    });

    const reminderEvents = reminders.flatMap(reminder => {
      const startValue = reminder.properties?.date_prochaine_relance;
      if (!startValue) return [];
      const start = new Date(startValue);
      if (Number.isNaN(start.getTime())) return [];
      const name = [reminder.properties?.firstname, reminder.properties?.lastname].filter(Boolean).join(" ");
      return [{
        id: `reminder-${reminder.id}`,
        recordId: reminder.id,
        kind: "reminder",
        title: `Rappeler — ${name || reminder.properties?.company || "Contact"}`,
        start,
        end: new Date(start.getTime() + 20 * 60_000),
        status: reminder.properties?.statut_de_lappel,
        description: reminder.properties?.referly_reason_to_reach_out || reminder.properties?.company || reminder.properties?.email,
      } satisfies DayEvent];
    });

    return [...meetingEvents, ...taskEvents, ...reminderEvents];
  }, [meetings, reminders, tasks]);

  const filteredEvents = useMemo(() => allEvents.filter(event => {
    if (sourceFilter !== "all" && event.kind !== sourceFilter) return false;
    if (statusFilter && event.kind === "meeting" && event.status !== statusFilter) return false;
    return true;
  }), [allEvents, sourceFilter, statusFilter]);

  const metricRows = useMemo(() => {
    const periodDays = Math.max(1, days.length);
    return [
      { label: "Activités", value: stats.total, detail: `${periodDays} jour${periodDays > 1 ? "s" : ""}`, icon: BarChart3 },
      { label: "Rendez-vous", value: stats.meetings, detail: "sources HubSpot", icon: CalendarCheck2 },
      { label: "Tâches ouvertes", value: Math.max(0, stats.tasks - stats.completedTasks), detail: `${stats.completedTasks} terminée${stats.completedTasks > 1 ? "s" : ""}`, icon: ListTodo },
      { label: "Rappels", value: stats.reminders, detail: "Contacts à relancer", icon: BellRing },
      { label: "Charge moyenne", value: (stats.total / periodDays).toLocaleString("fr-FR", { maximumFractionDigits: 1 }), detail: "activité / jour", icon: Clock },
    ];
  }, [days.length, stats]);

  function setThisWeek() {
    const start = startOfWeek(today);
    setRangeStart(start);
    setRangeEnd(addDays(start, 6));
  }

  function setTodayOnly() {
    const day = startOfDay(today);
    setRangeStart(day);
    setRangeEnd(day);
  }

  function shiftPeriod(direction: -1 | 1) {
    const amount = days.length * direction;
    setRangeStart(current => addDays(current, amount));
    setRangeEnd(current => addDays(current, amount));
  }

  function updateStart(value: string) {
    const date = fromDateInput(value);
    if (!date) return;
    setRangeStart(date);
    if (date > rangeEnd) setRangeEnd(date);
    else if (differenceInDays(date, rangeEnd) >= MAX_RANGE_DAYS) setRangeEnd(addDays(date, MAX_RANGE_DAYS - 1));
  }

  function updateEnd(value: string) {
    const date = fromDateInput(value);
    if (!date) return;
    const validEnd = date < rangeStart ? rangeStart : date;
    setRangeEnd(differenceInDays(rangeStart, validEnd) >= MAX_RANGE_DAYS ? addDays(rangeStart, MAX_RANGE_DAYS - 1) : validEnd);
  }

  function openStatusEditor(event: DayEvent) {
    if (event.kind !== "meeting") return;
    setEditMeeting({ id: event.recordId, title: event.title, start: event.start, status: event.status || "" });
    setEditStatus(event.status || "");
    setDetail(null);
  }

  async function saveStatus() {
    if (!editMeeting) return;
    setSavingStatus(true);
    setError("");
    try {
      const response = await fetch(`/api/meetings/${editMeeting.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ properties: { hs_meeting_outcome: editStatus } }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || "HubSpot a rejeté le statut");
      setMeetings(current => current.map(meeting => meeting.id === editMeeting.id
        ? { ...meeting, properties: { ...meeting.properties, hs_meeting_outcome: editStatus } }
        : meeting));
      setEditMeeting(null);
      toast.success(editMeeting.id.startsWith("gcal-") ? "Statut synchronisé avec le CRM." : "Statut enregistré dans HubSpot.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de modifier le statut");
      toast.error(reason instanceof Error ? reason.message : "Impossible de modifier le statut");
    } finally {
      setSavingStatus(false);
    }
  }

  const periodLabel = formatPeriod(rangeStart, rangeEnd);
  const gridTemplateColumns = `44px repeat(${days.length}, minmax(118px, 1fr))`;
  const gridMinWidth = Math.max(560, 44 + days.length * 122);

  return (
    <div className="page-shell min-h-screen minari-scrollbar">
      <div className="page-content">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-primary"><CalendarCheck2 className="h-4 w-4" /> Agenda HubSpot</div>
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.035em]">Agenda</h1>
            <p className="mt-1 text-sm text-muted-foreground">Tous les rendez-vous Google Calendar et HubSpot, avec les tâches et rappels.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadAgenda()}><RefreshCw /> Actualiser</Button>
        </header>

        {error ? <div role="alert" className="mt-4 rounded-lg border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm text-foreground">{error}</div> : null}

        <section className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-5">
          {metricRows.map(({ label, value, detail: metricDetail, icon: Icon }, index) => (
            <div key={label} className={cn("flex min-h-24 items-center gap-3 px-4 py-3", index % 2 === 1 && "border-l border-border", index > 1 && "border-t border-border", index > 0 && "lg:border-l lg:border-t-0", index === 4 && "col-span-2 lg:col-span-1")}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/15 bg-primary/[0.06] text-primary"><Icon className="h-4 w-4" /></span>
              <div><div className="text-xl font-bold tracking-tight">{value}</div><div className="mt-0.5 text-[11px] font-semibold text-foreground">{label}</div><div className="text-[10px] text-muted-foreground">{metricDetail}</div></div>
            </div>
          ))}
        </section>

        <Card className="mt-6">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-primary" /> Période</CardTitle>
                <CardDescription>{filteredEvents.length} activité{filteredEvents.length > 1 ? "s" : ""} affichée{filteredEvents.length > 1 ? "s" : ""} · {periodLabel}</CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={() => shiftPeriod(-1)} aria-label="Période précédente"><ChevronLeft /></Button>
                <Button variant="outline" size="icon" onClick={() => shiftPeriod(1)} aria-label="Période suivante"><ChevronRight /></Button>
                <Button variant="outline" className="ml-1" onClick={setTodayOnly}>Aujourd’hui</Button>
                <Button variant="outline" onClick={setThisWeek}>Cette semaine</Button>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/35 p-3">
              <label className="space-y-1.5"><span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Du</span><Input type="date" value={toDateInput(rangeStart)} onChange={event => updateStart(event.target.value)} className="h-9 w-[160px] bg-card" /></label>
              <label className="space-y-1.5"><span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Au</span><Input type="date" value={toDateInput(rangeEnd)} min={toDateInput(rangeStart)} max={toDateInput(addDays(rangeStart, MAX_RANGE_DAYS - 1))} onChange={event => updateEnd(event.target.value)} className="h-9 w-[160px] bg-card" /></label>
              <div className="ml-auto flex flex-wrap gap-2">
                <Select value={sourceFilter} onValueChange={value => setSourceFilter(value as EventKind | "all")}>
                  <SelectTrigger className="h-9 w-[180px] bg-card text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Toutes les sources</SelectItem><SelectItem value="meeting">Rendez-vous</SelectItem><SelectItem value="task">Tâches HubSpot</SelectItem><SelectItem value="reminder">Rappels HubSpot</SelectItem></SelectContent>
                </Select>
                <Select value={statusFilter || "__all__"} onValueChange={value => setStatusFilter(value === "__all__" ? "" : value)}>
                  <SelectTrigger className="h-9 w-[180px] bg-card text-xs"><SelectValue placeholder="Statut RDV" /></SelectTrigger>
                  <SelectContent><SelectItem value="__all__">Tous les statuts RDV</SelectItem>{MEETING_STATUSES.map(status => <SelectItem key={status.key} value={status.key}>{status.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary/75" />Rendez-vous</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-dashed border-primary bg-primary/25" />Tâche HubSpot</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border-l-[3px] border-primary bg-primary/10" />Rappel HubSpot</span>
              <span className="ml-auto">Tous les rendez-vous Google Calendar et HubSpot</span>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="animate-spin text-primary" /> Chargement de l’agenda HubSpot…</div>
            ) : (
              <div className="overflow-x-auto">
                <div style={{ minWidth: gridMinWidth, width: "100%" }}>
                  <div className="grid" style={{ gridTemplateColumns }}>
                    <div />
                    {days.map(day => (
                      <div key={day.getTime()} className="border-l border-border py-2 text-center">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{DAY_NAMES_SHORT[(day.getDay() + 6) % 7]}</div>
                        <div className={cn("mt-0.5 text-sm font-semibold", sameDay(day, today) && "text-primary")}>{formatDay(day)}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid border-t border-border" style={{ gridTemplateColumns }}>
                    <div className="relative" style={{ height: GRID_HEIGHT }}>
                      {Array.from({ length: GRID_END - GRID_START + 1 }, (_, index) => GRID_START + index).map(hour => <div key={hour} className="absolute right-2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground" style={{ top: (hour - GRID_START) * HOUR_HEIGHT }}>{String(hour).padStart(2, "0")}:00</div>)}
                    </div>

                    {days.map(day => {
                      const dayStart = startOfDay(day);
                      const dayEnd = addDays(dayStart, 1);
                      const events = filteredEvents.filter(event => event.start < dayEnd && event.end > dayStart).map(event => ({ ...event, start: event.start < dayStart ? dayStart : event.start, end: event.end > dayEnd ? dayEnd : event.end }));
                      const placedEvents = layoutDay(events);
                      const nowTop = Math.max(0, (today.getHours() * 60 + today.getMinutes() - GRID_START * 60)) * (HOUR_HEIGHT / 60);

                      return (
                        <div key={day.getTime()} className="relative border-l border-border" style={{ height: GRID_HEIGHT, backgroundImage: "repeating-linear-gradient(to bottom, hsla(240,10%,55%,0.16) 0px, hsla(240,10%,55%,0.16) 1px, transparent 1px, transparent 48px)" }}>
                          {sameDay(day, today) && nowTop <= GRID_HEIGHT ? <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowTop }}><div className="h-[2px] bg-primary/70" /><div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary" /></div> : null}
                          {placedEvents.map(({ event, column, span }) => {
                            const top = eventTop(event);
                            const height = eventHeight(event, top);
                            const Icon = eventIcon(event.kind);
                            return (
                              <button type="button" key={event.id} onClick={() => setDetail(event)} title={`${event.title} — ${eventLabel(event.kind)}`} className={cn("absolute z-10 cursor-pointer overflow-hidden rounded-lg border px-1.5 py-1 text-left text-foreground transition-colors", eventClasses(event.kind))} style={{ top, height, left: `calc(${(column * 100) / span}% + 1px)`, width: `calc(${100 / span}% - 3px)` }}>
                                <div className="truncate pr-3 text-[11px] font-semibold leading-tight">{event.title}</div>
                                {height >= 34 ? <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{formatTime(event.start)}</div> : null}
                                <Icon className="absolute right-1 top-1 h-3 w-3 text-primary" />
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {!loading && !filteredEvents.length ? <div className="border-t border-border py-5 text-center text-sm text-muted-foreground">Aucune activité HubSpot pour cette période et ces filtres.</div> : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(detail)} onOpenChange={open => !open && setDetail(null)}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          <div className="h-1.5 w-full bg-primary" />
          <div className="p-6 pt-5">
            <DialogHeader>
              <div className="mb-4 flex items-center gap-3 pr-8">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{detail ? (() => { const Icon = eventIcon(detail.kind); return <Icon />; })() : null}</div>
                <div className="min-w-0"><DialogTitle className="truncate">{detail?.title}</DialogTitle><DialogDescription className="mt-0.5">{detail ? `${DAY_NAMES[(detail.start.getDay() + 6) % 7]} ${formatDay(detail.start)} ${formatMonthYear(detail.start)}` : ""}</DialogDescription></div>
                {detail ? <Badge variant="outline" className="ml-auto shrink-0 border-primary/20 bg-primary/[0.07] text-primary">{eventLabel(detail.kind)}</Badge> : null}
                {detail?.isPresentation ? <Badge variant="outline" className="shrink-0 border-primary/30 bg-primary/10 font-medium text-primary">Présentation Gando</Badge> : null}
              </div>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/20 px-3 py-2.5"><Clock className="h-4 w-4 shrink-0 text-primary" /><div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Heure</div><div className="font-mono text-sm">{detail ? `${formatTime(detail.start)} → ${formatTime(detail.end)}` : ""}</div></div></div>
              <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/20 px-3 py-2.5"><CalendarDays className="h-4 w-4 shrink-0 text-primary" /><div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Durée</div><div className="font-mono text-sm">{detail ? formatDuration(detail.end.getTime() - detail.start.getTime()) : ""}</div></div></div>
            </div>

            {detail?.status ? <div className="mt-2 flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2.5"><span className="text-xs text-muted-foreground">Statut</span>{detail.kind === "meeting" ? <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium", meetingStatusBadge(detail.status))}><span className={cn("h-2 w-2 rounded-full", meetingStatusDot(detail.status))} />{meetingStatusLabel(detail.status)}</span> : <Badge variant="outline">{detail.status === "COMPLETED" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}{detail.status.replaceAll("_", " ")}</Badge>}</div> : null}
            {detail?.location ? <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-border bg-muted/20 px-3 py-2.5"><MapPin className="h-4 w-4 shrink-0 text-primary" /><span className="truncate text-sm text-muted-foreground">{detail.location}</span></div> : null}
            {detail?.description ? <div className="mt-2 rounded-xl border border-border bg-muted/20 px-3 py-2.5 text-sm leading-6 text-muted-foreground">{detail.description}</div> : null}

            <DialogFooter className="mt-4 gap-2">
              {detail?.kind === "meeting" ? <Button variant="outline" onClick={() => openStatusEditor(detail)}>Changer le statut</Button> : null}
              <Button onClick={() => setDetail(null)}>Fermer</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editMeeting)} onOpenChange={open => !open && setEditMeeting(null)}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          <div className="h-1.5 w-full bg-primary" />
          <div className="p-6 pt-5">
            <DialogHeader><div className="flex items-center gap-3 pr-8"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><CalendarCheck2 /></div><div className="min-w-0"><DialogTitle>Changer le statut</DialogTitle><DialogDescription className="mt-0.5 truncate">{editMeeting ? `${editMeeting.title} — ${formatTime(editMeeting.start)}` : ""}</DialogDescription></div></div></DialogHeader>
            <div className="mt-4"><div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">Statut du rendez-vous</div><Select value={editStatus} onValueChange={setEditStatus}><SelectTrigger className="h-11 w-full"><SelectValue placeholder="Choisir un statut" /></SelectTrigger><SelectContent>{MEETING_STATUSES.map(status => <SelectItem key={status.key} value={status.key}>{status.label}</SelectItem>)}</SelectContent></Select></div>
            <DialogFooter className="mt-5 gap-2"><Button variant="outline" onClick={() => setEditMeeting(null)}>Annuler</Button><Button onClick={() => void saveStatus()} disabled={savingStatus}>{savingStatus ? <Loader2 className="animate-spin" /> : null}Enregistrer</Button></DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
