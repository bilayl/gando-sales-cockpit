"use client";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Filter, Loader2, MapPin, MoreVertical, RefreshCw, Search, XCircle } from "lucide-react";
import { ContactDrawer } from "@/components/contact-drawer";
import { initials } from "@/lib/utils";
import { MEETING_STATUSES, meetingStatusBadge } from "@/lib/statuses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Meeting = {
  id: string;
  contactId: string | null;
  contact: Record<string, string | null | undefined> | null;
  properties: Record<string, string | null | undefined>;
};
type Owner = { id: string; firstName?: string; lastName?: string; email?: string };

const PROSPECTION_BADGES: Record<string, string> = {
  "À prospecter": "border-white/10 bg-white/5 text-slate-300",
  "En prospection": "border-amber-400/30 bg-amber-400/10 text-amber-300",
  "Conversation": "border-sky-400/30 bg-sky-400/10 text-sky-300",
  "RDV booké": "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  "À recycler": "border-orange-400/30 bg-orange-400/10 text-orange-300",
  "Non qualifié": "border-rose-400/30 bg-rose-400/10 text-rose-300",
  "Perdu": "border-rose-400/30 bg-rose-400/10 text-rose-300",
};

function prospectionBadge(status?: string | null) {
  if (!status) return "border-white/10 bg-muted/60 text-muted-foreground";
  return PROSPECTION_BADGES[status] || "border-white/10 bg-card text-slate-300";
}

