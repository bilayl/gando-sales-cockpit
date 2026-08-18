"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
  SkipForward,
  UserRound,
  Users,
} from "lucide-react";
import { COMPANY_PIPELINE, deriveCompanyStage, type CompanyStage } from "@/components/company-prospection-board";
import { QualificationProperties } from "@/components/qualification-properties";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const STAGE_LABELS = Object.fromEntries(COMPANY_PIPELINE.map(column => [column.value, column.label])) as Record<CompanyStage, string>;

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
    <div className="flex min-h-0 h-full flex-col bg-background">
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
                {timeline.slice(0, 20).map((item: any) => {
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

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    setDone(new Set());
    setError("");
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

  function markDone() {
    if (!current) return;
    setDone(previous => new Set(previous).add(current.company.id));
    setIndex(0);
  }

  function skip() {
    if (!remaining.length) return;
    setIndex(previous => (previous + 1) % remaining.length);
  }

  function previous() {
    if (!remaining.length) return;
    setIndex(previous => (previous - 1 + remaining.length) % remaining.length);
  }

  const p = current?.company.properties || {};
  const task = current?.summary?.nextTask || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[92vh] w-[96vw] max-w-[1500px] overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <DialogTitle>Session de prospection priorisée</DialogTitle>
              <DialogDescription className="mt-1">
                {queue.length} comptes actionnables uniquement · tâches en retard/du jour d’abord · puis relances et statut commercial.
              </DialogDescription>
            </div>
            <Badge variant="secondary">{remaining.length} restant{remaining.length > 1 ? "s" : ""}</Badge>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="grid min-h-0 flex-1 place-items-center px-6 py-10 text-center">
            <div><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Préparation de la session et lecture des tâches HubSpot…</p></div>
          </div>
        ) : error ? (
          <div className="m-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
        ) : !current ? (
          <div className="grid min-h-0 flex-1 place-items-center px-6 py-10 text-center">
            <div>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><CheckCircle2 /></span>
              <h3 className="mt-4 text-lg font-semibold">Session terminée</h3>
              <p className="mt-1 text-sm text-muted-foreground">Tous les comptes actionnables correspondant aux filtres ont été parcourus.</p>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[380px_minmax(0,1fr)]">
            <aside className="min-h-0 overflow-y-auto border-b border-border bg-card p-5 xl:border-b-0 xl:border-r minari-scrollbar">
              <div className="space-y-5">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-primary"><Building2 /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-bold tracking-tight">{p.name || p.domain || "Entreprise sans nom"}</h2>
                      <Badge variant="secondary">{current.decision.priorityLabel}</Badge>
                      <Badge variant="outline">{STAGE_LABELS[current.stage]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{[p.city, p.country, p.domain].filter(Boolean).join(" · ") || "Aucune localisation"}</p>
                    <p className="mt-1 text-xs font-medium text-primary">{current.decision.reason}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Priorité tâche</div>
                  <div className="mt-0.5 text-sm font-semibold">{taskLabel(current.summary)}</div>
                </div>

                {task ? (
                  <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background text-primary"><ListTodo size={16} /></span>
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
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground">Aucune tâche ouverte : priorité calculée à partir du statut de prospection et du rappel.</div>
                )}

                <div className="grid gap-2">
                  <div className="rounded-lg border border-border p-3"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Statut</div><div className="mt-1 text-sm font-semibold">{STAGE_LABELS[current.stage]}</div></div>
                  <div className="rounded-lg border border-border p-3"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Dernier appel</div><div className="mt-1 text-sm font-semibold">{p.statut_de_lappel || "—"}</div></div>
                  <div className="rounded-lg border border-border p-3"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Rappel</div><div className="mt-1 text-sm font-semibold">{formatDateTime(p.qualification_next_action_at || p.date_de_rappel || p.notes_next_activity_date)}</div></div>
                </div>

                <div className="space-y-2 border-t border-border pt-4">
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={previous} disabled={remaining.length <= 1}><ChevronLeft size={15} /> Précédent</Button>
                    <Button variant="outline" size="sm" onClick={skip} disabled={remaining.length <= 1}><SkipForward size={15} /> Passer</Button>
                  </div>
                  <Button className="w-full" onClick={markDone}>Compte traité <ChevronRight size={15} /></Button>
                </div>
              </div>
            </aside>

            <CompanyProfilePanel companyId={current.company.id} fallbackCompany={current.company} onOpenCompany={onOpenCompany} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
