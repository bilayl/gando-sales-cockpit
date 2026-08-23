"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarCheck2,
  ChevronDown,
  ExternalLink,
  Headphones,
  Loader2,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Search,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Analytics = {
  start: string;
  end: string;
  kpis: { calls: number; meetings: number; worked: number; conversion: number };
  distribution: Array<{ statut: string; count: number }>;
};

type CallLog = {
  id: string;
  timestamp: string | null;
  title: string;
  status: string | null;
  disposition: string | null;
  direction: string | null;
  durationMs: number;
  fromNumber: string | null;
  toNumber: string | null;
  body: string;
  summary: string;
  recordingUrl: string | null;
  hasTranscript: boolean;
  tags: string | null;
  ownerId: string | null;
};

const BADGES: Record<string, string> = {
  "À prospecter": "border-border bg-muted text-muted-foreground",
  "En prospection": "border-amber-200 bg-amber-50 text-amber-700",
  "Conversation": "border-sky-200 bg-sky-50 text-sky-700",
  "RDV booké": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "À recycler": "border-orange-200 bg-orange-50 text-orange-700",
  "Non qualifié": "border-rose-200 bg-rose-50 text-rose-700",
  "Perdu": "border-rose-200 bg-rose-50 text-rose-700",
};

const MAX_HISTORY_PAGES = 100;

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function startOfWeek(d: Date) { const x = startOfDay(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x; }

type Preset = "jour" | "semaine" | "mois" | "trimestre" | "annee" | "custom";

function presetRange(preset: Preset): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case "jour": return { start: startOfDay(now), end: endOfDay(now) };
    case "semaine": return { start: startOfWeek(now), end: endOfDay(now) };
    case "mois": return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) };
    case "trimestre": { const q = Math.floor(now.getMonth() / 3); return { start: new Date(now.getFullYear(), q * 3, 1), end: endOfDay(now) }; }
    case "annee": return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(now) };
    default: return { start: startOfDay(now), end: endOfDay(now) };
  }
}

function formatCallDate(value: string | null) {
  if (!value) return "Date inconnue";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  if (hours) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes) return `${minutes}m ${String(remaining).padStart(2, "0")}s`;
  return `${remaining}s`;
}

function formatPhone(value: string | null) {
  if (!value) return "—";
  const trimmed = value.trim();
  if (!trimmed) return "—";
  if (trimmed.startsWith("+")) return trimmed;
  if (/^\d{8,15}$/.test(trimmed)) return `+${trimmed}`;
  return trimmed;
}

function callDirectionLabel(value: string | null) {
  if (value === "INBOUND") return "Entrant";
  if (value === "OUTBOUND") return "Sortant";
  return value || "Appel";
}

function callStatusLabel(value: string | null) {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "COMPLETED") return "Terminé";
  if (normalized === "RINGING") return "Sonnerie";
  if (normalized === "BUSY") return "Occupé";
  if (normalized === "NO_ANSWER") return "Sans réponse";
  if (normalized === "FAILED") return "Échec";
  if (normalized === "CANCELED" || normalized === "CANCELLED") return "Annulé";
  return value || "—";
}

function otherPartyNumber(call: CallLog) {
  if (call.direction === "INBOUND") return call.fromNumber;
  if (call.direction === "OUTBOUND") return call.toNumber;
  return call.toNumber || call.fromNumber;
}

