"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DealRoomDeal } from "@/lib/deal-room-types";
import { SD_CODES, SD_STAGE_META, type SDCode, type SDDocumentStatus } from "@/lib/sd-room-types";
import { cn } from "@/lib/utils";

type SDRoomHubDocument = {
  room_id: string;
  code: SDCode;
  status: SDDocumentStatus;
  source_mode: "manual" | "agent" | "mixed";
  version: number;
  published_version: number | null;
  updated_at: string;
};

type SDRoomSummary = {
  id: string;
  hubspot_deal_id: string;
  title: string;
  company_name: string;
  share_token: string;
  status: "draft" | "published" | "archived";
  current_stage: SDCode;
  published_at: string | null;
  last_shared_at: string | null;
  created_at: string;
  updated_at: string;
  documents: SDRoomHubDocument[];
  opens: number;
  uniqueVisitors: number;
  lastViewedAt: string | null;
  openComments: number;
};

type HubFilter = "all" | "to_create" | "draft" | "published" | "viewed";

const FILTERS: Array<{ key: HubFilter; label: string }> = [
  { key: "all", label: "Tous" },
  { key: "to_create", label: "À créer" },
  { key: "draft", label: "En préparation" },
  { key: "published", label: "Publiées" },
  { key: "viewed", label: "Consultées" },
];

function money(value: number | null) {
  if (!value) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function relativeDate(value: string | null) {
  if (!value) return "Jamais";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Jamais";
  const diffDays = Math.round((date.getTime() - Date.now()) / 86_400_000);
  if (diffDays === 0) return "Aujourd’hui";
  if (diffDays === -1) return "Hier";
  if (diffDays > -7 && diffDays < 0) return `Il y a ${Math.abs(diffDays)} j`;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "SD";
}

function roomLabel(room: SDRoomSummary | undefined) {
  if (!room) return { label: "À créer", className: "border-slate-400/20 bg-slate-400/[0.07] text-slate-300" };
  const current = room.documents.find(document => document.code === room.current_stage) || room.documents.find(document => document.code === "SD01");
  if (room.status === "published") return { label: "Room publiée", className: "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300" };
  if (current?.status === "review") return { label: "À relire", className: "border-amber-400/25 bg-amber-400/[0.08] text-amber-300" };
  return { label: "Brouillon", className: "border-primary/25 bg-primary/[0.08] text-primary" };
}

function StagePill({ code, room }: { code: SDCode; room?: SDRoomSummary }) {
  const document = room?.documents.find(item => item.code === code);
  const isCurrent = room?.current_stage === code;
  const className = document?.status === "validated" || document?.status === "published"
    ? "border-emerald-400/30 bg-emerald-400/[0.09] text-emerald-300"
    : document?.status === "review"
      ? "border-amber-400/30 bg-amber-400/[0.09] text-amber-300"
      : document?.status === "draft" && room
        ? "border-primary/25 bg-primary/[0.07] text-primary"
        : "border-border bg-muted/30 text-muted-foreground";

  return (
    <div className={cn("relative rounded-lg border px-2.5 py-2", className, isCurrent && "ring-1 ring-primary/30")}>
      <div className="flex items-center gap-1.5">
        {document?.status === "published" || document?.status === "validated" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
        <span className="text-[10px] font-black tracking-[0.08em]">{code}</span>
      </div>
      <div className="mt-1 truncate text-[10px] font-medium opacity-80">{document?.status === "review" ? "À relire" : document?.status === "published" ? "Publié" : document?.status === "validated" ? "Validé" : document?.status === "draft" && room ? "Brouillon" : "À venir"}</div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className="mt-1 text-sm font-bold">{value}</div>
    </div>
  );
}

function OverviewStat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <Card className="p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-black tracking-[-0.04em]">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{detail}</div>
    </Card>
  );
}

