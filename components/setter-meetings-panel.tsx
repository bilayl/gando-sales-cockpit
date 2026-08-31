"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarCheck2,
  CalendarClock,
  Check,
  Clock3,
  History,
  Loader2,
  PhoneCall,
  RefreshCw,
  Search,
  UserX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type QualificationStatus = "qualified" | "not_qualified" | "pending";
type CommercialResult = "qualified" | "follow_up" | "not_qualified" | "no_show";
type MeetingBucket = "to_qualify" | "upcoming" | "history";

type HubSpotObject = { id: string; properties: Record<string, string | null> };
type SetterMeeting = HubSpotObject & {
  associations: {
    contact: HubSpotObject | null;
    company: HubSpotObject | null;
    deal: HubSpotObject | null;
  };
  derived: {
    status: string;
    startAt: string | null;
    endAt: string | null;
    isBrevo: boolean;
    isGandoPresentation: boolean;
  };
  setterTracking: {
    qualificationStatus: QualificationStatus;
    qualificationReason: string;
    commercialOutcome: string | null;
    commercialResult: CommercialResult | null;
    bucket: MeetingBucket;
    nextActionAt: string | null;
    taskTitle: string | null;
    manuallyReviewed: boolean;
    reviewNote: string | null;
    updatedByEmail: string | null;
    updatedAt: string | null;
  };
};

type ApiResponse = {
  results: SetterMeeting[];
  total: number;
  metrics: {
    total: number;
    toQualify: number;
    upcoming: number;
    history: number;
    qualified: number;
    followUp: number;
    notQualified: number;
    noShow: number;
    followUpWithTask: number;
    followUpWithoutTask: number;
    qualificationRate: number;
    bounceRate: number;
    noShowRate: number;
    followUpRate: number;
    avgAttemptsBeforeQualified: number | null;
    avgFollowUpsBeforeQualified: number | null;
    qualifiedWithCallData: number;
  };
  error?: string;
  message?: string;
};

const EMPTY_METRICS: ApiResponse["metrics"] = {
  total: 0,
  toQualify: 0,
  upcoming: 0,
  history: 0,
  qualified: 0,
  followUp: 0,
  notQualified: 0,
  noShow: 0,
  followUpWithTask: 0,
  followUpWithoutTask: 0,
  qualificationRate: 0,
  bounceRate: 0,
  noShowRate: 0,
  followUpRate: 0,
  avgAttemptsBeforeQualified: null,
  avgFollowUpsBeforeQualified: null,
  qualifiedWithCallData: 0,
};

const VIEW_META: Record<MeetingBucket, { label: string; description: string }> = {
  to_qualify: { label: "Actions", description: "Rendez-vous passés à statuer, ou relances sans tâche programmée." },
  upcoming: { label: "À venir", description: "Prochains rendez-vous à préparer." },
  history: { label: "Historique", description: "Rendez-vous déjà traités avec un statut commercial." },
};

const RESULT_META: Record<CommercialResult, { label: string; description: string; icon: typeof Check }> = {
  qualified: { label: "Qualifié", description: "Le rendez-vous ouvre une vraie opportunité.", icon: Check },
  follow_up: { label: "À relancer", description: "Le loueur reste intéressant mais nécessite une nouvelle action.", icon: CalendarClock },
  not_qualified: { label: "Non qualifié", description: "Le rendez-vous ne mérite pas de poursuite commerciale.", icon: UserX },
  no_show: { label: "No show", description: "Le rendez-vous n’a pas eu lieu.", icon: PhoneCall },
};