type PeriodPreset = "all" | "jour" | "semaine" | "mois" | "trimestre" | "annee" | "custom";

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function startOfWeek(d: Date) { const x = startOfDay(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x; }

function formatDay(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(d);
}

export function MeetingsView() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [total, setTotal] = useState(0);
  const [after, setAfter] = useState<string | undefined>();
  const [nextAfter, setNextAfter] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [setter, setSetter] = useState("");
  const [outcome, setOutcome] = useState("");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [preset, setPreset] = useState<PeriodPreset>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const periodRange = useMemo(() => {
    const now = new Date();
    switch (preset) {
      case "jour": return { start: startOfDay(now), end: endOfDay(now) };
      case "semaine": return { start: startOfWeek(now), end: endOfDay(now) };
      case "mois": return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) };
      case "trimestre": { const qm = Math.floor(now.getMonth() / 3); return { start: new Date(now.getFullYear(), qm * 3, 1), end: endOfDay(now) }; }
      case "annee": return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(now) };
      case "custom": {
        if (!customStart || !customEnd) return null;
        const s = new Date(`${customStart}T00:00:00`);
        const e = new Date(`${customEnd}T23:59:59`);
        if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e) return null;
        return { start: s, end: e };
      }
      default: return null;
    }
  }, [preset, customStart, customEnd]);

  useEffect(() => {
    fetch("/api/owners").then(r => r.json()).then((o) => setOwners(o.results || [])).catch(() => {});
  }, []);

  async function load(reset = false, cursor?: string, silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const p = new URLSearchParams();
      if (setter) p.set("owner", setter);
      if (outcome) p.set("outcome", outcome);
      if (periodRange) { p.set("start", periodRange.start.toISOString()); p.set("end", periodRange.end.toISOString()); }
      const activeCursor = reset ? undefined : (cursor ?? after);
      if (activeCursor) p.set("after", activeCursor);
      const r = await fetch(`/api/meetings?${p}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Impossible de charger HubSpot");
      setMeetings(d.results || []);
      setTotal(d.total || 0);
      setNextAfter(d.paging?.next?.after);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { load(true); }, [setter, outcome, periodRange]);

  async function updateMeeting(id: string, key: string, value: string) {
    setSavingId(id);
    setError("");
    try {
      const r = await fetch(`/api/meetings/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ properties: { [key]: value } }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "HubSpot a rejeté la modification");
      }
      setMeetings(prev => prev.map(m => m.id === id ? { ...m, properties: { ...m.properties, [key]: value } } : m));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de modifier le RDV");
    } finally {
      setSavingId(null);
    }
  }

  const filtered = useMemo(() => {
    const low = q.trim().toLowerCase();
    if (!low) return meetings;
    return meetings.filter(m => {
      const c = m.contact || {};
      const txt = [m.properties?.hs_meeting_title, c.firstname, c.lastname, c.email, c.company, c.jobtitle].join(" ").toLowerCase();
      return txt.includes(low);
    });
  }, [meetings, q]);

  const booked = filtered.filter(m => m.properties?.hs_meeting_start_time && m.properties?.hs_meeting_outcome !== "CANCELED").length;
  const noShow = filtered.filter(m => m.properties?.hs_meeting_outcome === "NO_SHOW").length;
  const present = filtered.filter(m => m.properties?.hs_meeting_outcome === "COMPLETED").length;

  return (
    <div className="flex h-full min-h-[calc(100vh-24px)] flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden p-5">
        <Card className="flex h-full min-h-0 flex-col overflow-hidden">
          {/* Card header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <div>
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(115,93,243,0.9)]" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-300">Setters</span>
                </div>
                <h1 className="font-display text-lg font-bold tracking-tight">Meetings</h1>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarClock size={13} className="text-violet-300" />
                  <span><span className="font-semibold text-foreground">{total}</span> rendez-vous</span>
                  <span className="text-border">·</span>
                  <span>Actualisé à l'instant</span>
                </div>
              </div>
              <MoreVertical size={16} className="self-start text-muted-foreground" />
            </div>
            <div className="flex items-center gap-5 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-violet-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-400" />
                </span>
                {present} présents
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Booké <span className="font-semibold text-foreground">{booked}</span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-rose-400" /> No show <span className="font-semibold text-foreground">{noShow}</span>
              </span>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={() => load(true)}><RefreshCw size={13} /> Refresh</Button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-y border-border bg-muted/20 px-4 py-2.5">
            <Select value={setter === "" ? "all" : setter} onValueChange={v => { setAfter(undefined); setSetter(v === "all" ? "" : v); }}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Setter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les setters</SelectItem>
                {owners.map(o => <SelectItem key={o.id} value={o.id}>{[o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || o.id}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={outcome === "" ? "all" : outcome} onValueChange={v => { setAfter(undefined); setOutcome(v === "all" ? "" : v); }}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {MEETING_STATUSES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={preset} onValueChange={v => { setAfter(undefined); setPreset(v as PeriodPreset); }}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Période" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes périodes</SelectItem>
                <SelectItem value="jour">Jour</SelectItem>
                <SelectItem value="semaine">Semaine</SelectItem>
                <SelectItem value="mois">Mois</SelectItem>
                <SelectItem value="trimestre">Trimestre</SelectItem>
                <SelectItem value="annee">Année</SelectItem>
                <SelectItem value="custom">Personnalisé</SelectItem>
              </SelectContent>
            </Select>
            {preset === "custom" ? <>
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-9 w-40" />
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-9 w-40" />
            </> : null}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher" className="h-9 w-44 pl-9" />
            </div>
            <Button variant="outline" size="sm" className="h-9"><Filter size={14} /> Filter</Button>
          </div>

          {error ? <div className="mx-4 mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

          <div className="min-h-0 flex-1 overflow-auto border-t border-border minari-scrollbar">
            <Table className="min-w-[1220px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 px-4"><input type="checkbox" className="accent-violet-400" /></TableHead>
                  <TableHead className="px-3">RDV</TableHead>
                  <TableHead className="px-3">Contact</TableHead>
                  <TableHead className="px-3">Qualifié</TableHead>
                  <TableHead className="px-3">Setter</TableHead>
                  <TableHead className="px-3">Date</TableHead>
                  <TableHead className="px-3">Heure</TableHead>
                  <TableHead className="px-3">Booké</TableHead>
                  <TableHead className="px-3">Présent</TableHead>
                  <TableHead className="px-3">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <TableRow className="hover:bg-transparent"><TableCell colSpan={10} className="h-64 text-center"><Loader2 className="mx-auto animate-spin text-violet-300" /></TableCell></TableRow>
                  : filtered.map(m => {
                      const p = m.properties || {};
                      const c = m.contact || {};
                      const full = [c.firstname, c.lastname].filter(Boolean).join(" ") || c.email || "Sans nom";
                      const start = p.hs_meeting_start_time;
                      const end = p.hs_meeting_end_time;
                      const isBooked = Boolean(start) && p.hs_meeting_outcome !== "CANCELED";
                      const isPresent = p.hs_meeting_outcome === "COMPLETED";
                      const isNoShow = p.hs_meeting_outcome === "NO_SHOW";
                      return (
                        <TableRow key={m.id} className="group">
                          <TableCell className="px-4"><input type="checkbox" className="accent-violet-400" /></TableCell>
                          <TableCell className="px-3">
                            <span className="inline-flex max-w-[180px] items-center gap-2 font-medium">
                              <CalendarClock size={14} className="shrink-0 text-violet-300" />
                              <span className="truncate">{p.hs_meeting_title || "Rendez-vous"}</span>
                            </span>
                          </TableCell>
                          <TableCell className="px-3">
                            <Button variant="ghost" size="sm" className="h-8 gap-2 rounded-full border border-white/10 bg-card/60 pl-1 pr-3 font-medium shadow-sm hover:border-violet-400/40 hover:bg-accent/40"
                              onClick={() => m.contactId && setDrawerId(m.contactId)} disabled={!m.contactId}>
                              <Avatar className="h-6 w-6 bg-accent"><AvatarFallback className="bg-accent text-[9px] font-bold text-violet-300">{initials(c.firstname, c.lastname)}</AvatarFallback></Avatar>
                              <span className="truncate">{full}</span>
                            </Button>
                          </TableCell>
                          <TableCell className="px-3">
                            {c.statut_prospection ? <Badge variant="outline" className={`max-w-[180px] font-medium ${prospectionBadge(c.statut_prospection)}`}>{c.statut_prospection}</Badge> : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="px-3">
                            <Select value={p.hubspot_owner_id || ""} onValueChange={v => updateMeeting(m.id, "hubspot_owner_id", v === "__none__" ? "" : v)}>
                              <SelectTrigger className="h-8 w-[150px] border-violet-400/20 bg-muted/30 text-xs hover:border-violet-400/40"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">—</SelectItem>
                                {owners.map(o => <SelectItem key={o.id} value={o.id}>{[o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || o.id}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="px-3 font-mono text-xs text-muted-foreground">{formatDay(start)}</TableCell>
                          <TableCell className="px-3">
                            <span className="font-mono text-xs text-muted-foreground">{formatTime(start)}{start && end ? " → " + formatTime(end) : ""}</span>
                            {p.hs_meeting_location ? <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground/70"><MapPin size={11} /> {p.hs_meeting_location}</span> : null}
                          </TableCell>
                          <TableCell className="px-3">
                            {isBooked
                              ? <Badge variant="outline" className="border-emerald-400/30 bg-emerald-400/10 font-medium text-emerald-300"><CheckCircle2 size={11} /> Booké</Badge>
                              : <Badge variant="outline" className="border-rose-400/30 bg-rose-400/10 font-medium text-rose-300"><XCircle size={11} /> Non booké</Badge>}
                          </TableCell>
                          <TableCell className="px-3">
                            {isPresent
                              ? <Badge variant="outline" className="border-emerald-400/30 bg-emerald-400/10 font-medium text-emerald-300">Présent</Badge>
                              : isNoShow
                                ? <Badge variant="outline" className="border-rose-400/30 bg-rose-400/10 font-medium text-rose-300">Absent</Badge>
                                : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="px-3">
                            <div className="flex items-center gap-2">
                              {savingId === m.id ? <Loader2 size={14} className="animate-spin text-violet-300" /> : null}
                              <Select value={p.hs_meeting_outcome || ""} onValueChange={v => updateMeeting(m.id, "hs_meeting_outcome", v === "__none__" ? "" : v)}>
                                <SelectTrigger className={`h-8 w-[120px] border text-xs font-medium ${meetingStatusBadge(p.hs_meeting_outcome)}`}><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">—</SelectItem>
                                  {MEETING_STATUSES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                {!loading && !filtered.length ? <TableRow className="hover:bg-transparent"><TableCell colSpan={10} className="h-48 text-center text-muted-foreground">Aucun rendez-vous pour ces filtres.</TableCell></TableRow> : null}
              </TableBody>
            </Table>

            <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
              <span><span className="font-semibold text-foreground">1 - {filtered.length}</span> sur {total}</span>
              <Button variant="outline" size="icon" disabled={!after} onClick={() => { setAfter(undefined); setTimeout(() => load(true), 0); }}><ChevronLeft size={15} /></Button>
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-violet-400/30 bg-accent/50 font-semibold text-violet-200">1</span>
              <Button variant="outline" size="icon" disabled={!nextAfter} onClick={() => { setAfter(nextAfter); load(false, nextAfter); }}><ChevronRight size={15} /></Button>
            </div>
          </div>
        </Card>
      </div>

      <ContactDrawer contactId={drawerId} open={Boolean(drawerId)} onOpenChange={o => !o && setDrawerId(null)} onUpdated={() => load(true)} />
    </div>
  );
}
