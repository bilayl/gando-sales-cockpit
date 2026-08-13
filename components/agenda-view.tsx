"use client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarCheck2, CalendarDays, ChevronLeft, ChevronRight, Clock, Link2, ListTodo, Loader2, MapPin, PhoneCall, RefreshCw, TimerReset } from "lucide-react";
import { cn } from "@/lib/utils";
import { MEETING_STATUSES, meetingStatusBadge, meetingStatusDot, meetingStatusLabel } from "@/lib/statuses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type GEvent = {
  id: string;
  summary: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
};

type HMeeting = {
  id: string;
  properties?: { hs_meeting_title?: string; hubspot_owner_id?: string; hs_meeting_start_time?: string; hs_meeting_end_time?: string; hs_timestamp?: string; hs_meeting_outcome?: string };
};

type HTask = {
  id: string;
  properties?: { hs_task_subject?: string; hs_task_type?: string; hs_task_status?: string; hs_task_priority?: string; hs_timestamp?: string };
};

type HReminder = {
  id: string;
  properties?: { firstname?: string; lastname?: string; company?: string; date_prochaine_relance?: string; statut_de_lappel?: string };
};

type DayEvent = {
  id: string;
  source: "google" | "hubspot";
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string;
  status?: string;
  kind?: "meeting" | "task" | "reminder";
};

