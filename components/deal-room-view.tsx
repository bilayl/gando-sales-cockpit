"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CircleX,
  Crosshair,
  ExternalLink,
  Gauge,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AvatarTile,
  HealthBadge,
  PriorityBar,
  QUICK_VIEWS,
  ScoreRing,
  SCORE_TONE_CLASSES,
  formatDate,
  formatEuro,
  formatNumber,
  formatPercent,
  formatRelative,
  initials,
  useNow,
} from "@/components/deal-room-shared";
import type { DealRoomDeal, DealRoomKPIs, DealRoomQuickView } from "@/lib/deal-room-types";
import { cn } from "@/lib/utils";

type Owner = { id: string; firstName?: string; lastName?: string; email?: string };

const emptyKPIs: DealRoomKPIs = {
  pipelineValue: 0, activeDeals: 0, atRisk: 0, noNextAction: 0, noMeeting: 0,
  closingSoon: 0, wonThisMonth: 0, wonThisMonthValue: 0, lostThisMonth: 0, weightedForecast: 0,
};

function KpiCell({ label, value, detail, tone }: { label: string; value: string | number; detail: string; tone?: "default" | "warn" | "bad" | "good" }) {
  return (
    <div className="border-b border-border px-4 py-3 sm:border-b-0">
      <div className="text-[9px] font-bold uppercase tracking-[0.13em] text-muted-foreground">{label}</div>
      <div className={cn(
        "mt-1 text-xl font-bold tracking-[-0.03em]",
        tone === "warn" && "text-amber-400", tone === "bad" && "text-rose-400", tone === "good" && "text-emerald-400",
      )}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{detail}</div>
    </div>
  );
}

function KpiStrip({ kpis }: { kpis: DealRoomKPIs }) {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-9">
        <KpiCell label="Pipeline grands comptes" value={formatEuro(kpis.pipelineValue)} detail={`${kpis.activeDeals} deals actifs`} tone="good" />
        <KpiCell label="Deals actifs" value={kpis.activeDeals} detail="ouverts & stratégiques" />
        <KpiCell label="Deals à risque" value={kpis.atRisk} detail="health At Risk" tone={kpis.atRisk ? "bad" : "default"} />
        <KpiCell label="Sans prochaine action" value={kpis.noNextAction} detail="ni étape ni tâche" tone={kpis.noNextAction ? "warn" : "default"} />
        <KpiCell label="Sans RDV planifié" value={kpis.noMeeting} detail="aucun rendez-vous à venir" tone={kpis.noMeeting ? "warn" : "default"} />
        <KpiCell label="Closing ≤ 30 j" value={kpis.closingSoon} detail="date de closing proche" />
        <KpiCell label="Gagnés ce mois" value={kpis.wonThisMonth} detail={formatEuro(kpis.wonThisMonthValue)} tone="good" />
        <KpiCell label="Perdus ce mois" value={kpis.lostThisMonth} detail="deals stratégiques" tone={kpis.lostThisMonth ? "bad" : "default"} />
        <KpiCell label="Forecast pondéré" value={formatEuro(kpis.weightedForecast)} detail="montant × probabilité" />
      </div>
    </Card>
  );
}

function Field({ label, value, tone }: { label: string; value: string; tone?: "default" | "good" | "bad" | "warn" }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 truncate text-[13px] font-semibold", tone === "good" && "text-emerald-300", tone === "bad" && "text-rose-300", tone === "warn" && "text-amber-300")}>{value}</div>
    </div>
  );
}

