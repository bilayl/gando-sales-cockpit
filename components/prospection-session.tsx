"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, ListTodo, Loader2, Phone, SkipForward } from "lucide-react";
import { COMPANY_PIPELINE, deriveCompanyStage, type CompanyStage } from "@/components/company-prospection-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

// Operational order for a setter. Terminal states are excluded from a session.
const STAGE_ORDER: Record<CompanyStage, number> = {
  FOLLOW_UP: 0,
  ATTEMPTED_TO_CONTACT: 1,
  OPEN: 2,
  NEW: 3,
  CONNECTED: 4,
  OPEN_DEAL: 5,
  LATER: 6,
  WON: 99,
  LOST: 99,
};

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
    const activeIds = companies
      .filter(company => !["WON", "LOST"].includes(deriveCompanyStage(company)))
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
    return companies
      .map(company => ({ company, stage: deriveCompanyStage(company), summary: summaries[company.id] }))
      .filter(item => !["WON", "LOST"].includes(item.stage))
      .sort((a, b) => {
        const stage = STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage];
        if (stage !== 0) return stage;
        const tasks = taskRank(a.summary) - taskRank(b.summary);
        if (tasks !== 0) return tasks;
        const aDue = a.summary?.nextTask?.dueAt ? Date.parse(a.summary.nextTask.dueAt) : Number.MAX_SAFE_INTEGER;
        const bDue = b.summary?.nextTask?.dueAt ? Date.parse(b.summary.nextTask.dueAt) : Number.MAX_SAFE_INTEGER;
        if (aDue !== bDue) return aDue - bDue;
        const aReminder = Date.parse(a.company.properties.date_de_rappel || "") || Number.MAX_SAFE_INTEGER;
        const bReminder = Date.parse(b.company.properties.date_de_rappel || "") || Number.MAX_SAFE_INTEGER;
        return aReminder - bReminder;
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
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <DialogTitle>Session de prospection</DialogTitle>
              <DialogDescription className="mt-1">
                {queue.length} comptes issus des filtres actuels · triés par statut puis par tâches HubSpot à traiter.
              </DialogDescription>
            </div>
            <Badge variant="secondary">{remaining.length} restant{remaining.length > 1 ? "s" : ""}</Badge>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="grid min-h-[420px] place-items-center px-6 py-10 text-center">
            <div><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Lecture des tâches HubSpot…</p></div>
          </div>
        ) : error ? (
          <div className="m-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
        ) : !current ? (
          <div className="grid min-h-[420px] place-items-center px-6 py-10 text-center">
            <div>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><CheckCircle2 /></span>
              <h3 className="mt-4 text-lg font-semibold">Session terminée</h3>
              <p className="mt-1 text-sm text-muted-foreground">Tous les comptes correspondant aux filtres ont été parcourus.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-primary"><Building2 /></span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-xl font-bold tracking-tight">{p.name || p.domain || "Entreprise sans nom"}</h2>
                    <Badge variant="outline">{STAGE_LABELS[current.stage]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{[p.city, p.country, p.domain].filter(Boolean).join(" · ") || "Aucune information de localisation"}</p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-right">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Priorité tâche</div>
                <div className="mt-0.5 text-sm font-semibold">{taskLabel(current.summary)}</div>
              </div>
            </div>

            {task ? (
              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-background text-primary"><ListTodo size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{task.subject}</h3>
                      {task.priority ? <Badge variant="secondary">{task.priority}</Badge> : null}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><CalendarClock size={13} /> {formatDateTime(task.dueAt)}</span>
                      {task.sourceContactName ? <span>{task.sourceContactName}{task.sourceContactJobTitle ? ` · ${task.sourceContactJobTitle}` : ""}</span> : <span>Tâche entreprise</span>}
                      {task.sourceContactPhone ? <span className="inline-flex items-center gap-1"><Phone size={13} /> {task.sourceContactPhone}</span> : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Aucune tâche ouverte : ce compte est positionné selon son statut de prospection et sa date de rappel.
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Statut</div><div className="mt-1 text-sm font-semibold">{STAGE_LABELS[current.stage]}</div></div>
              <div className="rounded-lg border border-border p-3"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Dernier appel</div><div className="mt-1 text-sm font-semibold">{p.statut_de_lappel || "—"}</div></div>
              <div className="rounded-lg border border-border p-3"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Rappel</div><div className="mt-1 text-sm font-semibold">{formatDateTime(p.date_de_rappel)}</div></div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={previous} disabled={remaining.length <= 1}><ChevronLeft size={15} /> Précédent</Button>
                <Button variant="outline" size="sm" onClick={skip} disabled={remaining.length <= 1}><SkipForward size={15} /> Passer</Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => onOpenCompany(current.company.id)}><ExternalLink size={15} /> Ouvrir la fiche</Button>
                <Button onClick={markDone}>Traité <ChevronRight size={15} /></Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
