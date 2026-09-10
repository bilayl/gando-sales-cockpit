"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Clock3,
  Headphones,
  Loader2,
  MessageSquareText,
  Mic2,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  RefreshCw,
  Search,
  Sparkles,
  Voicemail,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type OnoffHistoryItem = {
  type: "call" | "voicemail";
  id: string;
  callId: string;
  at: string;
  endedAt?: string | null;
  title: string;
  externalName?: string | null;
  externalCompanyName?: string | null;
  externalNumber?: string | null;
  direction?: string | null;
  status?: string | null;
  duration?: number | null;
  userName?: string | null;
  userEmail?: string | null;
  onoffNumber?: string | null;
  tags?: string[];
  hasRecording?: boolean;
  hasVoicemail?: boolean;
  hasTranscript?: boolean;
  transcript?: string | null;
  aiSummary?: string | null;
  processingStatus?: string | null;
  hubspotCallId?: string | null;
};

type HistoryResponse = {
  source?: string;
  total?: number;
  summary?: { calls: number; recordings: number; transcriptions: number; voicemails: number };
  items?: OnoffHistoryItem[];
  error?: string;
};

type DetailsResponse = {
  transcript?: string | null;
  notes?: string | null;
  evaluation?: string | null;
  tags?: string[];
  aiSummary?: string | null;
  keyPoints?: string[];
  objections?: string[];
  nextSteps?: string[];
  metadataAvailable?: boolean;
  apiError?: string | null;
  processingStatus?: string | null;
  error?: string;
};

type Filter = "all" | "calls" | "recordings" | "voicemails";

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function durationLabel(value?: number | null) {
  const total = Math.max(0, Math.round(Number(value || 0)));
  if (!total) return "0 s";
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes ? `${minutes} min ${String(seconds).padStart(2, "0")} s` : `${seconds} s`;
}

function directionLabel(value?: string | null) {
  const normalized = String(value || "").toUpperCase();
  if (normalized.includes("OUT")) return "Sortant";
  if (normalized.includes("IN")) return "Entrant";
  return value || "Appel";
}

function statusLabel(value?: string | null) {
  const normalized = String(value || "").toUpperCase();
  const labels: Record<string, string> = {
    ANSWERED: "Décroché",
    COMPLETED: "Terminé",
    MISSED: "Manqué",
    MISSED_CALL: "Manqué",
    BUSY: "Occupé",
    NO_ANSWER: "Sans réponse",
    FAILED: "Échec",
    CANCELED: "Annulé",
    CANCELLED: "Annulé",
    VOICEMAIL: "Message vocal",
  };
  return labels[normalized] || value || "—";
}

function DetailList({ title, values }: { title: string; values?: string[] }) {
  if (!values?.length) return null;
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</div>
      <div className="mt-1.5 space-y-1 text-xs leading-5">
        {values.map((value, index) => <div key={`${title}-${index}`}>• {value}</div>)}
      </div>
    </div>
  );
}

