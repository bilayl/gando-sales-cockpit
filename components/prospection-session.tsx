"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Building2,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  FileText,
  Globe,
  History,
  ListTodo,
  Loader2,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  PhoneOff,
  SkipForward,
  ThumbsDown,
  UserRound,
  Users,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { COMPANY_PIPELINE, deriveCompanyStage, type CompanyStage } from "@/components/company-prospection-board";
import { QualificationProperties } from "@/components/qualification-properties";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { compareCompanyProspectionPriority, getCompanyProspectionDecision } from "@/lib/company-prospection-priority";

type Company = { id: string; properties: Record<string, string | null | undefined> };

type TaskSummary = {
  openTaskCount: number;
  overdueTaskCount: number;
  todayTaskCount: number;
  nextTask: {
    id: string;
    subject: string;
    status: string;
    priority?: string | null;
    type?: string | null;
    dueAt?: string | null;
    sourceContactId?: string | null;
    sourceContactName?: string | null;
    sourceContactPhone?: string | null;
    sourceContactJobTitle?: string | null;
  } | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
  onOpenCompany: (companyId: string) => void;
};

type CallOutcome = "MEETING" | "FOLLOW_UP" | "NO_ANSWER" | "NOT_INTERESTED" | "WRONG_CONTACT";

const STAGE_LABELS = Object.fromEntries(COMPANY_PIPELINE.map(column => [column.value, column.label])) as Record<CompanyStage, string>;

const OUTCOMES: Array<{
  value: CallOutcome;
  label: string;
  description: string;
  icon: typeof Phone;
}> = [
  { value: "MEETING", label: "RDV pris", description: "Sort de la file setter", icon: CalendarCheck2 },
  { value: "FOLLOW_UP", label: "À rappeler", description: "Revient à la date choisie", icon: CalendarClock },
  { value: "NO_ANSWER", label: "Pas de réponse", description: "Relance auto programmée", icon: PhoneOff },
  { value: "NOT_INTERESTED", label: "Pas intéressé", description: "Sort de la prospection active", icon: ThumbsDown },
  { value: "WRONG_CONTACT", label: "Mauvais contact", description: "À enrichir / autre interlocuteur", icon: UserX },
];

function taskRank(summary?: TaskSummary) {
  if (!summary) return 4;
  if (summary.overdueTaskCount > 0) return 0;
  if (summary.todayTaskCount > 0) return 1;
  if (summary.openTaskCount > 0) return 2;
  return 3;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Pas d’échéance";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pas d’échéance";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function reminderPreset(days: number, hour = 9) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return toLocalInputValue(date);
}