function formatDate(value?: string | null) {
  if (!value) return "Date inconnue";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "short" }).format(date);
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function tomorrowAtNine() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function personName(object: HubSpotObject | null) {
  if (!object) return "Contact non associé";
  const p = object.properties;
  return [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Contact sans nom";
}

function ResultBadge({ result }: { result: CommercialResult | null }) {
  if (result === "qualified") return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"><Check className="mr-1 h-3 w-3" /> Qualifié</Badge>;
  if (result === "follow_up") return <Badge variant="outline" className="border-primary/25 bg-primary/[0.06] text-primary"><CalendarClock className="mr-1 h-3 w-3" /> À relancer</Badge>;
  if (result === "no_show") return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700"><PhoneCall className="mr-1 h-3 w-3" /> No show</Badge>;
  if (result === "not_qualified") return <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700"><X className="mr-1 h-3 w-3" /> Non qualifié</Badge>;
  return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700"><Clock3 className="mr-1 h-3 w-3" /> Action requise</Badge>;
}

function ViewButton({ label, value, active, icon: Icon, onClick }: {
  label: string;
  value: number;
  active: boolean;
  icon: typeof Clock3;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-[145px] items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition",
        active ? "border-primary/30 bg-primary/[0.06] text-primary" : "border-border bg-card hover:bg-muted/40",
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4" />{label}</span>
      <span className={cn("rounded-md bg-muted px-2 py-0.5 text-xs font-bold", active && "bg-primary/10")}>{value}</span>
    </button>
  );
}

function PerformanceStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-[-0.03em]">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function StatusStat({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
      <span className="text-sm font-semibold">{label}</span>
      <Badge variant="secondary">{value}</Badge>
      {detail ? <span className="text-[11px] text-muted-foreground">{detail}</span> : null}
    </div>
  );
}