function OnoffCallDetails({ item }: { item: OnoffHistoryItem }) {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<DetailsResponse | null>(null);

  async function loadDetails() {
    if (loaded || loading || item.type !== "call") return;
    setLoading(true);
    try {
      const response = await fetch(`/api/onoff/calls/${encodeURIComponent(item.callId)}/details`, { cache: "no-store" });
      const body: DetailsResponse = await response.json();
      setDetails(response.ok ? body : { error: body.error || "Détails Onoff indisponibles." });
    } catch {
      setDetails({ error: "Détails Onoff indisponibles." });
    } finally {
      setLoaded(true);
      setLoading(false);
    }
  }

  const transcript = details?.transcript || item.transcript;
  const summary = details?.aiSummary || item.aiSummary;
  const tags = [...new Set([...(item.tags || []), ...(details?.tags || [])])];

  return (
    <details className="group border-t border-border" onToggle={event => { if (event.currentTarget.open) void loadDetails(); }}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        Conversation, transcription et analyse
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      </summary>
      <div className="grid gap-4 border-t border-border bg-muted/20 px-4 py-4 lg:grid-cols-2">
        <div className="space-y-3">
          {item.hasRecording ? (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold"><Headphones className="h-4 w-4" /> Enregistrement de l’appel</div>
              <audio className="h-9 w-full" controls preload="none" src={`/api/onoff/calls/${encodeURIComponent(item.callId)}/recording`} />
            </div>
          ) : null}

          {transcript ? (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold"><MessageSquareText className="h-4 w-4" /> Transcription</div>
              <div className="max-h-[360px] overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-foreground/85">{transcript}</div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
              Aucune transcription disponible pour cet appel.
              {details?.apiError ? <div className="mt-1 text-[10px]">API Onoff : {details.apiError}</div> : null}
            </div>
          )}

          {details?.notes ? (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-1 text-xs font-semibold">Notes Onoff</div>
              <div className="whitespace-pre-wrap text-xs leading-5">{details.notes}</div>
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          {summary ? (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold"><Sparkles className="h-4 w-4" /> Synthèse Gando</div>
              <div className="whitespace-pre-wrap text-xs leading-5">{summary}</div>
            </div>
          ) : null}
          <DetailList title="Points clés" values={details?.keyPoints} />
          <DetailList title="Objections" values={details?.objections} />
          <DetailList title="Prochaines étapes" values={details?.nextSteps} />
          {details?.evaluation ? (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Évaluation Onoff</div>
              <div className="mt-1.5 whitespace-pre-wrap text-xs leading-5">{details.evaluation}</div>
            </div>
          ) : null}
          {tags.length ? <div className="flex flex-wrap gap-1.5">{tags.map(tag => <Badge key={tag} variant="outline" className="text-[9px]">{tag}</Badge>)}</div> : null}
          {details?.error ? <div className="text-xs text-destructive">{details.error}</div> : null}
        </div>
      </div>
    </details>
  );
}

export function OnoffHistoryView({ compact = false, limit = 500 }: { compact?: boolean; limit?: number }) {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/onoff/history?limit=${Math.min(Math.max(limit, 1), 1000)}`, { cache: "no-store" });
      const body: HistoryResponse = await response.json();
      if (!response.ok) throw new Error(body.error || "Impossible de charger l’historique Onoff.");
      setData(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de charger l’historique Onoff.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [limit]);

  useEffect(() => { void load(); }, [load]);

  const items = data?.items || [];
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter(item => {
      if (filter === "calls" && item.type !== "call") return false;
      if (filter === "recordings" && !(item.type === "call" && item.hasRecording)) return false;
      if (filter === "voicemails" && item.type !== "voicemail") return false;
      if (!needle) return true;
      return [item.title, item.externalNumber, item.externalCompanyName, item.userName, item.userEmail, ...(item.tags || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [items, filter, query]);

  const shown = compact ? visible.slice(0, 20) : visible;
  const summary = data?.summary || { calls: 0, recordings: 0, transcriptions: 0, voicemails: 0 };
  const metricCards = [
    { value: summary.calls, label: "Appels", Icon: PhoneCall },
    { value: summary.recordings, label: "Enregistrements", Icon: Mic2 },
    { value: summary.transcriptions, label: "Transcriptions", Icon: MessageSquareText },
    { value: summary.voicemails, label: "Messages vocaux", Icon: Voicemail },
  ];

  return (
    <div className={cn(compact ? "space-y-4" : "page-shell min-h-screen minari-scrollbar")}>
      <div className={cn(!compact && "page-content")}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Onoff · CRM</div>
            <h1 className={cn("mt-1 font-bold tracking-[-0.035em]", compact ? "text-lg" : "text-2xl")}>{compact ? "Historique des conversations" : "Historique Onoff"}</h1>
            <p className="mt-1 text-xs text-muted-foreground">Appels, enregistrements, transcriptions et messages vocaux centralisés dans Gando.</p>
          </div>
          <div className="flex gap-2">
            {compact ? <Button variant="outline" size="sm" asChild><Link href="/historique">Voir tout</Link></Button> : null}
            <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={refreshing || loading}>
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", (refreshing || loading) && "animate-spin")} /> Actualiser
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {metricCards.map(({ value, label, Icon }) => (
            <Card key={label} className="px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="mt-1 text-xl font-semibold tracking-[-0.03em]">{value}</div>
            </Card>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
            {([
              ["all", "Tout"],
              ["calls", "Appels"],
              ["recordings", "Enregistrements"],
              ["voicemails", "Vocaux"],
            ] as const).map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)} className={cn("h-7 rounded-md px-2.5 text-[11px] font-medium", filter === key ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted")}>{label}</button>
            ))}
          </div>
          {!compact ? (
            <div className="relative ml-auto w-full sm:w-[280px]">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Numéro, contact, commercial…" className="h-8 pl-8 text-xs" />
            </div>
          ) : null}
        </div>

        {error ? <div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div> : null}

        <Card className="mt-4 overflow-hidden">
          {loading ? (
            <div className="flex min-h-[180px] items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement de l’historique Onoff…</div>
          ) : !shown.length ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Aucun événement Onoff correspondant.</div>
          ) : (
            <div className="divide-y divide-border">
              {shown.map(item => {
                const outgoing = String(item.direction || "").toUpperCase().includes("OUT");
                const DirectionIcon = outgoing ? PhoneOutgoing : PhoneIncoming;
                return (
                  <div key={`${item.type}-${item.id}`} className="bg-card">
                    <div className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-muted"><DirectionIcon className="h-3.5 w-3.5" /></span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate text-sm font-semibold">{item.title}</span>
                              <Badge variant="outline" className="text-[9px]">{item.type === "voicemail" ? "Message vocal" : directionLabel(item.direction)}</Badge>
                              {item.hasRecording ? <Badge variant="secondary" className="text-[9px]">Audio</Badge> : null}
                              {item.hasTranscript ? <Badge variant="secondary" className="text-[9px]">Transcrit</Badge> : null}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                              <span>{formatDateTime(item.at)}</span>
                              <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{durationLabel(item.duration)}</span>
                              {item.externalNumber ? <span className="font-mono">{item.externalNumber}</span> : null}
                              {item.userName || item.userEmail ? <span>{item.userName || item.userEmail}</span> : null}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <Badge variant="outline" className="text-[9px]">{statusLabel(item.status)}</Badge>
                        {item.type === "voicemail" && item.hasVoicemail ? (
                          <div className="min-w-[230px] rounded-lg border border-border bg-muted/20 px-2 py-1"><audio className="h-8 w-full" controls preload="none" src={`/api/onoff/voicemails/${encodeURIComponent(item.callId)}`} /></div>
                        ) : null}
                      </div>
                    </div>
                    {item.type === "call" ? <OnoffCallDetails item={item} /> : item.transcript ? (
                      <div className="border-t border-border bg-muted/20 px-4 py-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Transcription du message vocal</div>
                        <div className="mt-2 whitespace-pre-wrap text-xs leading-5">{item.transcript}</div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
