"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  CircleX,
  Clock3,
  ExternalLink,
  FileText,
  Flame,
  Heart,
  ListTodo,
  Loader2,
  Mail,
  MessageSquare,
  PencilLine,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import {
  AvatarTile,
  BreakdownBars,
  HEALTH_META,
  HealthBadge,
  PriorityBar,
  ScoreRing,
  SCORE_TONE_CLASSES,
  formatDate,
  formatDateTime,
  formatEuro,
  formatNumber,
  formatPercent,
  formatRelative,
  useNow,
} from "@/components/deal-room-shared";
import {
  ClosingPlanStepDialog,
  DealActionDialog,
  StakeholderRoleDialog,
  type DealActionKind,
} from "@/components/deal-room-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  ClosingPlanStep,
  DealMeeting,
  DealRoomContact,
  DealRoomDetail,
  Stakeholder,
  TimelineItem,
} from "@/lib/deal-room-types";
import { cn } from "@/lib/utils";

const MEETING_STATUS_META: Record<string, { label: string; badge: string }> = {
  SCHEDULED: { label: "Planifié", badge: "border-sky-400/30 bg-sky-400/10 text-sky-300" },
  COMPLETED: { label: "Terminé", badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  RESCHEDULED: { label: "Reporté", badge: "border-amber-400/30 bg-amber-400/10 text-amber-300" },
  NO_SHOW: { label: "No-show", badge: "border-rose-400/30 bg-rose-400/10 text-rose-300" },
  CANCELED: { label: "Annulé", badge: "border-rose-400/30 bg-rose-400/10 text-rose-300" },
  UNREVIEWED: { label: "À traiter", badge: "border-border bg-muted/45 text-muted-foreground" },
};

function SectionTitle({ icon: Icon, title, action }: { icon: ComponentType<{ className?: string }>; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="section-title flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /> {title}</h2>
      {action}
    </div>
  );
}

function OverviewFact({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "warn" }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 truncate text-sm font-semibold", tone === "good" && "text-emerald-300", tone === "bad" && "text-rose-300", tone === "warn" && "text-amber-300")}>{value}</div>
    </div>
  );
}

function MeetingCard({ meeting }: { meeting: DealMeeting }) {
  const meta = MEETING_STATUS_META[meeting.outcome] || MEETING_STATUS_META.UNREVIEWED;
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{meeting.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> {formatDateTime(meeting.startAt)}</span>
            {meeting.ownerName ? <span className="flex items-center gap-1"><UserRound className="h-3 w-3" /> {meeting.ownerName}</span> : null}
            {meeting.participants.length ? <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {meeting.participants.join(", ")}</span> : null}
          </div>
        </div>
        <Badge variant="outline" className={cn("shrink-0 rounded-md font-medium", meta.badge)}>{meta.label}</Badge>
      </div>

      {(meeting.decided || meeting.objections || meeting.commitments || meeting.nextAction) ? (
        <div className="mt-3 space-y-2 rounded-lg bg-muted/45 p-3 text-xs leading-5">
          {meeting.decided ? (
            <p><CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5 text-emerald-400" /><strong className="text-foreground">Ce qui a été décidé :</strong> <span className="text-muted-foreground">{meeting.decided}</span></p>
          ) : null}
          {meeting.objections ? (
            <p><XCircle className="mr-1.5 inline h-3.5 w-3.5 text-rose-400" /><strong className="text-foreground">Objections :</strong> <span className="text-muted-foreground">{meeting.objections}</span></p>
          ) : null}
          {meeting.commitments ? (
            <p><Heart className="mr-1.5 inline h-3.5 w-3.5 text-primary" /><strong className="text-foreground">Engagements pris :</strong> <span className="text-muted-foreground">{meeting.commitments}</span></p>
          ) : null}
          {meeting.nextAction ? (
            <p><ArrowUpRight className="mr-1.5 inline h-3.5 w-3.5 text-primary" /><strong className="text-foreground">Prochaine étape :</strong> <span className="text-muted-foreground">{meeting.nextAction}{meeting.nextActionAt ? ` · ${formatDate(meeting.nextActionAt, true)}` : ""}</span></p>
          ) : null}
        </div>
      ) : null}

      {meeting.notes ? <p className="mt-3 line-clamp-3 text-xs leading-5 text-muted-foreground">{meeting.notes}</p> : null}

      {meeting.hubspotUrl ? (
        <div className="mt-3">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild><a href={meeting.hubspotUrl} target="_blank" rel="noreferrer">Voir dans HubSpot <ExternalLink className="ml-1 h-3 w-3" /></a></Button>
        </div>
      ) : null}
    </article>
  );
}