function DealCard({ deal }: { deal: DealRoomDeal }) {
  const now = useNow();
  const inactive = deal.daysSinceLastActivity !== null && deal.daysSinceLastActivity > 7;
  return (
    <Card className="hover-lift flex flex-col gap-4 p-5 transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AvatarTile name={deal.company?.name || deal.name} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold">{deal.company?.name || "Entreprise non associée"}</span>
              {deal.company?.industry ? <span className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground lg:block">{deal.company.industry}</span> : null}
            </div>
            <div className="truncate text-xs text-muted-foreground">{deal.company?.domain || deal.name}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ScoreRing value={deal.score} />
          <HealthBadge health={deal.health} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {deal.stageLabel ? <Badge variant="outline" className="rounded-md border-primary/20 bg-primary/[0.07] font-semibold text-primary">{deal.stageLabel}</Badge> : null}
        <Badge variant="outline" className="rounded-md border-border bg-muted/45 font-medium text-muted-foreground">{formatPercent(deal.stageProbability)} closing</Badge>
        {deal.ownerName ? (
          <Badge variant="outline" className="rounded-md border-border bg-muted/45 font-medium text-muted-foreground">
            <UserRound className="mr-1 h-3 w-3" /> {deal.ownerName}
          </Badge>
        ) : null}
        {deal.meetingPlanned ? (
          <Badge variant="outline" className="rounded-md border-sky-400/25 bg-sky-400/[0.07] font-medium text-sky-300">
            <CalendarClock className="mr-1 h-3 w-3" /> RDV {formatRelative(deal.nextMeetingAt)}
          </Badge>
        ) : null}
      </div>

      <PriorityBar deal={deal} />
      <p className="text-xs leading-5 text-muted-foreground">{">"} {deal.priorityExplanation}</p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Field label="Valeur estimée" value={formatEuro(deal.amount)} />
        <Field label="Potentiel annuel" value={deal.potentialArr ? formatEuro(deal.potentialArr) : "Non renseigné"} />
        <Field label="Volume potentiel" value={deal.potentialVolume ? formatNumber(deal.potentialVolume) : "Non renseigné"} />
        <Field label="Close date" value={formatDate(deal.closeDate, true)} tone={deal.closeDate && new Date(deal.closeDate).getTime() < now ? "bad" : "default"} />
        <Field label="Dernière interaction" value={formatRelative(deal.lastActivityAt)} tone={inactive ? "bad" : "default"} />
        <Field label="Jours sans activité" value={deal.daysSinceLastActivity === null ? "Inconnu" : `${deal.daysSinceLastActivity} j`} tone={inactive ? "warn" : "default"} />
        <Field label="Champion" value={deal.championIdentified ? `OUI · ${deal.championName || ""}` : "NON"} tone={deal.championIdentified ? "good" : "warn"} />
        <Field label="Décideur" value={deal.decisionMakerIdentified ? `OUI · ${deal.decisionMakerName || ""}` : "NON"} tone={deal.decisionMakerIdentified ? "good" : "bad"} />
        <Field label="Prochain RDV" value={deal.nextMeetingAt ? formatDate(deal.nextMeetingAt, true) : "Aucun"} tone={deal.meetingPlanned ? "good" : "default"} />
      </div>

      <div className={cn("rounded-lg px-3 py-2 text-xs leading-5", deal.hsNextStep || deal.nextTaskSubject ? "bg-muted/55 text-muted-foreground" : "border border-amber-400/25 bg-amber-400/[0.06] text-foreground")}>
        <span className="font-semibold text-foreground">Prochaine action :</span>{" "}
        {deal.hsNextStep || deal.nextTaskSubject || "aucune — à définir"}
        {deal.nextTaskDueAt ? <span className="text-muted-foreground"> · {formatRelative(deal.nextTaskDueAt)}</span> : null}
        {deal.openTasksCount ? <span className="ml-1 text-primary">· {deal.openTasksCount} tâche{deal.openTasksCount > 1 ? "s" : ""} en attente</span> : null}
      </div>

      {deal.blockers.length ? (
        <div className="flex flex-wrap gap-1.5">
          {deal.blockers.slice(0, 3).map(blocker => (
            <Badge key={blocker} variant="outline" className="rounded-md border-rose-400/25 bg-rose-400/[0.07] font-medium text-rose-300">⛔ {blocker}</Badge>
          ))}
          {deal.blockers.length > 3 ? <Badge variant="outline" className="rounded-md border-border bg-muted/45 font-medium text-muted-foreground">+{deal.blockers.length - 3}</Badge> : null}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-1.5">
        {deal.scoreReasons.slice(0, 4).map(reason => (
          <Badge key={reason.text} variant="outline" className={cn("rounded-md font-medium", SCORE_TONE_CLASSES[reason.tone])}>{reason.text}</Badge>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex items-center gap-1.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">{initials(deal.ownerName || "?")}</span>
          <span className="text-[11px] font-semibold text-muted-foreground">{deal.ownerName || "Sans owner"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {deal.hubspotUrl ? (
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Ouvrir dans HubSpot">
              <a href={deal.hubspotUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
            </Button>
          ) : null}
          <Button size="sm" asChild>
            <Link href={`/deal-room/${deal.id}`}>Ouvrir la war room <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function DealRoomView() {
  const [deals, setDeals] = useState<DealRoomDeal[]>([]);
  const [kpis, setKpis] = useState<DealRoomKPIs>(emptyKPIs);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [owners, setOwners] = useState<Owner[]>([]);
  const [view, setView] = useState<DealRoomQuickView>("all");
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [sort, setSort] = useState<"priority" | "value" | "close" | "score">("priority");
  const requestSequence = useRef(0);

  const load = useCallback(async (silent = false) => {
    const requestId = ++requestSequence.current;
    if (!silent) setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (ownerFilter !== "all") params.set("owner", ownerFilter);
      const response = await fetch(`/api/deals${params.toString() ? `?${params}` : ""}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Impossible de charger la Deal Room");
      if (requestId !== requestSequence.current) return;
      setDeals(data.results || []);
      setKpis(data.kpis || emptyKPIs);
    } catch (loadError) {
      if (requestId !== requestSequence.current) return;
      setError(loadError instanceof Error ? loadError.message : "Erreur de chargement");
    } finally {
      if (!silent && requestId === requestSequence.current) setLoading(false);
    }
  }, [ownerFilter]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    fetch("/api/owners")
      .then(response => response.json())
      .then(data => setOwners(data.results || []))
      .catch(() => setOwners([]));
  }, []);

  const stageOptions = useMemo(() => {
    const stages = deals.map(deal => deal.stageLabel).filter((label): label is string => Boolean(label));
    return [...new Set(stages)];
  }, [deals]);

  const filtered = useMemo(() => {
    const viewMatcher = QUICK_VIEWS.find(item => item.key === view)?.match || (() => true);
    const q = query.trim().toLowerCase();
    let list = deals.filter(deal => {
      if (!viewMatcher(deal)) return false;
      if (view === "highest_value") {
        const topAmounts = [...deals].map(item => item.amount || 0).sort((a, b) => b - a).slice(0, 5);
        const threshold = topAmounts.length ? topAmounts[topAmounts.length - 1] : 0;
        if ((deal.amount || 0) < threshold) return false;
      }
      if (stageFilter !== "all" && deal.stageLabel !== stageFilter) return false;
      if (healthFilter !== "all" && deal.health !== healthFilter) return false;
      if (q) {
        const haystack = [deal.name, deal.company?.name, deal.company?.domain, deal.ownerName, deal.hsNextStep, deal.championName, deal.decisionMakerName]
          .filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    if (view === "highest_value") list = list.sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, 5);
    list = [...list].sort((a, b) => {
      if (sort === "priority") return b.priorityScore - a.priorityScore;
      if (sort === "value") return (b.amount || 0) - (a.amount || 0);
      if (sort === "score") return b.score - a.score;
      return (a.closeDate || "9999").localeCompare(b.closeDate || "9999");
    });
    return list;
  }, [deals, view, query, stageFilter, healthFilter, sort]);

  return (
    <div className="page-shell h-screen overflow-y-auto p-5 lg:px-7 lg:py-6 minari-scrollbar">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Crosshair className="h-4 w-4" /> Deal Room
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em]">Centre de commandement des grands comptes</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Les opportunités stratégiques de Gando, priorisées pour savoir quoi faire aujourd’hui — HubSpot reste la source de vérité.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-9 border-primary/20 bg-primary/[0.06] px-3 text-primary"><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Priorisation automatique</Badge>
            <Button variant="outline" size="icon" aria-label="Actualiser" onClick={() => void load()}><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></Button>
          </div>
        </header>

        {error ? <div className="rounded-xl border border-rose-400/25 bg-rose-400/[0.06] px-4 py-3 text-sm text-foreground"><AlertTriangle className="mr-2 inline h-4 w-4 text-rose-400" />{error}</div> : null}

        <KpiStrip kpis={kpis} />

        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Vues rapides Deal Room">
          {QUICK_VIEWS.map(item => {
            const count = item.key === "all" ? deals.length : item.key === "highest_value" ? Math.min(5, deals.length) : deals.filter(item.match).length;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={view === item.key}
                onClick={() => setView(item.key)}
                className={cn(
                  "shrink-0 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  view === item.key && "border-primary/30 bg-primary/[0.08] text-primary",
                )}
              >
                <span className="mr-1.5">{item.emoji}</span>{item.label}
                {count ? <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[9px] text-foreground">{count}</span> : null}
              </button>
            );
          })}
        </div>

        <Card className="p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative xl:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Entreprise, deal, contact, action…" className="h-9 pl-9" />
            </div>
            <div className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-4">
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Owner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les owners</SelectItem>
                  {owners.map(owner => <SelectItem key={owner.id} value={owner.id}>{[owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.email || owner.id}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Stage" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les stages</SelectItem>
                  {stageOptions.map(stage => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={healthFilter} onValueChange={setHealthFilter}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Santé" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="on_track">🟢 On Track</SelectItem>
                  <SelectItem value="attention">🟠 Attention</SelectItem>
                  <SelectItem value="at_risk">🔴 At Risk</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={value => setSort(value as typeof sort)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Tri" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">Tri : Priorité</SelectItem>
                  <SelectItem value="value">Tri : Valeur</SelectItem>
                  <SelectItem value="score">Tri : Deal Score</SelectItem>
                  <SelectItem value="close">Tri : Close date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Gauge className="h-3.5 w-3.5 text-primary" /> Deal Score = momentum + santé du deal</span>
            <span className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5 text-primary" /> Priority Score = valeur économique + stratégique + momentum</span>
            <span className="flex items-center gap-1"><Wallet className="h-3.5 w-3.5 text-primary" /> Sont inclus : deals marqués stratégiques, montant ≥ 20 000 € ou ARR potentiel ≥ 50 000 €</span>
          </p>
        </Card>

        {loading ? (
          <div className="grid min-h-96 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length ? (
          <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3" aria-label="Deals stratégiques">
            {filtered.map(deal => <DealCard key={deal.id} deal={deal} />)}
          </section>
        ) : (
          <Card className="grid min-h-96 place-items-center px-6 text-center">
            <div>
              <Crosshair className="mx-auto h-8 w-8 text-primary/60" />
              <div className="mt-3 font-semibold">Aucun deal stratégique dans cette vue</div>
              <div className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {deals.length === 0
                  ? "Aucun deal stratégique ouvert n’est visible. Un deal est stratégique s’il est marqué « stratégique », s’il dépasse 20 000 € ou un potentiel annuel de 50 000 € dans HubSpot."
                  : "Aucun deal ne correspond aux filtres actuels."}
              </div>
              {deals.length === 0 ? (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Badge variant="outline" className="rounded-md border-border bg-muted/45 font-medium">Propriété HubSpot : strategic_deal (booléen)</Badge>
                  <Badge variant="outline" className="rounded-md border-border bg-muted/45 font-medium">Montant ≥ 20 000 €</Badge>
                  <Badge variant="outline" className="rounded-md border-border bg-muted/45 font-medium">potential_arr ≥ 50 000 €</Badge>
                </div>
              ) : null}
            </div>
          </Card>
        )}

        {!loading && filtered.length ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> {filtered.length} deal{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""} · priorisé{filtered.length > 1 ? "s" : ""} par score
            {kpis.atRisk ? <span className="text-rose-300">· {kpis.atRisk} à risque</span> : null}
            {kpis.noNextAction ? <span className="text-amber-300">· {kpis.noNextAction} sans prochaine action</span> : null}
            <CircleX className="ml-1 h-3.5 w-3.5 text-rose-300" />
          </div>
        ) : null}
      </div>
    </div>
  );
}