function inTwoHours() {
  const date = new Date(Date.now() + 2 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return toLocalInputValue(date);
}

function taskLabel(summary?: TaskSummary) {
  if (!summary || !summary.openTaskCount) return "Aucune tâche ouverte";
  if (summary.overdueTaskCount) return `${summary.overdueTaskCount} tâche${summary.overdueTaskCount > 1 ? "s" : ""} en retard`;
  if (summary.todayTaskCount) return `${summary.todayTaskCount} tâche${summary.todayTaskCount > 1 ? "s" : ""} aujourd’hui`;
  return `${summary.openTaskCount} tâche${summary.openTaskCount > 1 ? "s" : ""} ouverte${summary.openTaskCount > 1 ? "s" : ""}`;
}

function plainText(value?: string | null) {
  return value?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "";
}

function activityDate(item: any) {
  if (item.type === "meeting") return item.record?.derived?.startAt || item.record?.properties?.hs_timestamp;
  return item.record?.properties?.hs_timestamp || item.record?.properties?.hs_createdate;
}

function activityTitle(item: any) {
  const p = item.record?.properties || {};
  if (item.type === "meeting") return p.hs_meeting_title || "Rendez-vous";
  if (item.type === "call") return p.hs_call_title || "Appel";
  if (item.type === "task") return p.hs_task_subject || "Tâche";
  return "Note HubSpot";
}

function activityBody(item: any) {
  const p = item.record?.properties || {};
  if (item.type === "meeting") return p.hs_internal_meeting_notes || p.hs_meeting_location;
  if (item.type === "call") return p.hs_call_body;
  if (item.type === "task") return p.hs_task_body;
  return p.hs_note_body;
}

function ActivityIcon({ type }: { type: string }) {
  if (type === "meeting") return <CalendarClock size={13} />;
  if (type === "call") return <PhoneCall size={13} />;
  if (type === "task") return <ListTodo size={13} />;
  return <FileText size={13} />;
}

function CompanyProfilePanel({
  companyId,
  fallbackCompany,
  onOpenCompany,
}: {
  companyId: string;
  fallbackCompany: Company;
  onOpenCompany: (companyId: string) => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setLoading(true);
    setError("");
    fetch(`/api/companies/${companyId}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Impossible de charger la fiche entreprise");
        setData(body);
      })
      .catch(reason => {
        if ((reason as Error).name !== "AbortError") setError(reason instanceof Error ? reason.message : "Impossible de charger la fiche entreprise");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [companyId]);

  const p = data?.company?.properties || fallbackCompany.properties;
  const contacts = data?.contacts || [];
  const referenceContact = contacts[0]?.properties || {};
  const nextMeeting = data?.nextMeeting || null;

  const timeline = useMemo(() => {
    if (!data) return [];
    const items = [
      ...(data.meetings || []).map((record: any) => ({ type: "meeting", record })),
      ...(data.notes || []).map((record: any) => ({ type: "note", record })),
      ...(data.calls || []).map((record: any) => ({ type: "call", record })),
      ...(data.tasks || []).map((record: any) => ({ type: "task", record })),
    ];
    return items.sort((a, b) => new Date(activityDate(b) || 0).getTime() - new Date(activityDate(a) || 0).getTime());
  }, [data]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Fiche entreprise</div>
          <h2 className="mt-1 truncate text-lg font-bold tracking-tight">{p.name || p.domain || "Entreprise"}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {p.domain ? <span className="inline-flex items-center gap-1"><Globe size={12} />{p.domain}</span> : null}
            {[p.city, p.country].filter(Boolean).length ? <span className="inline-flex items-center gap-1"><MapPin size={12} />{[p.city, p.country].filter(Boolean).join(", ")}</span> : null}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => onOpenCompany(companyId)}><ExternalLink size={14} /> Fiche complète</Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5 minari-scrollbar">
        {loading ? (
          <div className="grid h-64 place-items-center"><Loader2 className="animate-spin text-primary" /></div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3"><div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground"><Phone size={11} /> Téléphone</div><div className="mt-1 truncate text-sm font-semibold">{p.phone || "—"}</div></div>
              <div className="rounded-lg border border-border bg-muted/30 p-3"><div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground"><Briefcase size={11} /> Secteur</div><div className="mt-1 truncate text-sm font-semibold">{p.industry || "—"}</div></div>
              <div className="rounded-lg border border-border bg-muted/30 p-3"><div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground"><Users size={11} /> Contacts</div><div className="mt-1 text-sm font-semibold">{contacts.length}</div></div>
              <div className="rounded-lg border border-border bg-muted/30 p-3"><div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground"><History size={11} /> Activités</div><div className="mt-1 text-sm font-semibold">{data?.activitySummary?.total ?? timeline.length}</div></div>
            </div>

            <div className="flex gap-2">
              {p.phone ? <Button asChild size="sm"><a href={`tel:${p.phone}`}><Phone size={14} /> Appeler l’entreprise</a></Button> : null}
              {p.domain ? <Button asChild size="sm" variant="outline"><a href={`https://${p.domain}`} target="_blank" rel="noreferrer"><Globe size={14} /> Site web</a></Button> : null}
            </div>

            {nextMeeting ? (
              <section>
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Prochain rendez-vous</div>
                <div className="mt-2 rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
                  <div className="font-semibold">{nextMeeting.properties?.hs_meeting_title || "Rendez-vous"}</div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><CalendarClock size={12} />{formatDateTime(nextMeeting.derived?.startAt)}</span>
                    {nextMeeting.sourceContactName ? <span className="inline-flex items-center gap-1"><UserRound size={12} />{nextMeeting.sourceContactName}</span> : null}
                  </div>
                </div>
              </section>
            ) : null}

            <QualificationProperties kind="company" properties={p} fallbackProperties={referenceContact} />

            <section>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Contacts associés</div>
                <Badge variant="secondary">{contacts.length}</Badge>
              </div>
              <div className="mt-2 grid gap-2 xl:grid-cols-2">
                {contacts.map((contact: any) => {
                  const cp = contact.properties || {};
                  const name = [cp.firstname, cp.lastname].filter(Boolean).join(" ") || cp.email || "Contact";
                  const phone = cp.phone || cp.mobilephone;
                  return (
                    <div key={contact.id} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{name}</div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">{cp.jobtitle || cp.statut_prospection || "Contact HubSpot"}</div>
                        </div>
                        {cp.statut_prospection ? <Badge variant="outline" className="shrink-0 text-[10px]">{cp.statut_prospection}</Badge> : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {phone ? <a href={`tel:${phone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone size={11} />{phone}</a> : null}
                        {cp.email ? <a href={`mailto:${cp.email}`} className="inline-flex min-w-0 items-center gap-1 text-primary hover:underline"><Mail size={11} /><span className="truncate">{cp.email}</span></a> : null}
                      </div>
                    </div>
                  );
                })}
                {!contacts.length ? <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground xl:col-span-2">Aucun contact associé à cette entreprise dans HubSpot.</div> : null}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Historique centralisé HubSpot</div>
                <Badge variant="secondary">{timeline.length}</Badge>
              </div>
              <div className="mt-2 space-y-2">
                {timeline.slice(0, 12).map((item: any) => {
                  const date = activityDate(item);
                  const body = plainText(activityBody(item));
                  return (
                    <div key={`${item.type}-${item.record.id}`} className="flex gap-3 rounded-lg border border-border bg-card p-3">
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/[0.08] text-primary"><ActivityIcon type={item.type} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="truncate text-sm font-semibold">{activityTitle(item)}</div>
                          <div className="shrink-0 text-[10px] text-muted-foreground">{date ? formatDateTime(date) : "—"}</div>
                        </div>
                        {item.record?.sourceContactName ? <div className="mt-0.5 text-[10px] text-muted-foreground">Via {item.record.sourceContactName}</div> : null}
                        {body ? <div className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">{body}</div> : null}
                      </div>
                    </div>
                  );
                })}
                {!timeline.length ? <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Aucune activité HubSpot enregistrée pour ce compte.</div> : null}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProspectionSession({ open, onOpenChange, companies, onOpenCompany }: Props) {
  const [summaries, setSummaries] = useState<Record<string, TaskSummary>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [finishOpen, setFinishOpen] = useState(false);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [reminderAt, setReminderAt] = useState(reminderPreset(1));
  const [note, setNote] = useState("");
  const [savingOutcome, setSavingOutcome] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    setDone(new Set());
    setError("");
    setFinishOpen(false);
    setOutcome(null);
    const now = Date.now();
    const activeIds = companies
      .filter(company => {
        const stage = deriveCompanyStage(company, now);
        return getCompanyProspectionDecision(company, stage, now).bucket === "ACTIONABLE";
      })
      .map(company => company.id)
      .slice(0, 100);
    if (!activeIds.length) {
      setSummaries({});
      return;
    }

    setLoading(true);
    fetch("/api/prospection/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ companyIds: activeIds }),
      cache: "no-store",
    })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Impossible de préparer la session");
        setSummaries(body.summaries || {});
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Impossible de préparer la session"))
      .finally(() => setLoading(false));
  }, [open, companies]);

  const queue = useMemo(() => {
    const now = Date.now();
    return companies
      .map(company => {
        const stage = deriveCompanyStage(company, now);
        return { company, stage, summary: summaries[company.id], decision: getCompanyProspectionDecision(company, stage, now) };
      })
      .filter(item => item.decision.bucket === "ACTIONABLE")
      .sort((a, b) => {
        const tasks = taskRank(a.summary) - taskRank(b.summary);
        if (tasks !== 0) return tasks;
        const priority = compareCompanyProspectionPriority(a, b, now);
        if (priority !== 0) return priority;
        const aDue = a.summary?.nextTask?.dueAt ? Date.parse(a.summary.nextTask.dueAt) : Number.MAX_SAFE_INTEGER;
        const bDue = b.summary?.nextTask?.dueAt ? Date.parse(b.summary.nextTask.dueAt) : Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      });
  }, [companies, summaries]);

  const remaining = queue.filter(item => !done.has(item.company.id));
  const current = remaining[Math.min(index, Math.max(remaining.length - 1, 0))] || null;

  function advanceAfterOutcome() {
    if (!current) return;
    setDone(previous => new Set(previous).add(current.company.id));
    setIndex(0);
    setOutcome(null);
    setNote("");
    setReminderAt(reminderPreset(1));
  }

  function skip() {
    if (!remaining.length) return;
    setIndex(previous => (previous + 1) % remaining.length);
  }

  function previous() {
    if (!remaining.length) return;
    setIndex(previous => (previous - 1 + remaining.length) % remaining.length);
  }

  function openFinish() {
    setOutcome(null);
    setNote("");
    setReminderAt(reminderPreset(1));
    setFinishOpen(true);
  }

  function chooseOutcome(value: CallOutcome) {
    setOutcome(value);
    if (value === "NO_ANSWER") {
      setReminderAt(reminderPreset(1));
      setNote("Pas de réponse");
    } else if (value === "WRONG_CONTACT") {
      setReminderAt(reminderPreset(1, 10));
      setNote("Mauvais contact — rechercher un autre interlocuteur");
    } else if (value === "NOT_INTERESTED") {
      setNote("Pas intéressé");
    } else {
      setNote("");
    }
  }

  async function saveOutcome() {
    if (!current || !outcome || savingOutcome) return;

    let action = "CONNECTED";
    let nextReminder: string | null = null;
    let reason = note.trim();

    if (outcome === "MEETING") {
      action = "DEMO_SCHEDULED";
      reason ||= "RDV pris depuis la session d’appels";
    }
    if (outcome === "FOLLOW_UP") {
      action = "FOLLOW_UP";
      nextReminder = reminderAt;
      reason ||= "À rappeler";
    }
    if (outcome === "NO_ANSWER") {
      action = "ATTEMPTED_TO_CONTACT";
      nextReminder = reminderAt || reminderPreset(1);
      reason ||= "Pas de réponse";
    }
    if (outcome === "NOT_INTERESTED") {
      action = "NOT_INTERESTED";
      reason ||= "Pas intéressé";
    }
    if (outcome === "WRONG_CONTACT") {
      action = "FOLLOW_UP";
      nextReminder = reminderAt || reminderPreset(1, 10);
      reason ||= "Mauvais contact — rechercher un autre interlocuteur";
    }

    if (nextReminder) {
      const parsed = new Date(nextReminder);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        toast.error("Choisis une date de relance dans le futur.");
        return;
      }
      nextReminder = parsed.toISOString();
    }

    setSavingOutcome(true);
    try {
      const response = await fetch(`/api/companies/${current.company.id}/workflow`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reminderAt: nextReminder, reason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Impossible d’enregistrer le résultat de l’appel");

      const message = outcome === "MEETING"
        ? "RDV enregistré — compte sorti de la file setter."
        : outcome === "NOT_INTERESTED"
          ? "Prospect clôturé — retiré de la prospection active."
          : nextReminder
            ? `Relance programmée le ${formatDateTime(nextReminder)}.`
            : "Résultat d’appel enregistré.";
      toast.success(message);
      setFinishOpen(false);
      advanceAfterOutcome();
    } catch (reasonValue) {
      toast.error(reasonValue instanceof Error ? reasonValue.message : "Impossible d’enregistrer le résultat de l’appel");
    } finally {
      setSavingOutcome(false);
    }
  }

  const p = current?.company.properties || {};
  const task = current?.summary?.nextTask || null;
  const currentReminder = p.qualification_next_action_at || p.date_de_rappel || p.notes_next_activity_date;
  const needsReminder = outcome === "FOLLOW_UP" || outcome === "NO_ANSWER" || outcome === "WRONG_CONTACT";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="h-[92vh] w-[96vw] max-w-[1500px] overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-6 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <DialogTitle>Session d’appels setter</DialogTitle>
                <DialogDescription className="mt-1">
                  Appelle, qualifie le résultat, puis passe automatiquement au compte suivant. Une action ou une sortie pour chaque appel.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{done.size} traité{done.size > 1 ? "s" : ""}</Badge>
                <Badge variant="secondary">{remaining.length} restant{remaining.length > 1 ? "s" : ""}</Badge>
              </div>
            </div>
          </DialogHeader>

          {loading ? (
            <div className="grid min-h-0 flex-1 place-items-center px-6 py-10 text-center">
              <div><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Préparation de la file d’appels et lecture des tâches HubSpot…</p></div>
            </div>
          ) : error ? (
            <div className="m-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
          ) : !current ? (
            <div className="grid min-h-0 flex-1 place-items-center px-6 py-10 text-center">
              <div>
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><CheckCircle2 /></span>
                <h3 className="mt-4 text-lg font-semibold">Session terminée</h3>
                <p className="mt-1 text-sm text-muted-foreground">Tous les comptes actionnables de cette file ont été traités.</p>
              </div>
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[380px_minmax(0,1fr)]">
              <aside className="min-h-0 overflow-y-auto border-b border-border bg-card p-5 xl:border-b-0 xl:border-r minari-scrollbar">
                <div className="space-y-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-primary"><Building2 /></span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-bold tracking-tight">{p.name || p.domain || "Entreprise sans nom"}</h2>
                        <Badge variant="secondary">{current.decision.priorityLabel}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{[p.city, p.country, p.domain].filter(Boolean).join(" · ") || "Aucune localisation"}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">À faire maintenant</div>
                    <div className="mt-1 text-sm font-semibold">{current.decision.reason}</div>
                    <div className="mt-2 text-xs text-muted-foreground">{taskLabel(current.summary)}</div>
                  </div>

                  {task ? (
                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-primary"><ListTodo size={16} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold">{task.subject}</div>
                          <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                            <div className="inline-flex items-center gap-1"><CalendarClock size={12} /> {formatDateTime(task.dueAt)}</div>
                            {task.sourceContactName ? <div>{task.sourceContactName}{task.sourceContactJobTitle ? ` · ${task.sourceContactJobTitle}` : ""}</div> : <div>Tâche entreprise</div>}
                            {task.sourceContactPhone ? <a href={`tel:${task.sourceContactPhone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone size={12} /> {task.sourceContactPhone}</a> : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-border p-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Dernier résultat</div>
                      <div className="mt-1 truncate text-sm font-semibold">{p.statut_de_lappel || STAGE_LABELS[current.stage]}</div>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Échéance</div>
                      <div className="mt-1 truncate text-sm font-semibold">{formatDateTime(currentReminder)}</div>
                    </div>
                  </div>

                  {p.phone ? (
                    <Button asChild className="w-full" size="lg">
                      <a href={`tel:${p.phone}`}><PhoneCall size={17} /> Appeler maintenant</a>
                    </Button>
                  ) : (
                    <Button className="w-full" size="lg" variant="outline" onClick={() => onOpenCompany(current.company.id)}>
                      <UserX size={17} /> Trouver un numéro
                    </Button>
                  )}

                  <div className="space-y-2 border-t border-border pt-4">
                    <Button className="w-full" size="lg" onClick={openFinish}>
                      <CheckCircle2 size={17} /> Terminer l’appel
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={previous} disabled={remaining.length <= 1}><ChevronLeft size={15} /> Précédent</Button>
                      <Button variant="outline" size="sm" onClick={skip} disabled={remaining.length <= 1}><SkipForward size={15} /> Passer pour l’instant</Button>
                    </div>
                    <p className="text-center text-[10px] leading-4 text-muted-foreground">“Passer” ne modifie aucun statut et ne crée aucune relance.</p>
                  </div>
                </div>
              </aside>

              <CompanyProfilePanel companyId={current.company.id} fallbackCompany={current.company} onOpenCompany={onOpenCompany} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={finishOpen} onOpenChange={next => !savingOutcome && setFinishOpen(next)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comment s’est terminé l’appel ?</DialogTitle>
            <DialogDescription>Le choix ci-dessous pilote automatiquement la prochaine action et la file d’appels.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 sm:grid-cols-2">
            {OUTCOMES.map(item => {
              const Icon = item.icon;
              const active = outcome === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => chooseOutcome(item.value)}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${active ? "border-primary bg-primary/[0.06] ring-1 ring-primary/20" : "border-border bg-card hover:bg-muted/50"}`}
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}><Icon size={17} /></span>
                  <span>
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {needsReminder ? (
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Prochaine relance</div>
                  <div className="text-xs text-muted-foreground">Le compte disparaît de la file jusqu’à cette échéance.</div>
                </div>
                {outcome === "NO_ANSWER" ? <Badge variant="secondary">Auto : demain 09:00</Badge> : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setReminderAt(inTwoHours())}>+2 h</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setReminderAt(reminderPreset(1))}>Demain 09:00</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setReminderAt(reminderPreset(3))}>J+3 09:00</Button>
                <Input className="min-w-[210px] flex-1" type="datetime-local" value={reminderAt} onChange={event => setReminderAt(event.target.value)} />
              </div>
            </div>
          ) : null}

          {outcome ? (
            <div>
              <div className="mb-1.5 text-sm font-semibold">Note rapide <span className="font-normal text-muted-foreground">(facultatif)</span></div>
              <Input value={note} onChange={event => setNote(event.target.value)} placeholder="Ex. rappeler le directeur, besoin d’intégration, budget à confirmer…" />
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setFinishOpen(false)} disabled={savingOutcome}>Annuler</Button>
            <Button onClick={() => void saveOutcome()} disabled={!outcome || savingOutcome || (needsReminder && !reminderAt)}>
              {savingOutcome ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Enregistrer et compte suivant
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