export function SDDealRoomHub() {
  const router = useRouter();
  const [deals, setDeals] = useState<DealRoomDeal[]>([]);
  const [rooms, setRooms] = useState<SDRoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingDealId, setWorkingDealId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HubFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dealsResponse, roomsResponse] = await Promise.all([
        fetch("/api/deals", { cache: "no-store" }),
        fetch("/api/sd-rooms", { cache: "no-store" }),
      ]);
      const [dealsPayload, roomsPayload] = await Promise.all([dealsResponse.json(), roomsResponse.json()]);
      if (!dealsResponse.ok) throw new Error(dealsPayload.message || dealsPayload.error || "Impossible de charger les deals.");
      if (!roomsResponse.ok) throw new Error(roomsPayload.message || roomsPayload.error || "Impossible de charger les Rooms SD.");
      setDeals(dealsPayload.results || []);
      setRooms(roomsPayload.results || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const roomMap = useMemo(() => new Map(rooms.map(room => [room.hubspot_deal_id, room])), [rooms]);
  const stats = useMemo(() => ({
    active: rooms.filter(room => room.status !== "archived").length,
    toCreate: deals.filter(deal => !roomMap.has(deal.id)).length,
    published: rooms.filter(room => room.status === "published").length,
    viewed: rooms.filter(room => room.opens > 0).length,
    comments: rooms.reduce((sum, room) => sum + room.openComments, 0),
  }), [deals, roomMap, rooms]);

  const visibleDeals = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return deals
      .filter(deal => {
        const room = roomMap.get(deal.id);
        if (filter === "to_create" && room) return false;
        if (filter === "draft" && (!room || room.status === "published" || room.status === "archived")) return false;
        if (filter === "published" && room?.status !== "published") return false;
        if (filter === "viewed" && (!room || room.opens < 1)) return false;
        if (!normalizedQuery) return true;
        return [deal.company?.name, deal.name, deal.ownerName, deal.company?.domain]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => {
        const roomA = roomMap.get(a.id);
        const roomB = roomMap.get(b.id);
        if (Boolean(roomA) !== Boolean(roomB)) return roomA ? -1 : 1;
        return (b.priorityScore || 0) - (a.priorityScore || 0);
      });
  }, [deals, filter, query, roomMap]);

  async function createRoom(dealId: string) {
    setWorkingDealId(dealId);
    setError("");
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Création de la Room SD impossible.");
      router.push(`/deal-room/${dealId}/sd`);
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "Création impossible");
      setWorkingDealId(null);
    }
  }

  return (
    <div className="page-shell h-screen overflow-y-auto p-5 lg:px-7 lg:py-6">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="overflow-hidden rounded-2xl border border-primary/20 bg-card">
          <div className="grid gap-0 xl:grid-cols-[1.45fr_0.9fr]">
            <div className="p-6 lg:p-8">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-primary"><Sparkles className="h-4 w-4" /> Méthode SD · Grands comptes</div>
              <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.045em] lg:text-4xl">Une Deal Room qui devient le dossier de décision partagé avec le client.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Du premier échange à la signature : construis le SD01 depuis les conversations, valide les faits, publie une version client, mesure ce que le board consulte puis avance jusqu’au SD05 sans perdre le contexte.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-md border-primary/20 bg-primary/[0.07] text-primary"><Bot className="mr-1.5 h-3.5 w-3.5" /> Agent depuis Onoff / transcript</Badge>
                <Badge variant="outline" className="rounded-md"><FileText className="mr-1.5 h-3.5 w-3.5" /> Saisie manuelle possible</Badge>
                <Badge variant="outline" className="rounded-md"><Eye className="mr-1.5 h-3.5 w-3.5" /> Tracking des consultations</Badge>
                <Badge variant="outline" className="rounded-md"><MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Remarques du board</Badge>
              </div>
            </div>
            <div className="border-t border-border bg-muted/20 p-5 xl:border-l xl:border-t-0 lg:p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Principe de publication</div>
              <div className="mt-4 space-y-3">
                <div className="flex gap-3"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Bot className="h-4 w-4" /></div><div><div className="text-sm font-bold">1. Capturer la vérité terrain</div><p className="mt-0.5 text-xs leading-5 text-muted-foreground">Appels, retranscriptions et notes alimentent le brouillon avec preuves.</p></div></div>
                <div className="flex gap-3"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-400/10 text-amber-300"><Clock3 className="h-4 w-4" /></div><div><div className="text-sm font-bold">2. Relire en interne</div><p className="mt-0.5 text-xs leading-5 text-muted-foreground">L’agent ne publie jamais seul : le brouillon reste séparé du client.</p></div></div>
                <div className="flex gap-3"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300"><Send className="h-4 w-4" /></div><div><div className="text-sm font-bold">3. Publier et suivre</div><p className="mt-0.5 text-xs leading-5 text-muted-foreground">Lien sécurisé, vues, visiteurs, temps actif et commentaires deviennent des signaux de deal.</p></div></div>
              </div>
            </div>
          </div>
        </header>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div><div className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Process de décision</div><h2 className="mt-1 text-lg font-bold">SD01 → SD05</h2></div>
            <div className="text-xs text-muted-foreground">Le contenu publié reste distinct du brouillon interne.</div>
          </div>
          <div className="grid gap-2 md:grid-cols-5">
            {SD_CODES.map((code, index) => (
              <Card key={code} className="relative overflow-hidden p-4">
                <div className="flex items-center justify-between"><span className="text-xs font-black tracking-[0.12em] text-primary">{code}</span><span className="text-[10px] font-bold text-muted-foreground">0{index + 1}</span></div>
                <div className="mt-2 text-sm font-bold">{SD_STAGE_META[code].title}</div>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{SD_STAGE_META[code].subtitle}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <OverviewStat label="Rooms actives" value={stats.active} detail="dossiers SD créés" />
          <OverviewStat label="À créer" value={stats.toCreate} detail="deals sans Room SD" />
          <OverviewStat label="Publiées" value={stats.published} detail="visibles côté client" />
          <OverviewStat label="Consultées" value={stats.viewed} detail="au moins une ouverture" />
          <OverviewStat label="Remarques ouvertes" value={stats.comments} detail="feedback à traiter" />
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black tracking-[-0.03em]">Rooms grands comptes</h2>
              <p className="mt-1 text-xs text-muted-foreground">Crée une Room SD directement depuis le deal, puis travaille le dossier jusqu’à la signature.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Entreprise, deal, owner…" className="pl-9" /></div>
              <Button variant="outline" size="icon" onClick={() => void load()} aria-label="Actualiser"><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map(item => {
              const count = item.key === "all" ? deals.length : item.key === "to_create" ? stats.toCreate : item.key === "published" ? stats.published : item.key === "viewed" ? stats.viewed : rooms.filter(room => room.status === "draft").length;
              return <Button key={item.key} variant={filter === item.key ? "default" : "outline"} size="sm" onClick={() => setFilter(item.key)}>{item.label}<span className="ml-1.5 opacity-70">{count}</span></Button>;
            })}
          </div>

          {error ? <Card className="border-rose-400/25 bg-rose-400/[0.06] p-4 text-sm text-rose-200">{error}</Card> : null}

          {loading ? (
            <Card className="grid min-h-72 place-items-center"><div className="text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Chargement des Rooms SD…</p></div></Card>
          ) : visibleDeals.length === 0 ? (
            <Card className="grid min-h-64 place-items-center p-8 text-center"><div><Sparkles className="mx-auto h-8 w-8 text-primary" /><div className="mt-3 font-bold">Aucune room dans cette vue</div><p className="mt-1 text-sm text-muted-foreground">Change le filtre ou recherche une autre entreprise.</p></div></Card>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {visibleDeals.map(deal => {
                const room = roomMap.get(deal.id);
                const state = roomLabel(room);
                return (
                  <Card key={deal.id} className="overflow-hidden transition-colors hover:border-primary/25">
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 gap-3">
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-black text-primary">{initials(deal.company?.name || deal.name)}</div>
                          <div className="min-w-0"><div className="truncate text-base font-black">{deal.company?.name || "Entreprise non associée"}</div><div className="mt-0.5 truncate text-xs text-muted-foreground">{deal.name}</div><div className="mt-2 flex flex-wrap gap-1.5">{deal.stageLabel ? <Badge variant="outline" className="rounded-md text-[10px]">{deal.stageLabel}</Badge> : null}{deal.ownerName ? <Badge variant="outline" className="rounded-md text-[10px]">{deal.ownerName}</Badge> : null}<Badge variant="outline" className="rounded-md text-[10px]">{money(deal.amount)}</Badge></div></div>
                        </div>
                        <Badge variant="outline" className={cn("shrink-0 rounded-md font-bold", state.className)}>{state.label}</Badge>
                      </div>

                      <div className="mt-5 grid grid-cols-5 gap-1.5">{SD_CODES.map(code => <StagePill key={code} code={code} room={room} />)}</div>

                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <Metric icon={Eye} label="Ouvertures" value={room?.opens || 0} />
                        <Metric icon={Users} label="Visiteurs" value={room?.uniqueVisitors || 0} />
                        <Metric icon={MessageSquare} label="Remarques" value={room?.openComments || 0} />
                        <Metric icon={Clock3} label="Dernière vue" value={relativeDate(room?.lastViewedAt || null)} />
                      </div>

                      <div className="mt-4 rounded-xl border border-border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
                        <span className="font-bold text-foreground">Prochaine action :</span> {deal.hsNextStep || deal.nextTaskSubject || (room ? `Faire avancer ${room.current_stage} et aligner le client.` : "Créer le SD01 et capturer le premier échange.")}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/10 px-5 py-3">
                      <div className="text-[11px] text-muted-foreground">{room ? <>Room mise à jour {relativeDate(room.updated_at)}{room.lastViewedAt ? <> · vue {relativeDate(room.lastViewedAt)}</> : null}</> : <>Aucun dossier SD pour ce deal</>}</div>
                      <div className="flex flex-wrap gap-2">
                        {room?.status === "published" ? <Button variant="outline" size="sm" asChild><a href={`/r/${room.share_token}`} target="_blank" rel="noreferrer"><Eye className="mr-1.5 h-3.5 w-3.5" /> Voir côté client</a></Button> : null}
                        <Button variant="outline" size="sm" asChild><Link href={`/deal-room/${deal.id}`}>War room</Link></Button>
                        {room ? (
                          <Button size="sm" asChild><Link href={`/deal-room/${deal.id}/sd`}>Ouvrir la Room SD <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button>
                        ) : (
                          <Button size="sm" onClick={() => void createRoom(deal.id)} disabled={workingDealId === deal.id}>{workingDealId === deal.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}Créer le SD01</Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