const TIMELINE_META: Record<TimelineItem["kind"], { label: string; icon: ComponentType<{ className?: string }>; badge: string }> = {
  note: { label: "Note", icon: FileText, badge: "border-violet-400/25 bg-violet-400/[0.07] text-violet-300" },
  call: { label: "Appel", icon: Phone, badge: "border-sky-400/25 bg-sky-400/[0.07] text-sky-300" },
  meeting: { label: "Rendez-vous", icon: CalendarCheck2, badge: "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-300" },
  task: { label: "Tâche", icon: ListTodo, badge: "border-amber-400/25 bg-amber-400/[0.07] text-amber-300" },
  email: { label: "Email", icon: Mail, badge: "border-primary/25 bg-primary/[0.07] text-primary" },
};

const ROLE_BADGES: Record<string, string> = {
  Champion: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  "Decision Maker": "border-primary/30 bg-primary/10 text-primary",
  "Economic Buyer": "border-violet-400/30 bg-violet-400/10 text-violet-300",
  Technical: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  Legal: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  Operational: "border-teal-400/30 bg-teal-400/10 text-teal-300",
  Blocker: "border-rose-400/30 bg-rose-400/10 text-rose-300",
};

function StakeholderCard({ stakeholder, onSetRole, isChampion, isDecisionMaker }: {
  stakeholder: Stakeholder;
  onSetRole: (contact: DealRoomContact, current: "champion" | "decision" | null) => void;
  isChampion: boolean;
  isDecisionMaker: boolean;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <AvatarTile name={stakeholder.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-bold">{stakeholder.name}</span>
            {stakeholder.influence === "strong" ? <Badge variant="outline" className="rounded-md border-border bg-muted/45 font-medium text-muted-foreground">Influence forte</Badge> : null}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{stakeholder.jobtitle || "Fonction non renseignée"} · {stakeholder.company || "Entreprise non renseignée"}</div>
          {(stakeholder.email || stakeholder.phone) ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {stakeholder.email ? <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" /> {stakeholder.email}</span> : null}
              {stakeholder.phone ? <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {stakeholder.phone}</span> : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {stakeholder.roles.length ? stakeholder.roles.map(role => (
          <Badge key={role} variant="outline" className={cn("rounded-md font-medium", ROLE_BADGES[role] || "border-border bg-muted/45 text-muted-foreground")}>{role}</Badge>
        )) : <span className="text-[11px] text-muted-foreground">Aucun rôle déduit du titre de poste</span>}
        {isChampion ? <Badge variant="outline" className="rounded-md border-emerald-400/30 bg-emerald-400/10 font-medium text-emerald-300">Champion (manuel)</Badge> : null}
        {isDecisionMaker ? <Badge variant="outline" className="rounded-md border-primary/30 bg-primary/10 font-medium text-primary">Décideur (manuel)</Badge> : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
        <Button variant="outline" size="sm" onClick={() => onSetRole(stakeholder, isChampion && !isDecisionMaker ? "champion" : null)}>
          <Heart className="mr-1.5 h-3.5 w-3.5 text-emerald-400" /> Champion
        </Button>
        <Button variant="outline" size="sm" onClick={() => onSetRole(stakeholder, isDecisionMaker ? "decision" : null)}>
          <Target className="mr-1.5 h-3.5 w-3.5 text-primary" /> Décideur
        </Button>
        {stakeholder.lastActivityAt ? <span className="ml-auto text-[10px] text-muted-foreground">Dernière activité {formatRelative(stakeholder.lastActivityAt)}</span> : null}
      </div>
    </article>
  );
}

export function DealWarRoom({ dealId }: { dealId: string }) {
  const [detail, setDetail] = useState<DealRoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [action, setAction] = useState<DealActionKind | null>(null);
  const [roleDialog, setRoleDialog] = useState<{ contact: DealRoomContact; current: "champion" | "decision" | null } | null>(null);
  const [planDialog, setPlanDialog] = useState<ClosingPlanStep | null>(null);
  const [meetingGroup, setMeetingGroup] = useState<"upcoming" | "completed" | "noShow" | "cancelled">("upcoming");
  const requestSequence = useRef(0);
  const now = useNow();

  const load = useCallback(async (silent = false) => {
    const requestId = ++requestSequence.current;
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Impossible de charger la Deal Room");
      if (requestId !== requestSequence.current) return;
      setDetail(data);
    } catch (loadError) {
      if (requestId !== requestSequence.current) return;
      setError(loadError instanceof Error ? loadError.message : "Erreur de chargement");
    } finally {
      if (!silent && requestId === requestSequence.current) setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);

  const meetings = detail?.meetings;
  const meetingTabItems = useMemo(() => {
    if (!meetings) return [];
    const groups: Array<{ key: "upcoming" | "completed" | "noShow" | "cancelled"; label: string; items: DealMeeting[] }> = [
      { key: "upcoming", label: "À venir", items: meetings.upcoming },
      { key: "completed", label: "Terminés", items: meetings.completed },
      { key: "noShow", label: "No-show", items: meetings.noShow },
      { key: "cancelled", label: "Annulés", items: meetings.cancelled },
    ];
    return groups;
  }, [meetings]);

  const currentMeetings = useMemo(() => {
    if (!meetingTabItems) return [];
    return (meetingTabItems.find(group => group.key === meetingGroup)?.items || []).slice(0, 8);
  }, [meetingTabItems, meetingGroup]);

  if (loading) {
    return (
      <div className="page-shell h-screen overflow-y-auto p-5 lg:px-7 lg:py-6">
        <div className="grid min-h-96 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="page-shell h-screen overflow-y-auto p-5 lg:px-7 lg:py-6">
        <div className="mx-auto max-w-2xl">
          <Button variant="ghost" size="sm" asChild className="mb-4"><Link href="/deal-room"><ArrowLeft className="mr-1.5 h-4 w-4" /> Retour à la Deal Room</Link></Button>
          <Card className="grid min-h-64 place-items-center px-6 text-center">
            <div>
              <AlertTriangle className="mx-auto h-8 w-8 text-rose-400" />
              <div className="mt-3 font-semibold">Impossible d’ouvrir ce deal</div>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const closeDate = detail.closeDate ? new Date(detail.closeDate) : null;
  const closeDateStatus = closeDate && closeDate.getTime() >= now && (closeDate.getTime() - now) <= 30 * 86_400_000
    ? "good" as const
    : closeDate && closeDate.getTime() < now ? "bad" as const : undefined;

  return (
    <div className="page-shell h-screen overflow-y-auto p-5 lg:px-7 lg:py-6 minari-scrollbar">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" asChild><Link href="/deal-room"><ArrowLeft className="mr-1.5 h-4 w-4" /> Deal Room</Link></Button>
          {detail.hubspotUrl ? (
            <Button variant="outline" size="sm" asChild><a href={detail.hubspotUrl} target="_blank" rel="noreferrer">Ouvrir dans HubSpot <ExternalLink className="ml-1 h-3.5 w-3.5" /></a></Button>
          ) : null}
          <Button size="sm" asChild><Link href={`/deal-room/${dealId}/sd`}><Sparkles className="mr-1.5 h-4 w-4" /> Room SD client</Link></Button>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Actualiser" onClick={() => void load(true)}><RefreshCw className="h-4 w-4" /></Button>
        </div>

        <header className="rounded-2xl border border-border bg-card p-5 lg:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <AvatarTile name={detail.company?.name || detail.name} className="h-12 w-12 rounded-xl text-base" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{detail.company?.name || "Entreprise non associée"}</span>
                  {detail.company?.industry ? <span className="text-xs text-muted-foreground">{detail.company.industry}</span> : null}
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em]">{detail.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {detail.stageLabel ? <Badge variant="outline" className="rounded-md border-primary/20 bg-primary/[0.07] font-semibold text-primary">{detail.stageLabel}</Badge> : null}
                  <Badge variant="outline" className="rounded-md border-border bg-muted/45 font-medium text-muted-foreground">{formatPercent(detail.stageProbability)} probabilité de closing</Badge>
                  {detail.ownerName ? <Badge variant="outline" className="rounded-md border-border bg-muted/45 font-medium text-muted-foreground"><UserRound className="mr-1 h-3 w-3" /> {detail.ownerName}</Badge> : null}
                  <HealthBadge health={detail.health} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {detail.potentialArr ? <span><strong className="text-foreground">{formatEuro(detail.potentialArr)}</strong> ARR potentiel</span> : null}
                  {detail.potentialVolume ? <span><strong className="text-foreground">{formatNumber(detail.potentialVolume)}</strong> volume potentiel</span> : null}
                  {detail.closeDate ? <span>Closing : {formatDate(detail.closeDate, true)}</span> : null}
                  <span>Dernière activité : {formatRelative(detail.lastActivityAt)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 lg:flex-col lg:items-end">
              <div className="flex items-center gap-3">
                <ScoreRing value={detail.score} size={52} label="Deal Score" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">Deal Score</div>
                  <div className="text-lg font-bold">{detail.score}<span className="text-xs text-muted-foreground">/100</span></div>
                  <div className={cn("mt-0.5 h-1 w-24 overflow-hidden rounded-full bg-muted")}>
                    <div className={cn("h-full rounded-full", HEALTH_META[detail.health].bar)} style={{ width: `${detail.score}%` }} />
                  </div>
                </div>
              </div>
              <div className="min-w-52">
                <PriorityBar deal={detail} />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-x-6 gap-y-3 border-t border-border pt-5 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewFact label="Valeur estimée" value={formatEuro(detail.amount)} />
            <OverviewFact label="Probabilité" value={formatPercent(detail.stageProbability)} />
            <OverviewFact label="Close date" value={formatDate(detail.closeDate, true)} tone={closeDateStatus} />
            <OverviewFact label="Jours sans activité" value={detail.daysSinceLastActivity === null ? "Inconnu" : `${detail.daysSinceLastActivity} j`} tone={detail.daysSinceLastActivity !== null && detail.daysSinceLastActivity > 7 ? "warn" : undefined} />
            <OverviewFact label="Champion" value={detail.championIdentified ? `OUI · ${detail.championName || ""}` : "NON"} tone={detail.championIdentified ? "good" : "warn"} />
            <OverviewFact label="Décideur" value={detail.decisionMakerIdentified ? `OUI · ${detail.decisionMakerName || ""}` : "NON"} tone={detail.decisionMakerIdentified ? "good" : "bad"} />
            <OverviewFact label="Prochain RDV" value={detail.nextMeetingAt ? formatDate(detail.nextMeetingAt, true) : "Aucun"} tone={detail.meetingPlanned ? "good" : "warn"} />
            <OverviewFact label="Prochaine étape" value={detail.hsNextStep || detail.nextTaskSubject || "Aucune"} tone={detail.hsNextStep || detail.nextTaskSubject ? undefined : "bad"} />
          </div>

          {detail.overviewMissing.length ? (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">À compléter dans HubSpot :</span>
              {detail.overviewMissing.map(item => <Badge key={item} variant="outline" className="rounded-md border-amber-400/25 bg-amber-400/[0.07] font-medium text-amber-300">{item}</Badge>)}
            </div>
          ) : null}
        </header>

        <div className="sticky top-0 z-10 -mx-5 border-y border-border/70 bg-background/85 px-5 py-2.5 backdrop-blur lg:-mx-7 lg:px-7">
          <div className="mx-auto flex max-w-[1500px] items-center gap-2 overflow-x-auto minari-scrollbar">
            <span className="mr-1 shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Actions rapides</span>
            <ActionButton icon={Phone} label="Log Call" onClick={() => setAction("log_call")} tone="sky" />
            <ActionButton icon={MessageSquare} label="Note" onClick={() => setAction("note")} tone="violet" />
            <ActionButton icon={ListTodo} label="Tâche" onClick={() => setAction("task")} tone="amber" />
            <ActionButton icon={CalendarClock} label="RDV" onClick={() => setAction("meeting")} tone="emerald" />
            <ActionButton icon={Mail} label="Email" onClick={() => window.location.href = detail.contacts[0]?.email ? `mailto:${detail.contacts[0].email}` : "mailto:"} tone="primary" />
            <ActionButton icon={PencilLine} label="Stage" onClick={() => setAction("stage")} tone="primary" />
            <ActionButton icon={UserRound} label="Contact" onClick={() => setAction("contact")} tone="teal" />
            <ActionButton icon={ShieldCheck} label="Blocker" onClick={() => setAction("blocker")} tone="rose" />
            <ActionButton icon={ArrowUpRight} label="Prochaine action" onClick={() => setAction("next_step")} tone="primary" />
          </div>
        </div>

        {message ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-3 text-sm text-foreground">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> {message}
            <Button variant="ghost" size="icon" className="ml-auto h-6 w-6" onClick={() => setMessage("")}><CircleX className="h-4 w-4" /></Button>
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-2" aria-label="Ce qu’il faut savoir et action recommandée">          <Card className="p-5">
            <SectionTitle icon={Sparkles} title="Ce qu’il faut savoir" />
            <p className="mt-1 text-[11px] text-muted-foreground">Synthèse factuelle, uniquement à partir des données HubSpot.</p>
            <ul className="mt-3 space-y-2">
              {detail.intelligence.mustKnow.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                  <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-primary" /> {item}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="border-primary/25 bg-primary/[0.04] p-5">
            <SectionTitle icon={Target} title="Action recommandée" />
            <div className="mt-3 rounded-xl border border-primary/20 bg-card p-4">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">À faire maintenant</div>
              <p className="mt-2 text-base font-bold leading-6">{detail.intelligence.recommendedAction}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail.intelligence.recommendedActionReason}</p>
            </div>
            <BreakdownBars deal={detail} className="mt-4" />
          </Card>
        </section>

        <section aria-label="Stakeholders">
          <SectionTitle icon={Users} title="Stakeholders" action={<Badge variant="outline" className="rounded-md border-border bg-muted/45 font-medium text-muted-foreground">{detail.stakeholders.length} contacts</Badge>} />
          <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 lg:grid-cols-4">
            <div className="flex items-center gap-2">
              <span className={cn("grid h-9 w-9 place-items-center rounded-lg", detail.decisionMakerIdentified ? "bg-primary/10 text-primary" : "bg-rose-400/10 text-rose-400")}>
                <Target className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xs font-bold">Décideur identifié : {detail.decisionMakerIdentified ? "OUI" : "NON"}</div>
                <div className="text-[11px] text-muted-foreground">{detail.decisionMakerName || "Aucun — engager un décideur"}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("grid h-9 w-9 place-items-center rounded-lg", detail.championIdentified ? "bg-emerald-400/10 text-emerald-400" : "bg-amber-400/10 text-amber-400")}>
                <Heart className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xs font-bold">Champion identifié : {detail.championIdentified ? "OUI" : "NON"}</div>
                <div className="text-[11px] text-muted-foreground">{detail.championName || "Aucun — trouver un allié interne"}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground"><Flame className="h-4 w-4" /></span>
              <div>
                <div className="text-xs font-bold">Influence forte</div>
                <div className="text-[11px] text-muted-foreground">{detail.stakeholders.filter(item => item.influence === "strong").length} col du budget/de la décision</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground"><Zap className="h-4 w-4" /></span>
              <div>
                <div className="text-xs font-bold">{detail.blockers.includes("Pas de décideur identifié") ? "Blocage décision" : "Circuit de décision"}</div>
                <div className="text-[11px] text-muted-foreground">{detail.blockers.filter(item => /décideur|champion/i.test(item)).join(", ") || "Aucun blocage décisionnel"}</div>
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {detail.stakeholders.map(stakeholder => (
              <StakeholderCard
                key={stakeholder.id}
                stakeholder={stakeholder}
                isChampion={stakeholder.id === detail.championId && (detail.championId !== null || detail.championName === stakeholder.name)}
                isDecisionMaker={stakeholder.id === detail.decisionMakerId || detail.decisionMakerName === stakeholder.name}
                onSetRole={(contact, current) => setRoleDialog({ contact, current })}
              />
            ))}
            {!detail.stakeholders.length ? (
              <Card className="grid min-h-40 place-items-center p-6 text-center lg:col-span-2 2xl:col-span-3">
                <div>
                  <UserRound className="mx-auto h-7 w-7 text-primary/60" />
                  <p className="mt-2 text-sm text-muted-foreground">Aucun contact associé à ce deal. Utilisez « Contact » dans les actions rapides pour associer les personnes clés.</p>
                </div>
              </Card>
            ) : null}
          </div>
        </section>

        <section aria-label="Next steps">
          <SectionTitle
            icon={ArrowUpRight}
            title="Next Steps"
            action={<Button size="sm" onClick={() => setAction("next_step")}><Plus className="mr-1.5 h-4 w-4" /> Ajouter une prochaine action</Button>}
          />
          {detail.nextSteps.length ? (
            <Card className="mt-3 divide-y divide-border">
              {detail.nextSteps.map(step => (
                <div key={step.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 lg:px-5">
                  <span className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                    step.kind === "meeting" ? "bg-sky-400/10 text-sky-400" : step.kind === "task" ? "bg-amber-400/10 text-amber-400" : "bg-primary/10 text-primary",
                  )}>
                    {step.kind === "meeting" ? <CalendarCheck2 className="h-4 w-4" /> : step.kind === "task" ? <ListTodo className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{step.subject}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {step.detail ? <span className="max-w-xl truncate">{step.detail}</span> : null}
                      {step.ownerName ? <span className="flex items-center gap-1"><UserRound className="h-3 w-3" /> {step.ownerName}</span> : null}
                      {step.type ? <Badge variant="outline" className="rounded border-border bg-muted/45 font-medium text-muted-foreground">{step.type}</Badge> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className={cn(
                      "rounded-md font-medium",
                      step.dueAt && new Date(step.dueAt).getTime() < now ? "border-rose-400/25 bg-rose-400/[0.07] text-rose-300"
                        : step.dueAt ? "border-primary/20 bg-primary/[0.07] text-primary" : "border-border bg-muted/45 text-muted-foreground",
                    )}>
                      <Clock3 className="mr-1 h-3 w-3" /> {step.dueAt ? formatRelative(step.dueAt) : "Sans échéance"}
                    </Badge>
                  </div>
                </div>
              ))}
            </Card>
          ) : (
            <Card className="mt-3 grid min-h-40 place-items-center p-6 text-center">
              <div>
                <ArrowUpRight className="mx-auto h-7 w-7 text-primary/60" />
                <p className="mt-2 text-sm font-semibold">Aucune prochaine action définie</p>
                <p className="mt-1 text-sm text-muted-foreground">Définissez immédiatement la prochaine étape pour éviter que le deal refroidisse.</p>
              </div>
            </Card>
          )}
        </section>

        <section aria-label="Meetings">
          <SectionTitle icon={CalendarClock} title="Meetings" />
          <div className="mt-3 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 minari-scrollbar" role="tablist">
            {(meetingTabItems || []).map(group => (
              <button
                key={group.key}
                type="button"
                role="tab"
                aria-selected={meetingGroup === group.key}
                onClick={() => setMeetingGroup(group.key)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  meetingGroup === group.key && "bg-primary/10 text-primary",
                )}
              >
                {group.label}
                {group.items.length ? <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[9px] text-foreground">{group.items.length}</span> : null}
              </button>
            ))}
          </div>
          {currentMeetings.length ? (
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {currentMeetings.map(meeting => <MeetingCard key={meeting.id} meeting={meeting} />)}
            </div>
          ) : (
            <Card className="mt-3 grid min-h-32 place-items-center p-6 text-center">
              <p className="text-sm text-muted-foreground">Aucun rendez-vous dans ce groupe.</p>
            </Card>
          )}
        </section>

        <section aria-label="Timeline">
          <SectionTitle icon={Clock3} title="Timeline commerciale" action={<Button size="sm" variant="outline" onClick={() => setAction("note")}><Plus className="mr-1.5 h-4 w-4" /> Ajouter une note</Button>} />
          <Card className="mt-3 p-4">
            {detail.timeline.length ? (
              <ol className="relative space-y-0 border-l border-border pl-5">
                {detail.timeline.map(item => {
                  const meta = TIMELINE_META[item.kind];
                  const Icon = meta.icon;
                  return (
                    <li key={item.id} className="relative pb-5 last:pb-0">
                      <span className={cn("absolute -left-[26px] grid h-4 w-4 place-items-center rounded-full border-2 border-background", "bg-card")}>
                        <Icon className="h-2.5 w-2.5 text-muted-foreground" />
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn("rounded-md font-medium", meta.badge)}>{meta.label}</Badge>
                        <span className="text-xs font-semibold text-foreground">{item.title}</span>
                        <span className="text-[11px] text-muted-foreground">{formatDateTime(item.at)}</span>
                        {item.actor ? <Badge variant="outline" className="rounded-md border-border bg-muted/45 font-medium text-muted-foreground">{item.actor}</Badge> : null}
                      </div>
                      {item.body ? <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-muted-foreground">{item.body}</p> : null}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="grid min-h-32 place-items-center text-center">
                <p className="text-sm text-muted-foreground">Aucune activité enregistrée sur ce deal.</p>
              </div>
            )}
          </Card>
        </section>

        <section aria-label="Deal Intelligence">
          <SectionTitle icon={Sparkles} title="Deal Intelligence" action={<Badge variant="outline" className="rounded-md border-primary/20 bg-primary/[0.06] px-3 text-primary">Synthèse IA · données HubSpot uniquement</Badge>} />
          <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {detail.intelligence.fields.map(field => (
              <Card key={field.key} className={cn("p-4", field.empty && "border-dashed")}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{field.label}</h3>
                  {field.empty ? <Badge variant="outline" className="rounded border-border bg-muted/45 font-medium text-muted-foreground">Non renseigné</Badge> : null}
                </div>
                {field.values.length ? (
                  <ul className="mt-2 space-y-1.5">
                    {field.values.map((value, index) => (
                      <li key={index} className="text-xs leading-5 text-muted-foreground">• {value}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs italic text-muted-foreground">Aucune information absente des données HubSpot n’est inventée.</p>
                )}
              </Card>
            ))}
          </div>
        </section>

        <section aria-label="Closing plan">
          <SectionTitle icon={FileText} title="Closing Plan" action={<Badge variant="outline" className="rounded-md border-primary/20 bg-primary/[0.06] px-3 font-semibold text-primary">{detail.closingPlan.progressLabel}</Badge>} />
          <Card className="mt-3 p-4">
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${detail.closingPlan.total ? (detail.closingPlan.doneCount / detail.closingPlan.total) * 100 : 0}%` }} />
            </div>
            <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {detail.closingPlan.steps.map(step => {
                const statusMeta = step.status === "done" ? { label: "Terminée", icon: CheckCircle2, badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" as const }
                  : step.status === "in_progress" ? { label: "En cours", icon: Loader2, badge: "border-amber-400/30 bg-amber-400/10 text-amber-300" as const }
                  : { label: "Non démarrée", icon: CircleX, badge: "border-border bg-muted/45 text-muted-foreground" as const };
                return (
                  <li key={step.key} className={cn("flex items-start gap-3 rounded-xl border p-3.5", step.status === "done" ? "border-emerald-400/25 bg-emerald-400/[0.05]" : "border-border bg-card")}>
                    <statusMeta.icon className={cn("mt-0.5 h-4 w-4 shrink-0", step.status === "done" ? "text-emerald-400" : step.status === "in_progress" ? "text-amber-400" : "text-muted-foreground")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold">{step.label}</span>
                        <Badge variant="outline" className={cn("shrink-0 rounded-md font-medium", statusMeta.badge)}>{statusMeta.label}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        {step.targetAt ? <span>Cible : {formatDate(step.targetAt, true)}</span> : null}
                        {step.gandoOwnerName ? <span className="flex items-center gap-1"><UserRound className="h-3 w-3" /> Gando : {step.gandoOwnerName}</span> : null}
                        {step.clientOwner ? <span>Client : {step.clientOwner}</span> : null}
                      </div>
                      {step.relatedTasks.length ? (
                        <div className="mt-1.5 text-[11px] text-muted-foreground">
                          {step.relatedTasks.slice(0, 2).map(task => (
                            <div key={task.id} className="truncate">
                              · <span className="text-foreground">{task.subject}</span> {task.dueAt ? `(${formatRelative(task.dueAt)})` : ""}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {step.notes ? <p className="mt-1 text-[11px] italic text-muted-foreground">{step.notes}</p> : null}
                      <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-xs" onClick={() => setPlanDialog(step)}>Mettre à jour</Button>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-[11px] text-muted-foreground">Statuts issus des tâches HubSpot du deal et de la propriété dr_closing_plan (si elle existe). Les étapes en « En cours » peuvent être avancées depuis ici.</p>
          </Card>
        </section>

        <section aria-label="Blockers">
          <SectionTitle icon={ShieldCheck} title="Blockers" action={<Button size="sm" variant="outline" onClick={() => setAction("blocker")}><Plus className="mr-1.5 h-4 w-4" /> Ajouter un blocker</Button>} />
          <Card className="mt-3 p-4">
            {detail.blockers.length ? (
              <div className="flex flex-wrap gap-2">
                {detail.blockers.map(blocker => (
                  <Badge key={blocker} variant="outline" className={cn("rounded-md font-medium", /Pricing|Juridique|Sécurité|Technique|API|ERP|Budget|Décision/.test(blocker) ? "border-rose-400/30 bg-rose-400/10 text-rose-300" : "border-amber-400/25 bg-amber-400/[0.08] text-amber-300")}>
                    ⛔ {blocker}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun blocage signalé. Les blocages critiques rendent automatiquement le deal plus visible dans la Deal Room.</p>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">Détections automatiques : inactivité, absence de prochaine étape, close date dépassée, absence de décideur, no-show récent.</p>
          </Card>
        </section>

        <section aria-label="Documents">
          <SectionTitle icon={FileText} title="Documents" action={<Badge variant="outline" className="rounded-md border-border bg-muted/45 font-medium text-muted-foreground">aucun stockage parallèle</Badge>} />
          {detail.documents.length ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {detail.documents.map(doc => (
                <Card key={doc.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className={cn("rounded-md font-medium", SCORE_TONE_CLASSES.neutral)}>{doc.kind}</Badge>
                    {doc.at ? <span className="text-[11px] text-muted-foreground">{formatDate(doc.at, true)}</span> : null}
                  </div>
                  <div className="mt-2 truncate text-sm font-semibold">{doc.title}</div>
                  {doc.snippet ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{doc.snippet}</p> : null}
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{doc.source}</div>
                  {doc.url ? (
                    <Button variant="outline" size="sm" className="mt-3" asChild><a href={doc.url} target="_blank" rel="noreferrer">Ouvrir <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button>
                  ) : null}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="mt-3 grid min-h-32 place-items-center p-6 text-center">
              <div>
                <FileText className="mx-auto h-7 w-7 text-primary/60" />
                <p className="mt-2 text-sm text-muted-foreground">Aucun document repéré. Les propositions, contrats et comptes rendus mentionnés dans les notes/appels/tâches du deal apparaissent ici automatiquement.</p>
              </div>
            </Card>
          )}
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
          <span>HubSpot reste la source de vérité : toute action est enregistrée sur l’objet deal.</span>
          {detail.hubspotUrl ? <Button variant="outline" size="sm" asChild><a href={detail.hubspotUrl} target="_blank" rel="noreferrer">Ouvrir le deal dans HubSpot <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button> : null}
        </footer>
      </div>

      <DealActionDialog
        open={Boolean(action)}
        action={action}
        dealId={detail.id}
        dealName={detail.name}
        contacts={detail.contactsForAssociation}
        stageOptions={detail.stageOptions}
        onOpenChange={open => !open && setAction(null)}
        onDone={newMessage => { setMessage(newMessage); void load(true); }}
      />
      <StakeholderRoleDialog
        open={Boolean(roleDialog)}
        contact={roleDialog?.contact || null}
        currentRole={roleDialog?.current || null}
        dealId={detail.id}
        onOpenChange={open => !open && setRoleDialog(null)}
        onDone={newMessage => { setMessage(newMessage); void load(true); }}
      />
      {planDialog ? (
        <ClosingPlanStepDialog
          open={Boolean(planDialog)}
          stepLabel={planDialog.label}
          currentStatus={planDialog.status}
          dealId={detail.id}
          stepKey={planDialog.key}
          onOpenChange={open => !open && setPlanDialog(null)}
          onDone={newMessage => { setMessage(newMessage); void load(true); }}
        />
      ) : null}
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, tone }: { icon: ComponentType<{ className?: string }>; label: string; onClick: () => void; tone: "sky" | "violet" | "amber" | "emerald" | "rose" | "teal" | "primary" }) {
  const tones: Record<string, string> = {
    sky: "hover:bg-sky-400/10 hover:text-sky-300",
    violet: "hover:bg-violet-400/10 hover:text-violet-300",
    amber: "hover:bg-amber-400/10 hover:text-amber-300",
    emerald: "hover:bg-emerald-400/10 hover:text-emerald-300",
    rose: "hover:bg-rose-400/10 hover:text-rose-300",
    teal: "hover:bg-teal-400/10 hover:text-teal-300",
    primary: "hover:bg-primary/10 hover:text-primary",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-muted-foreground transition-colors", tones[tone])}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
