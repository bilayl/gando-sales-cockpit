"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, Eye, History, Loader2, RefreshCw, UserRound, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Visitor = {
  email: string;
  firstName: string;
  lastName: string;
  firstSeenAt: string;
  lastSeenAt: string;
  activeSeconds: number;
  sessions: number;
  stages: string[];
};

type VisitSession = {
  sessionId: string;
  email: string;
  firstName: string;
  lastName: string;
  startedAt: string;
  lastSeenAt: string;
  activeSeconds: number;
  stages: string[];
  events: Array<{ type: string; documentCode: string | null; createdAt: string; activeSeconds: number }>;
};

type Payload = {
  summary: { opens: number; uniqueVisitors: number; activeSeconds: number; sessions: number; lastViewedAt: string | null };
  visitors: Visitor[];
  sessions: VisitSession[];
};

function formatDate(value?: string | null) {
  if (!value) return "Jamais";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds || 0));
  if (safe < 60) return `${safe}s`;
  const minutes = Math.floor(safe / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function visitorName(value: { firstName: string; lastName: string; email: string }) {
  return [value.firstName, value.lastName].filter(Boolean).join(" ") || value.email || "Visiteur non identifié";
}

function eventLabel(event: VisitSession["events"][number]) {
  if (event.type === "room_opened") return "Ouverture de la Room";
  if (event.type === "stage_viewed") return event.documentCode ? `${event.documentCode} consulté` : "Étape consultée";
  if (event.type === "section_viewed") return event.documentCode ? `Section de ${event.documentCode} consultée` : "Section consultée";
  return event.documentCode ? `${event.documentCode} · ${event.type}` : event.type;
}

export function SDRoomVisitorsPanel({ dealId }: { dealId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/analytics`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Historique indisponible");
      setData(payload as Payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Historique indisponible");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);

  const sessions = useMemo(() => {
    if (!data) return [];
    if (!selectedEmail) return data.sessions;
    return data.sessions.filter(session => session.email === selectedEmail);
  }, [data, selectedEmail]);

  if (loading && !data) return <div className="grid min-h-[55vh] place-items-center"><div className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /><div className="mt-3 text-sm text-muted-foreground">Chargement des consultations…</div></div></div>;

  return <div className="min-h-screen bg-muted/20 px-4 py-6 lg:px-7 lg:py-8">
    <div className="mx-auto max-w-[1320px] space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Deal entreprise</div><h1 className="mt-1 text-2xl font-black tracking-[-0.035em]">Visiteurs & historique</h1><p className="mt-1 text-sm text-muted-foreground">Qui a consulté la Room, quand, pendant combien de temps et quelles étapes ont été vues.</p></div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Actualiser</Button>
      </div>

      {error ? <Card className="border-destructive/30 p-5 text-sm text-destructive">{error}</Card> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4"><div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Users className="h-4 w-4 text-primary" />Visiteurs uniques</div><div className="mt-2 text-2xl font-black">{data?.summary.uniqueVisitors || 0}</div></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Eye className="h-4 w-4 text-primary" />Ouvertures</div><div className="mt-2 text-2xl font-black">{data?.summary.opens || 0}</div></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Clock3 className="h-4 w-4 text-primary" />Temps actif cumulé</div><div className="mt-2 text-2xl font-black">{formatDuration(data?.summary.activeSeconds || 0)}</div></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><History className="h-4 w-4 text-primary" />Dernière activité</div><div className="mt-2 text-sm font-bold leading-6">{formatDate(data?.summary.lastViewedAt)}</div></Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start">
        <Card className="overflow-hidden p-0 xl:sticky xl:top-28">
          <div className="border-b border-border px-5 py-4"><div className="flex items-center justify-between gap-3"><div><div className="font-bold">Visiteurs</div><div className="mt-0.5 text-xs text-muted-foreground">Clique sur une personne pour filtrer ses visites.</div></div>{selectedEmail ? <Button size="sm" variant="ghost" onClick={() => setSelectedEmail(null)}>Tous</Button> : null}</div></div>
          <div className="max-h-[680px] divide-y divide-border overflow-y-auto">
            {(data?.visitors || []).map(visitor => {
              const active = selectedEmail === visitor.email;
              return <button key={visitor.email || `${visitor.firstName}-${visitor.lastName}`} type="button" onClick={() => setSelectedEmail(active ? null : visitor.email)} className={`w-full px-5 py-4 text-left transition-colors ${active ? "bg-primary/8" : "hover:bg-muted/40"}`}>
                <div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><UserRound className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{visitorName(visitor)}</div><div className="truncate text-xs text-muted-foreground">{visitor.email || "Email inconnu"}</div><div className="mt-2 flex flex-wrap gap-1.5"><Badge variant="outline">{visitor.sessions} visite{visitor.sessions > 1 ? "s" : ""}</Badge><Badge variant="outline">{formatDuration(visitor.activeSeconds)}</Badge>{visitor.stages.map(stage => <Badge key={stage} variant="secondary">{stage}</Badge>)}</div><div className="mt-2 text-[11px] text-muted-foreground">Dernière visite · {formatDate(visitor.lastSeenAt)}</div></div></div>
              </button>;
            })}
            {!data?.visitors.length ? <div className="px-5 py-10 text-center text-sm text-muted-foreground">Aucun visiteur enregistré pour le moment.</div> : null}
          </div>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3"><div><div className="font-bold">Historique des visites</div><div className="text-xs text-muted-foreground">{selectedEmail ? `Filtré sur ${selectedEmail}` : "Toutes les sessions, de la plus récente à la plus ancienne."}</div></div><Badge variant="outline">{sessions.length} session{sessions.length > 1 ? "s" : ""}</Badge></div>
          {sessions.map(session => <Card key={session.sessionId} className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-sm font-bold">{visitorName(session)}</div><div className="mt-0.5 text-xs text-muted-foreground">{session.email || "Email inconnu"}</div></div><div className="flex flex-wrap gap-1.5 sm:justify-end"><Badge variant="outline">{formatDuration(session.activeSeconds)}</Badge>{session.stages.map(stage => <Badge key={stage} variant="secondary">{stage}</Badge>)}</div></div>
            <div className="mt-4 grid gap-3 rounded-xl bg-muted/30 p-3 text-xs sm:grid-cols-2"><div><span className="text-muted-foreground">Début</span><div className="mt-0.5 font-semibold">{formatDate(session.startedAt)}</div></div><div><span className="text-muted-foreground">Dernière activité</span><div className="mt-0.5 font-semibold">{formatDate(session.lastSeenAt)}</div></div></div>
            {session.events.length ? <div className="mt-4 space-y-2 border-l border-border pl-4">{session.events.map((event, index) => <div key={`${event.createdAt}-${index}`} className="relative text-xs"><span className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full bg-primary" /><div className="font-semibold">{eventLabel(event)}</div><div className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(event.createdAt)}</div></div>)}</div> : <div className="mt-4 text-xs text-muted-foreground">Aucun détail d’étape pour cette session.</div>}
          </Card>)}
          {!sessions.length ? <Card className="p-10 text-center text-sm text-muted-foreground">Aucune visite à afficher.</Card> : null}
        </div>
      </div>
    </div>
  </div>;
}