export function AnalyticsView() {
  const [preset, setPreset] = useState<Preset>("mois");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [callsError, setCallsError] = useState("");
  const [callsTotal, setCallsTotal] = useState(0);
  const [callsLoaded, setCallsLoaded] = useState(0);
  const [callQuery, setCallQuery] = useState("");
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());
  const [owners, setOwners] = useState<Record<string, string>>({});
  const callLoadId = useRef(0);

  useEffect(() => {
    fetch("/api/owners", { cache: "no-store" })
      .then(response => response.json())
      .then(payload => setOwners(Object.fromEntries((payload.results || []).map((owner: any) => [
        String(owner.id),
        [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.email || String(owner.id),
      ]))))
      .catch(() => {});
  }, []);

  const loadCallHistory = useCallback(async (start: Date, end: Date) => {
    const loadId = ++callLoadId.current;
    setCallsLoading(true);
    setCallsError("");
    setCalls([]);
    setCallsTotal(0);
    setCallsLoaded(0);
    setExpandedCalls(new Set());

    let after: string | null = null;
    let allCalls: CallLog[] = [];
    let total = 0;
    let page = 0;

    try {
      do {
        const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
        if (after) params.set("after", after);
        const response = await fetch(`/api/analytics/calls?${params.toString()}`, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Impossible de charger l’historique des appels");
        if (loadId !== callLoadId.current) return;

        total = Number(body.total || 0);
        const nextRows = Array.isArray(body.results) ? body.results as CallLog[] : [];
        const byId = new Map(allCalls.map(call => [call.id, call]));
        nextRows.forEach(call => byId.set(call.id, call));
        allCalls = Array.from(byId.values()).sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
        setCalls(allCalls);
        setCallsTotal(total);
        setCallsLoaded(allCalls.length);

        after = body.paging?.next?.after ? String(body.paging.next.after) : null;
        page += 1;
      } while (after && page < MAX_HISTORY_PAGES);

      if (after && allCalls.length < total) {
        setCallsError(`L’historique affiche ${allCalls.length.toLocaleString("fr-FR")} appels sur ${total.toLocaleString("fr-FR")} pour cette période.`);
      }
    } catch (reason) {
      if (loadId === callLoadId.current) {
        setCallsError(reason instanceof Error ? reason.message : "Impossible de charger l’historique des appels");
      }
    } finally {
      if (loadId === callLoadId.current) setCallsLoading(false);
    }
  }, []);

  const load = useCallback(async (start: Date, end: Date) => {
    setLoading(true);
    setError("");
    void loadCallHistory(start, end);
    try {
      const response = await fetch(`/api/analytics?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Impossible de charger les statistiques");
      setData(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erreur");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [loadCallHistory]);

  useEffect(() => {
    if (preset === "custom") return;
    const { start, end } = presetRange(preset);
    void load(start, end);
  }, [preset, load]);

  function applyCustom() {
    if (!customStart || !customEnd) return;
    const start = new Date(`${customStart}T00:00:00`);
    const end = new Date(`${customEnd}T23:59:59`);
    if (start <= end) void load(start, end);
  }

  function toggleCall(id: string) {
    setExpandedCalls(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredCalls = useMemo(() => {
    const query = callQuery.trim().toLowerCase();
    if (!query) return calls;
    return calls.filter(call => [
      call.title,
      call.summary,
      call.body,
      call.fromNumber,
      call.toNumber,
      call.direction,
      call.status,
      call.tags,
      call.ownerId ? owners[call.ownerId] : "",
    ].some(value => String(value || "").toLowerCase().includes(query)));
  }, [calls, callQuery, owners]);

  const presets: Array<{ key: Preset; label: string }> = [
    { key: "jour", label: "Jour" },
    { key: "semaine", label: "Semaine" },
    { key: "mois", label: "Mois" },
    { key: "trimestre", label: "Trimestre" },
    { key: "annee", label: "Année" },
    { key: "custom", label: "Personnalisé" },
  ];

  const k = data?.kpis;
  const metrics = [
    { label: "Appels", value: k?.calls ?? 0, suffix: "", icon: PhoneCall },
    { label: "Contacts travaillés", value: k?.worked ?? 0, suffix: "", icon: UsersRound },
    { label: "RDV bookés", value: k?.meetings ?? 0, suffix: "", icon: CalendarCheck2 },
    { label: "Conversion", value: k ? `${k.conversion}` : "—", suffix: k ? "%" : "", icon: TrendingUp },
  ];

  return (
    <div className="page-shell min-h-screen">
      <div className="page-content">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.035em]">Statistiques</h1>
            <p className="mt-1 text-sm text-muted-foreground">Performance commerciale et historique complet des appels synchronisés avec HubSpot.</p>
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1">
            {presets.map(item => (
              <Button
                key={item.key}
                onClick={() => setPreset(item.key)}
                variant={preset === item.key ? "secondary" : "ghost"}
                size="sm"
                className={cn("h-7 px-3", preset === item.key && "bg-accent text-accent-foreground")}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </header>

        {preset === "custom" ? (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
            <div className="space-y-1.5"><Label htmlFor="custom-start" className="text-xs text-muted-foreground">Du</Label><Input id="custom-start" type="date" value={customStart} onChange={event => setCustomStart(event.target.value)} className="w-44" /></div>
            <div className="space-y-1.5"><Label htmlFor="custom-end" className="text-xs text-muted-foreground">Au</Label><Input id="custom-end" type="date" value={customEnd} onChange={event => setCustomEnd(event.target.value)} className="w-44" /></div>
            <Button onClick={applyCustom}>Appliquer</Button>
          </div>
        ) : null}

        {error ? <div role="alert" className="mt-4 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}

        {loading ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin text-primary" /> Calcul des indicateurs…</div>
        ) : data ? (
          <>
            <section className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-4">
              {metrics.map(({ label, value, suffix, icon: Icon }, index) => (
                <div key={label} className={cn(
                  "flex min-h-24 items-center gap-3 px-4 py-4",
                  index % 2 === 1 && "border-l border-border",
                  index > 1 && "border-t border-border",
                  index > 0 && "lg:border-l lg:border-t-0"
                )}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-muted text-primary"><Icon className="h-[18px] w-[18px]" /></span>
                  <div><div className="text-2xl font-bold tracking-[-0.035em]">{value}<span className="ml-0.5 text-base text-primary">{suffix}</span></div><div className="mt-0.5 text-xs text-muted-foreground">{label}</div></div>
                </div>
              ))}
            </section>

            <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border px-5 py-4">
                <h2 className="section-title">Répartition par statut</h2>
                <p className="mt-1 text-xs text-muted-foreground">Contacts travaillés sur la période sélectionnée.</p>
              </div>
              {data.distribution.length === 0 ? (
                <p className="px-5 py-12 text-center text-sm text-muted-foreground">Aucun contact travaillé avec un statut sur cette période.</p>
              ) : (
                <div>
                  {data.distribution.map(({ statut, count }) => {
                    const max = data.distribution[0]?.count || 1;
                    return (
                      <div key={statut} className="grid items-center gap-4 border-b border-border/70 px-5 py-3 last:border-b-0 sm:grid-cols-[180px_1fr_64px]">
                        <Badge variant="outline" className={cn("w-fit font-medium", BADGES[statut])}>{statut}</Badge>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((count / max) * 100)}%` }} /></div>
                        <span className="text-right text-sm font-bold">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}

        <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-primary" />
                <h2 className="section-title">Historique des appels</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Tous les logs d’appels HubSpot récupérés sur la période sélectionnée, y compris les appels Onoff synchronisés.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{callsLoaded.toLocaleString("fr-FR")}</span>
                <span>chargé{callsLoaded > 1 ? "s" : ""}</span>
                {callsTotal ? <><span>sur</span><span className="font-semibold text-foreground">{callsTotal.toLocaleString("fr-FR")}</span></> : null}
                {callsLoading ? <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin text-primary" /> récupération en cours…</span> : callsTotal && callsLoaded >= callsTotal ? <Badge variant="secondary" className="text-[10px]">Historique complet</Badge> : null}
              </div>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={callQuery} onChange={event => setCallQuery(event.target.value)} className="pl-9" placeholder="Rechercher numéro, résumé, commercial…" />
            </div>
          </div>

          {callsError ? <div className="border-b border-border bg-amber-50 px-5 py-3 text-xs text-amber-800">{callsError}</div> : null}

          {callsLoading && calls.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-5 py-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Chargement des logs d’appels…</div>
          ) : filteredCalls.length === 0 ? (
            <div className="px-5 py-14 text-center text-sm text-muted-foreground">{callQuery ? "Aucun appel ne correspond à cette recherche." : "Aucun appel enregistré sur cette période."}</div>
          ) : (
            <div className="divide-y divide-border/70">
              {filteredCalls.map(call => {
                const expanded = expandedCalls.has(call.id);
                const inbound = call.direction === "INBOUND";
                const owner = call.ownerId ? owners[call.ownerId] || `Owner ${call.ownerId}` : "Non attribué";
                const partyNumber = formatPhone(otherPartyNumber(call));
                return (
                  <div key={call.id} className="bg-card transition-colors hover:bg-muted/20">
                    <button type="button" onClick={() => toggleCall(call.id)} className="grid w-full gap-3 px-5 py-3.5 text-left md:grid-cols-[160px_110px_150px_90px_150px_minmax(220px,1fr)_28px] md:items-center">
                      <div className="text-xs font-medium text-foreground">{formatCallDate(call.timestamp)}</div>
                      <div>
                        <Badge variant="outline" className={cn("gap-1 text-[10px]", inbound ? "border-sky-200 bg-sky-50 text-sky-700" : "border-violet-200 bg-violet-50 text-violet-700")}>
                          {inbound ? <PhoneIncoming className="h-3 w-3" /> : <PhoneOutgoing className="h-3 w-3" />}
                          {callDirectionLabel(call.direction)}
                        </Badge>
                      </div>
                      <div className="truncate text-xs font-semibold" title={partyNumber}>{partyNumber}</div>
                      <div className="text-xs text-muted-foreground">{formatDuration(call.durationMs)}</div>
                      <div className="truncate text-xs text-muted-foreground" title={owner}>{owner}</div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">{call.title}</div>
                        <div className="mt-0.5 flex min-w-0 items-center gap-2">
                          <span className="shrink-0 text-[11px] font-medium text-muted-foreground">{callStatusLabel(call.status)}</span>
                          {call.summary ? <span className="truncate text-xs text-muted-foreground">· {call.summary}</span> : null}
                        </div>
                      </div>
                      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
                    </button>

                    {expanded ? (
                      <div className="border-t border-border/60 bg-muted/20 px-5 py-4 md:pl-[485px]">
                        <div className="max-w-3xl space-y-3">
                          {call.summary ? (
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Résumé</div>
                              <p className="mt-1 text-sm leading-6 text-foreground">{call.summary}</p>
                            </div>
                          ) : null}
                          {call.body ? (
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Log / notes de l’appel</div>
                              <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{call.body}</p>
                            </div>
                          ) : null}
                          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                            <span><strong className="text-foreground">De :</strong> {formatPhone(call.fromNumber)}</span>
                            <span><strong className="text-foreground">Vers :</strong> {formatPhone(call.toNumber)}</span>
                            {call.tags ? <span><strong className="text-foreground">Tags :</strong> {call.tags}</span> : null}
                            {call.hasTranscript ? <span className="inline-flex items-center gap-1"><Headphones className="h-3.5 w-3.5" /> Transcription disponible</span> : null}
                          </div>
                          {call.recordingUrl ? (
                            <a href={call.recordingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                              Écouter l’enregistrement <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