export function SetterMeetingsPanel() {
  const [meetings, setMeetings] = useState<SetterMeeting[]>([]);
  const [metrics, setMetrics] = useState<ApiResponse["metrics"]>(EMPTY_METRICS);
  const [view, setView] = useState<MeetingBucket>("to_qualify");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [actionMeeting, setActionMeeting] = useState<SetterMeeting | null>(null);
  const [selectedResult, setSelectedResult] = useState<CommercialResult | "">("");
  const [actionNote, setActionNote] = useState("");
  const [createTask, setCreateTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState(tomorrowAtNine);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/meetings/setter", { cache: "no-store" });
      const data = await response.json() as ApiResponse;
      if (!response.ok) throw new Error(data.message || data.error || "Impossible de charger les rendez-vous setter");
      setMeetings(data.results || []);
      setMetrics(data.metrics || EMPTY_METRICS);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return meetings.filter(meeting => {
      if (meeting.setterTracking.bucket !== view) return false;
      if (!needle) return true;
      const contact = meeting.associations.contact?.properties;
      const company = meeting.associations.company?.properties;
      return [meeting.properties.hs_meeting_title, contact?.firstname, contact?.lastname, contact?.email, company?.name, company?.domain]
        .filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [meetings, query, view]);

  function openAction(meeting: SetterMeeting) {
    setActionMeeting(meeting);
    setSelectedResult(meeting.setterTracking.commercialResult || "");
    setActionNote(meeting.setterTracking.reviewNote || "");
    setCreateTask(false);
    setTaskTitle("");
    setTaskDueAt(tomorrowAtNine());
  }

  function closeAction() {
    if (savingId) return;
    setActionMeeting(null);
    setSelectedResult("");
    setActionNote("");
    setCreateTask(false);
    setTaskTitle("");
    setTaskDueAt(tomorrowAtNine());
  }

  function chooseResult(result: CommercialResult) {
    setSelectedResult(result);
    if (!taskTitle) {
      setTaskTitle(result === "qualified" ? "Prochaine action après RDV qualifié" : "Relancer après le rendez-vous");
    }
  }

  async function saveAction() {
    if (!actionMeeting || !selectedResult) return;
    setSavingId(actionMeeting.id);
    try {
      const response = await fetch("/api/meetings/setter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          meetingId: actionMeeting.id,
          commercialResult: selectedResult,
          reviewNote: actionNote,
          createTask,
          taskTitle: createTask ? taskTitle : null,
          taskDueAt: createTask ? taskDueAt : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Modification impossible");

      const label = RESULT_META[selectedResult].label;
      toast.success(createTask
        ? `${label} enregistré — tâche créée pour le ${formatDateTime(data.nextActionAt || taskDueAt)}.`
        : `${label} enregistré — aucune tâche créée.`);
      setActionMeeting(null);
      setSelectedResult("");
      setActionNote("");
      setCreateTask(false);
      setTaskTitle("");
      setTaskDueAt(tomorrowAtNine());
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Modification impossible");
    } finally {
      setSavingId(null);
    }
  }

  const meta = VIEW_META[view];
  const followUpDataLabel = metrics.qualifiedWithCallData
    ? `sur ${metrics.qualifiedWithCallData} RDV qualifié${metrics.qualifiedWithCallData > 1 ? "s" : ""} tracé${metrics.qualifiedWithCallData > 1 ? "s" : ""}`
    : "en attente de données d’appels";

  return (
    <section className="px-5 pb-6 pt-4 lg:px-7">
      <Card className="mx-auto max-w-[1500px] overflow-hidden">
        <div className="border-b border-border px-5 py-5 lg:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-primary"><CalendarCheck2 className="h-4 w-4" /> Pilotage rendez-vous</div>
              <h1 className="mt-2 text-xl font-bold tracking-[-0.025em]">Rendez-vous setter</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Chaque rendez-vous reçoit un statut commercial. Une tâche peut être ajoutée si elle est utile, mais elle n’est jamais obligatoire.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Actualiser
            </Button>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <PerformanceStat label="Taux de qualification" value={`${metrics.qualificationRate}%`} detail={`${metrics.qualified} RDV qualifié${metrics.qualified > 1 ? "s" : ""}`} />
            <PerformanceStat label="Taux de rebond" value={`${metrics.bounceRate}%`} detail="RDV nécessitant relance ou no-show" />
            <PerformanceStat
              label="Relances avant qualification"
              value={metrics.avgFollowUpsBeforeQualified === null ? "—" : String(metrics.avgFollowUpsBeforeQualified)}
              detail={followUpDataLabel}
            />
            <PerformanceStat label="Taux de no-show" value={`${metrics.noShowRate}%`} detail={`${metrics.noShow} no-show${metrics.noShow > 1 ? "s" : ""}`} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2 rounded-xl border border-border bg-muted/20 p-2.5">
            <StatusStat label="Qualifié" value={metrics.qualified} />
            <StatusStat label="À relancer" value={metrics.followUp} detail={metrics.followUpWithoutTask ? `${metrics.followUpWithoutTask} sans tâche` : undefined} />
            <StatusStat label="Non qualifié" value={metrics.notQualified} />
            <StatusStat label="No show" value={metrics.noShow} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <ViewButton label="Actions" value={metrics.toQualify} active={view === "to_qualify"} icon={Clock3} onClick={() => setView("to_qualify")} />
            <ViewButton label="À venir" value={metrics.upcoming} active={view === "upcoming"} icon={CalendarCheck2} onClick={() => setView("upcoming")} />
            <ViewButton label="Historique" value={metrics.history} active={view === "history"} icon={History} onClick={() => setView("history")} />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-border bg-muted/20 px-5 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <div>
            <div className="text-sm font-semibold">{meta.label}</div>
            <div className="text-xs text-muted-foreground">{meta.description}</div>
          </div>
          <div className="relative w-full sm:w-80"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Contact, société ou rendez-vous" className="h-9 pl-9" /></div>
        </div>

        {error ? <div className="m-4 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}

        {loading ? (
          <div className="grid min-h-64 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : visible.length ? (
          <div className="divide-y divide-border">
            {visible.map(meeting => {
              const contact = meeting.associations.contact;
              const company = meeting.associations.company;
              const companyName = company?.properties.name || contact?.properties.company || "Société non associée";
              const busy = savingId === meeting.id;
              return (
                <article key={meeting.id} className={cn("grid gap-4 px-5 py-4 transition-colors hover:bg-muted/15 lg:grid-cols-[130px_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center lg:px-6", view === "to_qualify" && "bg-amber-50/20")}>
                  <div>
                    <div className="text-sm font-bold">{formatDate(meeting.derived.startAt)}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{formatTime(meeting.derived.startAt)}</div>
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{companyName}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{personName(contact)}{contact?.properties.email ? ` · ${contact.properties.email}` : ""}</div>
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{meeting.properties.hs_meeting_title || "Rendez-vous"}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <ResultBadge result={meeting.setterTracking.commercialResult} />
                      {meeting.setterTracking.nextActionAt ? <span className="text-xs font-medium text-primary">Tâche : {formatDateTime(meeting.setterTracking.nextActionAt)}</span> : null}
                      {meeting.setterTracking.commercialResult === "follow_up" && !meeting.setterTracking.nextActionAt ? <span className="text-xs font-medium text-amber-700">Aucune tâche programmée</span> : null}
                    </div>
                    {meeting.setterTracking.reviewNote ? <div className="mt-1 truncate text-xs text-muted-foreground">{meeting.setterTracking.reviewNote}</div> : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-start gap-1.5 lg:justify-end">
                    {view === "upcoming" ? (
                      company ? <Button asChild size="sm" variant="outline"><a href={`/companies/${company.id}`}>Préparer <ArrowUpRight className="h-3.5 w-3.5" /></a></Button>
                        : contact ? <Button asChild size="sm" variant="outline"><a href={`/contacts/${contact.id}`}>Préparer <ArrowUpRight className="h-3.5 w-3.5" /></a></Button>
                          : <Badge variant="outline">À préparer</Badge>
                    ) : (
                      <Button size="sm" variant={view === "to_qualify" ? "default" : "outline"} disabled={busy} onClick={() => openAction(meeting)}>
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />} Action
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center px-6 text-center">
            <div>
              {view === "to_qualify" ? <Check className="mx-auto h-8 w-8 text-emerald-600" /> : <CalendarCheck2 className="mx-auto h-8 w-8 text-primary/60" />}
              <div className="mt-3 font-semibold">{view === "to_qualify" ? "Aucune action à traiter" : "Aucun rendez-vous ici"}</div>
              <div className="mt-1 text-sm text-muted-foreground">{view === "to_qualify" ? "Tous les rendez-vous passés ont un statut ou une tâche de relance." : "Change de vue ou de recherche."}</div>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={Boolean(actionMeeting)} onOpenChange={open => !open && closeAction()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Action rendez-vous</DialogTitle>
            <DialogDescription>Choisis le statut commercial. La création d’une tâche est facultative.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">
            <div className="space-y-2">
              <Label>Statut</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.entries(RESULT_META) as Array<[CommercialResult, (typeof RESULT_META)[CommercialResult]]>).map(([result, item]) => {
                  const Icon = item.icon;
                  const active = selectedResult === result;
                  return (
                    <button
                      key={result}
                      type="button"
                      onClick={() => chooseResult(result)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition",
                        active ? "border-primary bg-primary/[0.06] ring-1 ring-primary/20" : "border-border hover:bg-muted/30",
                      )}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4" />{item.label}</div>
                      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Note <span className="font-normal text-muted-foreground">(facultatif)</span></Label>
              <Input value={actionNote} onChange={event => setActionNote(event.target.value)} placeholder="Ex. budget validé, décisionnaire absent, à revoir en octobre…" />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/20 p-3">
              <input
                type="checkbox"
                checked={createTask}
                onChange={event => setCreateTask(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span>
                <span className="block text-sm font-semibold">Créer une tâche de suivi</span>
                <span className="block text-xs text-muted-foreground">Optionnel. À utiliser uniquement lorsqu’une prochaine action doit être planifiée.</span>
              </span>
            </label>

            {createTask ? (
              <div className="grid gap-3 rounded-xl border border-primary/15 bg-primary/[0.03] p-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Tâche</Label>
                  <Input value={taskTitle} onChange={event => setTaskTitle(event.target.value)} placeholder="Ex. rappeler le directeur, envoyer l’offre…" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Date et heure</Label>
                  <Input type="datetime-local" value={taskDueAt} onChange={event => setTaskDueAt(event.target.value)} />
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeAction} disabled={Boolean(savingId)}>Annuler</Button>
            <Button
              disabled={!actionMeeting || !selectedResult || Boolean(savingId) || (createTask && (!taskTitle.trim() || !taskDueAt))}
              onClick={() => void saveAction()}
            >
              {savingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Enregistrer l’action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