const HOUR_H = 48;
const GRID_START = 8;
const GRID_END = 20;
const GRID_H = (GRID_END - GRID_START) * HOUR_H;
const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const DAY_NAMES_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtTime(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

function fmtDayNum(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit" }).format(d);
}

function fmtMonthYear(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(d);
}

function topOf(ev: DayEvent) {
  const minutes = ev.start.getHours() * 60 + ev.start.getMinutes();
  return Math.max(0, (minutes - GRID_START * 60)) * (HOUR_H / 60);
}

function heightOf(ev: DayEvent, top: number) {
  const startMin = ev.start.getHours() * 60 + ev.start.getMinutes();
  const endMin = ev.end.getHours() * 60 + ev.end.getMinutes();
  const durationMin = Math.max(30, endMin - startMin);
  let h = durationMin * (HOUR_H / 60);
  h = Math.min(h, Math.max(0, GRID_H - top));
  return Math.max(24, h);
}

function layoutDay(events: DayEvent[]) {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
  const cols: number[] = [];
  const placed = sorted.map(ev => {
    const col = cols.findIndex(c => c <= ev.start.getTime());
    if (col === -1) {
      cols.push(ev.end.getTime());
      return cols.length - 1;
    }
    cols[col] = Math.max(cols[col], ev.end.getTime());
    return col;
  });
  return sorted.map((ev, i) => {
    let span = 1;
    for (let j = 0; j < sorted.length; j++) {
      if (i === j) continue;
      if (ev.start < sorted[j].end && ev.end > sorted[j].start) span = Math.max(span, placed[j] + 1);
    }
    return { ev, col: placed[i], span };
  });
}

function fmtDuration(ms: number) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${String(m).padStart(2, "0")}` : `${h}h`;
}

function freeSlotsForDay(day: Date, events: DayEvent[], gridStart = GRID_START, gridEnd = GRID_END) {
  const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = addDays(day, 1);
  const busy = events
    .filter(ev => !ev.allDay && ev.start < dayEnd && ev.end > dayStart)
    .map(ev => ({ start: ev.start < dayStart ? dayStart : ev.start, end: ev.end > dayEnd ? dayEnd : ev.end }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const windowStart = new Date(day); windowStart.setHours(gridStart, 0, 0, 0);
  const windowEnd = new Date(day); windowEnd.setHours(gridEnd, 0, 0, 0);
  const slots: { start: Date; end: Date }[] = [];
  let cursor = windowStart;
  for (const b of busy) {
    if (b.end <= cursor) continue;
    if (b.start > cursor) {
      const s = b.start < windowEnd ? b.start : windowEnd;
      if (s > cursor) slots.push({ start: cursor, end: s });
    }
    cursor = b.end > cursor ? b.end : cursor;
  }
  if (cursor < windowEnd) slots.push({ start: cursor, end: windowEnd });
  return slots;
}

export function AgendaView() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [gEvents, setGEvents] = useState<GEvent[]>([]);
  const [gStatus, setGStatus] = useState<"loading" | "unauthorized" | "unconfigured" | "error" | "ok">("loading");
  const [gError, setGError] = useState("");
  const [meetings, setMeetings] = useState<HMeeting[]>([]);
  const [tasks, setTasks] = useState<HTask[]>([]);
  const [reminders, setReminders] = useState<HReminder[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(true);
  const [banner, setBanner] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState<{ ev: DayEvent; day: Date } | null>(null);
  const [editMeeting, setEditMeeting] = useState<{ id: string; title: string; start: Date; status: string } | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const loadGoogle = useCallback(async () => {
    setGStatus("loading");
    try {
      const start = weekStart.toISOString();
      const end = addDays(weekStart, 7).toISOString();
      const r = await fetch(`/api/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      const d = await r.json();
      if (r.status === 401) { setGStatus("unauthorized"); return; }
      if (r.status === 501) { setGStatus("unconfigured"); return; }
      if (!r.ok) { setGStatus("error"); setGError(d?.error || "Erreur Google Calendar"); return; }
      setGEvents(d.items || []);
      setGStatus("ok");
    } catch {
      setGStatus("error");
      setGError("Impossible de charger Google Calendar");
    }
  }, [weekStart]);

  const loadMeetings = useCallback(async () => {
    setMeetingsLoading(true);
    try {
      const end = addDays(weekStart, 7);
      const r = await fetch(`/api/agenda?start=${encodeURIComponent(weekStart.toISOString())}&end=${encodeURIComponent(end.toISOString())}`);
      const d = await r.json();
      if (r.ok) {
        setMeetings(d.results || []);
        setTasks(d.tasks || []);
        setReminders(d.reminders || []);
        if (d.warnings?.length) setBanner(`Certaines données HubSpot n’ont pas pu être chargées : ${d.warnings.join(", ")}.`);
      }
    } catch {
      setMeetings([]);
      setTasks([]);
      setReminders([]);
    } finally {
      setMeetingsLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { loadGoogle(); }, [loadGoogle]);
  useEffect(() => {
    loadMeetings();
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) setBanner(err);
  }, [loadMeetings]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const weekLabel = `${fmtDayNum(weekStart)} – ${fmtDayNum(addDays(weekStart, 6))} ${fmtMonthYear(weekStart)}`;

  const weekEvents = useMemo(() => {
    const list: DayEvent[] = [];
    for (const e of gEvents) {
      const start = e.start?.dateTime ? new Date(e.start.dateTime) : e.start?.date ? new Date(`${e.start.date}T00:00:00`) : null;
      if (!start || Number.isNaN(start.getTime())) continue;
      const end = e.end?.dateTime ? new Date(e.end.dateTime) : e.end?.date ? new Date(`${e.end.date}T00:00:00`) : new Date(start.getTime() + 3600000);
      list.push({ id: `g-${e.id}`, source: "google", title: e.summary || "Sans titre", start, end, allDay: Boolean(e.start?.date && !e.start?.dateTime), location: e.location });
    }
    for (const m of meetings) {
      const start = m.properties?.hs_meeting_start_time || m.properties?.hs_timestamp;
      if (!start) continue;
      const s = new Date(start);
      if (Number.isNaN(s.getTime())) continue;
      const endRaw = m.properties?.hs_meeting_end_time;
      const e = endRaw ? new Date(endRaw) : new Date(s.getTime() + 3600000);
      list.push({ id: `h-${m.id}`, source: "hubspot", kind: "meeting", title: m.properties?.hs_meeting_title || "Rendez-vous HubSpot", start: s, end: e, allDay: false, status: m.properties?.hs_meeting_outcome });
    }
    for (const task of tasks) {
      const start = task.properties?.hs_timestamp;
      if (!start) continue;
      const s = new Date(start);
      if (Number.isNaN(s.getTime())) continue;
      list.push({ id: `t-${task.id}`, source: "hubspot", kind: "task", title: task.properties?.hs_task_subject || "Tâche HubSpot", start: s, end: new Date(s.getTime() + 30 * 60_000), allDay: false, status: task.properties?.hs_task_status });
    }
    for (const reminder of reminders) {
      const start = reminder.properties?.date_prochaine_relance;
      if (!start) continue;
      const s = new Date(start);
      if (Number.isNaN(s.getTime())) continue;
      const name = [reminder.properties?.firstname, reminder.properties?.lastname].filter(Boolean).join(" ") || reminder.properties?.company || "Contact";
      list.push({ id: `r-${reminder.id}`, source: "hubspot", kind: "reminder", title: `Rappeler · ${name}`, start: s, end: new Date(s.getTime() + 30 * 60_000), allDay: false, status: reminder.properties?.statut_de_lappel });
    }
    return list;
  }, [gEvents, meetings, reminders, tasks]);

  const filteredWeekEvents = useMemo(() => {
    if (!statusFilter) return weekEvents;
    return weekEvents.filter(ev => ev.kind !== "meeting" || ev.status === statusFilter);
  }, [weekEvents, statusFilter]);

  const eventColors = (source: "google" | "hubspot", kind?: DayEvent["kind"]) => {
    if (source === "google") return "border-violet-400/40 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25";
    if (kind === "task") return "border-sky-400/40 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25";
    if (kind === "reminder") return "border-amber-400/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25";
    return "border-emerald-400/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25";
  };

  const gridLoading = gStatus === "loading" || meetingsLoading;

  function openDetail(ev: DayEvent) {
    setDetail({ ev, day: new Date(ev.start.getFullYear(), ev.start.getMonth(), ev.start.getDate()) });
  }

  function openStatusEditor(ev: DayEvent) {
    setEditMeeting({ id: ev.id.replace(/^h-/, ""), title: ev.title, start: ev.start, status: ev.status ?? "" });
    setEditStatus(ev.status ?? "");
  }

  async function saveStatus() {
    if (!editMeeting) return;
    setSavingStatus(true);
    setGError("");
    try {
      const r = await fetch(`/api/meetings/${editMeeting.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ properties: { hs_meeting_outcome: editStatus } }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "HubSpot a rejeté le statut");
      }
      setMeetings(prev => prev.map(m => m.id === editMeeting.id ? { ...m, properties: { ...m.properties, hs_meeting_outcome: editStatus } } : m));
      setEditMeeting(null);
    } catch (e) {
      setGError(e instanceof Error ? e.message : "Impossible de modifier le statut");
    } finally {
      setSavingStatus(false);
    }
  }

  return <div className="min-h-[calc(100vh-24px)] p-6 minari-scrollbar">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(115,93,243,0.9)]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-300">Planification</span>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Agenda</h1>
        <p className="mt-1 text-sm text-muted-foreground">Rendez-vous HubSpot et agenda Google Calendar.</p>
      </div>
      <div className="flex items-center gap-2">
        {gStatus === "unauthorized"
          ? <Button asChild className="h-9"><a href="/api/auth/google"><Link2 size={15} /> Connecter Google Calendar</a></Button>
          : gStatus === "ok" ? <Badge variant="outline" className="border-emerald-400/30 bg-emerald-400/10 text-emerald-300">● Connecté</Badge> : null}
        <Button variant="outline" onClick={() => { setBanner(""); loadGoogle(); loadMeetings(); }}><RefreshCw size={15} /> Actualiser</Button>
      </div>
    </div>

    {banner ? <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">{banner}</div> : null}
    {gError ? <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{gError}</div> : null}

    <Card className="mt-6">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base"><CalendarDays size={16} className="text-violet-300" /> Semaine</CardTitle>
          <CardDescription>Google Calendar + rendez-vous HubSpot fusionnés.</CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(w => addDays(w, -7))} aria-label="Semaine précédente"><ChevronLeft size={16} /></Button>
          <div className="min-w-[190px] px-2 text-center text-sm font-semibold">{weekLabel}</div>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(w => addDays(w, 7))} aria-label="Semaine suivante"><ChevronRight size={16} /></Button>
          <Button variant="outline" className="ml-1" onClick={() => setWeekStart(startOfWeek(new Date()))}>Aujourd'hui</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-violet-400/70" />Google Calendar</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400/70" />RDV HubSpot</span>
            <span className="inline-flex items-center gap-1.5"><PhoneCall size={12} />Cliquer sur un événement pour voir les disponibilités</span>
            {gStatus === "unconfigured" ? <span className="text-amber-300">Google Calendar n'est pas configuré (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI).</span> : null}
          </div>
          <Select value={statusFilter === "" ? "__all__" : statusFilter} onValueChange={v => setStatusFilter(v === "__all__" ? "" : v)}>
            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Statut RDV" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous les statuts</SelectItem>
              {MEETING_STATUSES.map(s => <SelectItem key={s.key} value={s.key}><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${s.dot}`} />{s.label}</span></SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {gridLoading ? <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="animate-spin text-violet-300" /> Chargement de l'agenda…</div> : (
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid" style={{ gridTemplateColumns: "44px repeat(7, 1fr)" }}>
                <div />
                {days.map(d => (
                  <div key={d.getTime()} className="border-l border-border py-2 text-center">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{DAY_NAMES_SHORT[(d.getDay() + 6) % 7]}</div>
                    <div className={cn("mt-0.5 text-sm font-semibold", sameDay(d, new Date()) && "text-violet-300")}>{fmtDayNum(d)}</div>
                  </div>
                ))}
              </div>

              <div className="grid border-b border-t border-border bg-muted/20" style={{ gridTemplateColumns: "44px repeat(7, 1fr)" }}>
                <div className="px-2 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Journée</div>
                {days.map(d => {
                  const chips = filteredWeekEvents.filter(ev => ev.allDay && sameDay(ev.start, d));
                  return <div key={d.getTime()} className="min-h-[30px] border-l border-border p-1">
                    {chips.length === 0 ? null : <div className="flex flex-wrap gap-1">
                      {chips.map(c => <span key={c.id} className={cn("max-w-full truncate rounded-md border px-2 py-0.5 text-[11px] font-medium", eventColors(c.source, c.kind))} title={c.title}>{c.title}</span>)}
                    </div>}
                  </div>;
                })}
              </div>

              <div className="grid" style={{ gridTemplateColumns: "44px repeat(7, 1fr)" }}>
                <div className="relative" style={{ height: GRID_H }}>
                  {Array.from({ length: GRID_END - GRID_START + 1 }, (_, i) => GRID_START + i).map(h => (
                    <div key={h} className="absolute right-2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground" style={{ top: (h - GRID_START) * HOUR_H }}>{String(h).padStart(2, "0")}:00</div>
                  ))}
                </div>
                {days.map(d => {
                  const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
                  const dayEnd = addDays(d, 1);
                  const timed = filteredWeekEvents
                    .filter(ev => !ev.allDay && ev.start < dayEnd && ev.end > dayStart)
                    .map(ev => ({ ...ev, start: ev.start < dayStart ? dayStart : ev.start, end: ev.end > dayEnd ? dayEnd : ev.end }));
                  const placed = layoutDay(timed);
                  const now = new Date();
                  const nowTop = Math.max(0, (now.getHours() * 60 + now.getMinutes() - GRID_START * 60)) * (HOUR_H / 60);
                  return <div key={d.getTime()} className="relative border-l border-border" style={{ height: GRID_H, backgroundImage: "repeating-linear-gradient(to bottom, hsla(240,10%,55%,0.16) 0px, hsla(240,10%,55%,0.16) 1px, transparent 1px, transparent 48px)" }}>
                    {sameDay(d, now) && nowTop >= 0 && nowTop <= GRID_H ? <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowTop }}>
                      <div className="h-[2px] bg-red-500/80" />
                      <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)]" />
                    </div> : null}
                    {placed.map(({ ev, col, span }) => {
                      const top = topOf(ev);
                      const height = heightOf(ev, top);
                      return <button type="button" key={ev.id} onClick={() => openDetail(ev)}
                        title={`${ev.title} — voir les disponibilités`}
                        className={cn("absolute z-10 cursor-pointer overflow-hidden rounded-lg border px-1.5 py-1 text-left transition-colors hover:brightness-110", eventColors(ev.source, ev.kind))}
                        style={{ top, height, left: `calc(${(col * 100) / span}% + 1px)`, width: `calc(${100 / span}% - 3px)` }}>
                        <div className="truncate text-[11px] font-semibold leading-tight">{ev.title}</div>
                        {height >= 34 ? <div className="mt-0.5 truncate font-mono text-[10px] opacity-75">{fmtTime(ev.start)}{!sameDay(ev.start, ev.end) ? ` – ${fmtDayNum(ev.end)}` : ""}</div> : null}
                        {ev.kind === "meeting" ? <div className="mt-0.5 flex items-center gap-1 truncate text-[10px] font-medium opacity-90"><span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meetingStatusDot(ev.status))} />{meetingStatusLabel(ev.status)}</div> : null}
                        {ev.kind === "task" ? <div className="mt-0.5 truncate text-[10px] font-medium opacity-90">Tâche HubSpot</div> : null}
                        {ev.kind === "reminder" ? <div className="mt-0.5 truncate text-[10px] font-medium opacity-90">Relance contact</div> : null}
                        {height >= 48 && ev.location ? <div className="mt-0.5 flex items-center gap-0.5 truncate text-[10px] opacity-60"><MapPin size={10} className="shrink-0" />{ev.location}</div> : null}
                        {ev.kind === "task" ? <div className="absolute right-1 top-1 text-sky-300/80"><ListTodo size={10} /></div> : ev.kind === "reminder" ? <div className="absolute right-1 top-1 text-amber-300/80"><TimerReset size={10} /></div> : ev.source === "hubspot" ? <div className="absolute right-1 top-1 text-emerald-300/80"><PhoneCall size={10} /></div> : <div className="absolute right-1 top-1 text-violet-300/80"><CalendarCheck2 size={10} /></div>}
                      </button>;
                    })}
                  </div>;
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    <Dialog open={Boolean(detail)} onOpenChange={o => { if (!o) setDetail(null); }}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <div className={cn("h-1.5 w-full", detail?.ev.kind === "task" ? "bg-sky-400" : detail?.ev.kind === "reminder" ? "bg-amber-400" : detail?.ev.source === "hubspot" ? "bg-emerald-400" : "bg-violet-400")} />
        <div className="p-6 pt-5">
          <DialogHeader>
            <div className="mb-4 flex items-center gap-3 pr-8">
              <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", detail?.ev.kind === "task" ? "bg-sky-400/15 text-sky-300" : detail?.ev.kind === "reminder" ? "bg-amber-400/15 text-amber-300" : detail?.ev.source === "hubspot" ? "bg-emerald-400/15 text-emerald-300" : "bg-violet-400/15 text-violet-300")}>
                {detail?.ev.kind === "task" ? <ListTodo size={20} /> : detail?.ev.kind === "reminder" ? <TimerReset size={20} /> : detail?.ev.source === "hubspot" ? <PhoneCall size={20} /> : <CalendarCheck2 size={20} />}
              </div>
              <div className="min-w-0">
                <DialogTitle className="truncate">{detail?.ev.title}</DialogTitle>
                <DialogDescription className="mt-0.5">{detail ? `${DAY_NAMES[(detail.day.getDay() + 6) % 7]} ${fmtDayNum(detail.day)} ${fmtMonthYear(detail.day)}` : ""}</DialogDescription>
              </div>
              <Badge variant="outline" className={cn("ml-auto shrink-0 border", detail?.ev.kind === "task" ? "border-sky-400/30 bg-sky-400/10 text-sky-300" : detail?.ev.kind === "reminder" ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : detail?.ev.source === "hubspot" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-violet-400/30 bg-violet-400/10 text-violet-300")}>
                {detail?.ev.kind === "task" ? "Tâche HubSpot" : detail?.ev.kind === "reminder" ? "Rappel HubSpot" : detail?.ev.source === "hubspot" ? "RDV HubSpot" : "Google"}
              </Badge>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
              <Clock size={16} className="shrink-0 text-violet-300" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Heure</div>
                <div className="truncate font-mono text-sm">{detail ? `${fmtTime(detail.ev.start)} → ${fmtTime(detail.ev.end)}` : ""}</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
              <CalendarDays size={16} className="shrink-0 text-violet-300" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Durée</div>
                <div className="truncate font-mono text-sm">{detail ? fmtDuration(detail.ev.end.getTime() - detail.ev.start.getTime()) : ""}</div>
              </div>
            </div>
          </div>

          {detail?.ev.kind === "meeting" ? (
            <div className="mt-2 flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2.5">
              <span className="text-xs text-muted-foreground">Statut actuel</span>
              <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium", meetingStatusBadge(detail.ev.status))}>
                <span className={cn("h-2 w-2 rounded-full", meetingStatusDot(detail.ev.status))} />{meetingStatusLabel(detail.ev.status)}
              </span>
            </div>
          ) : null}
          {detail?.ev.location ? (
            <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
              <MapPin size={16} className="shrink-0 text-violet-300" />
              <span className="truncate text-sm text-muted-foreground">{detail.ev.location}</span>
            </div>
          ) : null}

          {detail ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
                <Clock size={14} className="text-violet-300" />
                <span className="text-xs font-semibold">Disponibilités</span>
              </div>
              <div className="space-y-3 p-3">
                <div>
                  <div className="mb-1.5 text-[11px] text-muted-foreground">Créneaux libres — {DAY_NAMES[(detail.day.getDay() + 6) % 7]} {fmtDayNum(detail.day)}</div>
                  {(() => {
                    const slots = freeSlotsForDay(detail.day, weekEvents);
                    return slots.length === 0
                      ? <div className="rounded-md bg-card/40 px-2.5 py-2 text-xs text-muted-foreground">Aucun créneau libre entre 8h et 20h.</div>
                      : <div className="space-y-1">{slots.map((s, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 rounded-md border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1.5">
                            <span className="flex items-center gap-1.5 font-mono text-xs"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />{fmtTime(s.start)} → {fmtTime(s.end)}</span>
                            <span className="text-[11px] text-muted-foreground">{fmtDuration(s.end.getTime() - s.start.getTime())}</span>
                          </div>
                        ))}</div>;
                  })()}
                </div>
                <div>
                  <div className="mb-1.5 text-[11px] text-muted-foreground">Prochaines disponibilités</div>
                  <div className="space-y-1">
                    {(() => {
                      const rows: ReactNode[] = [];
                      let any = false;
                      for (let i = 1; i <= 4; i++) {
                        const d2 = addDays(detail.day, i);
                        const slots = freeSlotsForDay(d2, weekEvents);
                        if (!slots.length) continue;
                        any = true;
                        rows.push(
                          <div key={d2.getTime()} className="flex items-center gap-2 text-xs">
                            <span className="w-[86px] shrink-0 text-muted-foreground">{DAY_NAMES_SHORT[(d2.getDay() + 6) % 7]} {fmtDayNum(d2)}</span>
                            <span className="truncate font-mono text-foreground">{slots.slice(0, 3).map(s => `${fmtTime(s.start)}→${fmtTime(s.end)}`).join(" · ")}</span>
                          </div>
                        );
                      }
                      if (!any) return <div className="text-xs text-muted-foreground">Aucune disponibilité dans les 4 prochains jours.</div>;
                      return rows;
                    })()}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="mt-4 gap-2">
            {detail?.ev.kind === "meeting" ? <Button variant="outline" onClick={() => { openStatusEditor(detail.ev); setDetail(null); }}>Changer le statut</Button> : null}
            <Button onClick={() => setDetail(null)}>Fermer</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(editMeeting)} onOpenChange={o => { if (!o) setEditMeeting(null); }}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <div className="h-1.5 w-full bg-emerald-400" />
        <div className="p-6 pt-5">
          <DialogHeader>
            <div className="flex items-center gap-3 pr-8">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><PhoneCall size={20} /></div>
              <div className="min-w-0">
                <DialogTitle>Changer le statut</DialogTitle>
                <DialogDescription className="mt-0.5 truncate">{editMeeting ? `${editMeeting.title} — ${fmtTime(editMeeting.start)}` : ""}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="mt-4">
            <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">Statut du RDV</div>
            <Select value={editStatus} onValueChange={setEditStatus}>
              <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Choisir un statut" /></SelectTrigger>
              <SelectContent>
                {MEETING_STATUSES.map(s => (
                  <SelectItem key={s.key} value={s.key}>
                    <span className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", s.dot)} />{s.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editMeeting?.status ? (
              <div className="mt-2 text-[11px] text-muted-foreground">
                Statut actuel : <span className={cn("ml-1 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 align-middle text-[11px] font-medium", meetingStatusBadge(editMeeting.status))}><span className={cn("h-1.5 w-1.5 rounded-full", meetingStatusDot(editMeeting.status))} />{meetingStatusLabel(editMeeting.status)}</span>
              </div>
            ) : null}
          </div>
          <DialogFooter className="mt-5 gap-2">
            <Button variant="outline" onClick={() => setEditMeeting(null)}>Annuler</Button>
            <Button onClick={saveStatus} disabled={savingStatus}>{savingStatus ? <Loader2 size={15} className="animate-spin" /> : null}Enregistrer</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}
