"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Building2, CalendarClock, CalendarDays, CheckCircle2, Clock3, Eye,
  ListTodo, Loader2, Phone, PhoneCall, Play, RefreshCw, RotateCcw, SkipForward,
  Sparkles, Target, TimerReset, UserRound, XCircle,
} from "lucide-react";
import { ContactDrawer } from "@/components/contact-drawer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ContactProperties = Record<string, string | null | undefined>;

type QueueContact = {
  id: string;
  properties: ContactProperties;
  priorityScore: number;
  priorityLabel: string;
  priorityTone: "urgent" | "today" | "normal" | "healthy";
  priorityReason: string;
  nextReminderAt: string | null;
  attemptCount: number;
};

type TodayData = {
  generatedAt: string;
  queue: QueueContact[];
  stats: {
    overdueReminders: number;
    remindersToday: number;
    newProspects: number;
    tasksDue: number;
    meetingsToday: number;
    actionsToday: number;
  };
};

const OUTCOMES = ["NRP", "Occupé", "À rappeler", "Intéressé", "RDV pris", "Pas intéressé", "Hors cible", "Numéro invalide"];
const REMINDER_OUTCOMES = new Set(["Occupé", "À rappeler"]);

const toneClasses = {
  urgent: "border-rose-400/35 bg-rose-400/10 text-rose-300",
  today: "border-orange-400/35 bg-orange-400/10 text-orange-300",
  normal: "border-amber-400/35 bg-amber-400/10 text-amber-300",
  healthy: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
};

const outcomeClasses: Record<string, string> = {
  "NRP": "hover:border-slate-400/50 hover:bg-slate-400/10",
  "Occupé": "hover:border-orange-400/50 hover:bg-orange-400/10",
  "À rappeler": "hover:border-amber-400/50 hover:bg-amber-400/10",
  "Intéressé": "hover:border-emerald-400/50 hover:bg-emerald-400/10",
  "RDV pris": "hover:border-emerald-400/50 hover:bg-emerald-400/10",
  "Pas intéressé": "hover:border-rose-400/50 hover:bg-rose-400/10",
  "Hors cible": "hover:border-rose-400/50 hover:bg-rose-400/10",
  "Numéro invalide": "hover:border-rose-400/50 hover:bg-rose-400/10",
};

function fullName(contact: QueueContact) {
  const p = contact.properties;
  return [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Contact sans nom";
}

function initials(contact: QueueContact) {
  return [contact.properties.firstname, contact.properties.lastname].filter(Boolean).map(value => String(value).slice(0, 1)).join("").slice(0, 2).toUpperCase() || "?";
}

function phoneNumber(contact: QueueContact) {
  return contact.properties.phone || contact.properties.mobilephone || "";
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function localDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function reminderPreset(preset: "hour" | "afternoon" | "tomorrow-am" | "tomorrow-pm") {
  const now = new Date();
  if (preset === "hour") return new Date(now.getTime() + 60 * 60_000);
  const date = new Date(now);
  if (preset.startsWith("tomorrow")) date.setDate(date.getDate() + 1);
  if (preset === "tomorrow-am") date.setHours(9, 0, 0, 0);
  else date.setHours(15, 0, 0, 0);
  if (date <= now) date.setTime(now.getTime() + 60 * 60_000);
  return date;
}

type OutcomePanelProps = {
  contact: QueueContact;
  saving: boolean;
  error: string;
  pendingOutcome: string;
  reminderAt: string;
  onSelectOutcome: (outcome: string) => void;
  onReminderChange: (value: string) => void;
  onSaveReminder: () => void;
  onCancelReminder: () => void;
};

function OutcomePanel({ contact, saving, error, pendingOutcome, reminderAt, onSelectOutcome, onReminderChange, onSaveReminder, onCancelReminder }: OutcomePanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Après l’appel</div>
        <h3 className="font-display mt-1 text-xl font-bold">Quel est le résultat ?</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {OUTCOMES.map(outcome => (
          <Button key={outcome} variant="outline" disabled={saving} onClick={() => onSelectOutcome(outcome)}
            className={cn("h-12 whitespace-normal px-2 text-xs font-semibold", outcomeClasses[outcome])}>
            {outcome}
          </Button>
        ))}
      </div>

      {pendingOutcome ? (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4">
          <div className="flex items-center gap-2 font-semibold"><CalendarClock className="h-4 w-4 text-amber-300" /> Quand faut-il rappeler {fullName(contact)} ?</div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button variant="outline" size="sm" onClick={() => onReminderChange(localDateTime(reminderPreset("hour")))}>Dans 1 heure</Button>
            <Button variant="outline" size="sm" onClick={() => onReminderChange(localDateTime(reminderPreset("afternoon")))}>Cet après-midi</Button>
            <Button variant="outline" size="sm" onClick={() => onReminderChange(localDateTime(reminderPreset("tomorrow-am")))}>Demain matin</Button>
            <Button variant="outline" size="sm" onClick={() => onReminderChange(localDateTime(reminderPreset("tomorrow-pm")))}>Demain · 15h</Button>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input type="datetime-local" value={reminderAt} min={localDateTime(new Date())} onChange={event => onReminderChange(event.target.value)} className="h-10" />
            <Button disabled={saving || !reminderAt} onClick={onSaveReminder} className="shrink-0">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Programmer le rappel
            </Button>
            <Button variant="ghost" disabled={saving} onClick={onCancelReminder}>Annuler</Button>
          </div>
        </div>
      ) : null}
      {error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
    </div>
  );
}

function ProspectSummary({ contact, prominent = false }: { contact: QueueContact; prominent?: boolean }) {
  const p = contact.properties;
  return (
    <div className={cn("flex min-w-0 items-start gap-3", prominent && "gap-4")}>
      <Avatar className={cn("shrink-0 rounded-xl border border-violet-400/25 bg-accent", prominent ? "h-14 w-14" : "h-10 w-10")}>
        <AvatarFallback className="rounded-xl bg-accent font-bold text-violet-300">{initials(contact)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={cn("truncate font-semibold", prominent ? "font-display text-2xl font-bold" : "text-sm")}>{fullName(contact)}</h3>
          <Badge variant="outline" className={cn("border", toneClasses[contact.priorityTone])}>{contact.priorityLabel}</Badge>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-violet-300" />{p.company || "Sans entreprise"}</span>
          {p.jobtitle ? <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5 text-violet-300" />{p.jobtitle}</span> : null}
          <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-violet-300" />{phoneNumber(contact) || "Sans téléphone"}</span>
        </div>
      </div>
    </div>
  );
}

export function TodayView() {
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [outcomeContact, setOutcomeContact] = useState<QueueContact | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [pendingOutcome, setPendingOutcome] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/today", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || body.error || "Impossible de charger HubSpot");
      setData(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de charger HubSpot");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sessionContact = data?.queue[sessionIndex] || null;
  const activeOutcomeContact = outcomeContact || sessionContact;

  const metrics = useMemo(() => data ? [
    { label: "Rappels en retard", value: data.stats.overdueReminders, icon: TimerReset, tone: "text-rose-300 bg-rose-400/10" },
    { label: "Rappels aujourd’hui", value: data.stats.remindersToday, icon: Clock3, tone: "text-orange-300 bg-orange-400/10" },
    { label: "Nouveaux prospects", value: data.stats.newProspects, icon: Target, tone: "text-amber-300 bg-amber-400/10" },
    { label: "Tâches à faire", value: data.stats.tasksDue, icon: ListTodo, tone: "text-violet-300 bg-violet-400/10" },
    { label: "RDV aujourd’hui", value: data.stats.meetingsToday, icon: CalendarDays, tone: "text-emerald-300 bg-emerald-400/10" },
  ] : [], [data]);

  function resetOutcome() {
    setPendingOutcome("");
    setReminderAt("");
    setActionError("");
  }

  async function saveOutcome(contact: QueueContact, outcome: string, selectedReminder?: string) {
    setSaving(true);
    setActionError("");
    try {
      const response = await fetch(`/api/contacts/${contact.id}/outcome`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome, reminderAt: selectedReminder ? new Date(selectedReminder).toISOString() : undefined }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.message || "HubSpot a refusé la mise à jour");
      setData(current => current ? { ...current, queue: current.queue.filter(row => row.id !== contact.id) } : current);
      setOutcomeContact(null);
      resetOutcome();
      await load(true);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Impossible d’enregistrer le résultat");
    } finally {
      setSaving(false);
    }
  }

  function selectOutcome(contact: QueueContact, outcome: string) {
    if (REMINDER_OUTCOMES.has(outcome)) {
      setPendingOutcome(outcome);
      setReminderAt(localDateTime(reminderPreset(outcome === "Occupé" ? "hour" : "tomorrow-am")));
      return;
    }
    void saveOutcome(contact, outcome);
  }

  function openOutcome(contact: QueueContact) {
    resetOutcome();
    setOutcomeContact(contact);
  }

  if (loading) {
    return <div className="grid min-h-[calc(100vh-24px)] flex-1 place-items-center rounded-[22px] border border-border bg-card"><div className="text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-violet-300" /><p className="mt-3 text-sm text-muted-foreground">Préparation de votre journée HubSpot…</p></div></div>;
  }

  return (
    <div className="min-w-0 flex-1 overflow-hidden rounded-[22px] border border-border bg-card/80 backdrop-blur">
      <div className="minari-scrollbar h-[calc(100vh-24px)] overflow-y-auto">
        <div className="mx-auto max-w-7xl p-5 lg:p-7">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-300"><Sparkles className="h-4 w-4" /> Votre cockpit quotidien</div>
              <h1 className="font-display mt-2 text-3xl font-bold tracking-tight">Bonjour 👋</h1>
              <p className="mt-1 text-sm text-muted-foreground"><span className="font-semibold text-foreground">{data?.stats.actionsToday || 0} actions</span> à piloter aujourd’hui. Commencez par les rappels les plus urgents.</p>
            </div>
            <Button variant="outline" onClick={() => load()}><RefreshCw className="h-4 w-4" /> Actualiser</Button>
          </header>

          {error ? <div role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {metrics.map(({ label, value, icon: Icon, tone }) => (
              <Card key={label} className="shadow-none">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", tone)}><Icon className="h-4 w-4" /></div>
                  <div><div className="font-display text-2xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,.7)]" /><h2 className="font-display text-xl font-bold">À appeler maintenant</h2></div>
                <p className="mt-1 text-sm text-muted-foreground">Tri automatique par score de priorité, puis par date de relance.</p>
              </div>
              <Button size="lg" disabled={!data?.queue.length} onClick={() => { setSessionIndex(0); resetOutcome(); setSessionOpen(true); }} className="h-11 px-5 shadow-glow">
                <Play className="h-4 w-4 fill-current" /> COMMENCER MES APPELS
              </Button>
            </div>

            {!data?.queue.length ? (
              <Card className="mt-4 border-dashed">
                <CardContent className="flex min-h-64 flex-col items-center justify-center text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300"><CheckCircle2 className="h-6 w-6" /></div>
                  <h3 className="mt-4 font-semibold">Aucun prospect à appeler maintenant</h3>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">Les rappels futurs remonteront automatiquement au bon moment. Les contacts sans téléphone ou hors cible restent exclus.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="mt-4 space-y-3">
                {data.queue.slice(0, 100).map(contact => {
                  const p = contact.properties;
                  return (
                    <Card key={contact.id} className={cn("overflow-hidden transition-colors hover:border-violet-400/30", contact.priorityTone === "urgent" && "border-rose-400/25")}>
                      <CardContent className="p-0">
                        <div className={cn("h-1", contact.priorityTone === "urgent" ? "bg-rose-400" : contact.priorityTone === "today" ? "bg-orange-400" : "bg-amber-400")} />
                        <div className="p-4 lg:p-5">
                          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                            <ProspectSummary contact={contact} />
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <Button asChild disabled={!phoneNumber(contact)}><a href={`tel:${phoneNumber(contact)}`}><PhoneCall className="h-4 w-4" /> Appeler</a></Button>
                              <Button variant="outline" onClick={() => setDrawerId(contact.id)}><Eye className="h-4 w-4" /> Voir la fiche</Button>
                              <Button variant="secondary" onClick={() => openOutcome(contact)}><CheckCircle2 className="h-4 w-4" /> Résultat</Button>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-5">
                            <div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Statut appel</div><div className="mt-1 text-sm font-medium">{p.statut_de_lappel || "Jamais appelé"}</div></div>
                            <div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Prospection</div><div className="mt-1 text-sm font-medium">{p.statut_prospection || "À prospecter"}</div></div>
                            <div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Dernier appel</div><div className="mt-1 text-sm font-medium">{formatDateTime(p.notes_last_contacted || p.hs_last_sales_activity_timestamp)}</div></div>
                            <div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Tentatives</div><div className="mt-1 text-sm font-medium">{contact.attemptCount}</div></div>
                            <div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Prochaine relance</div><div className="mt-1 text-sm font-medium">{formatDateTime(contact.nextReminderAt)}</div></div>
                          </div>
                          <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted/45 px-3 py-2.5 text-sm"><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" /><span><strong>Pourquoi maintenant :</strong> {contact.priorityReason}</span></div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      <ContactDrawer contactId={drawerId} open={Boolean(drawerId)} onOpenChange={open => { if (!open) setDrawerId(null); }} onUpdated={() => load(true)} />

      <Dialog open={Boolean(outcomeContact)} onOpenChange={open => { if (!open) { setOutcomeContact(null); resetOutcome(); } }}>
        <DialogContent className="max-w-2xl">
          {outcomeContact ? <>
            <DialogHeader><DialogTitle>Résultat de l’appel</DialogTitle><DialogDescription>{fullName(outcomeContact)} · {outcomeContact.properties.company || "Sans entreprise"}</DialogDescription></DialogHeader>
            <OutcomePanel contact={outcomeContact} saving={saving} error={actionError} pendingOutcome={pendingOutcome} reminderAt={reminderAt}
              onSelectOutcome={outcome => selectOutcome(outcomeContact, outcome)} onReminderChange={setReminderAt}
              onSaveReminder={() => saveOutcome(outcomeContact, pendingOutcome, reminderAt)} onCancelReminder={resetOutcome} />
          </> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={sessionOpen} onOpenChange={open => { setSessionOpen(open); if (!open) resetOutcome(); }}>
        <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto p-0">
          {sessionContact ? (
            <div>
              <div className="flex items-center justify-between border-b border-border px-5 py-4 pr-12">
                <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-300">Session d’appels</div><div className="mt-1 text-sm text-muted-foreground">Prospect {Math.min(sessionIndex + 1, data?.queue.length || 1)} · {data?.queue.length || 0} restant(s)</div></div>
                <Badge variant="outline" className={toneClasses[sessionContact.priorityTone]}>Score {sessionContact.priorityScore}</Badge>
              </div>
              <div className="grid gap-0 lg:grid-cols-[1.05fr_.95fr]">
                <div className="border-b border-border p-6 lg:border-b-0 lg:border-r">
                  <ProspectSummary contact={sessionContact} prominent />
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <Card className="shadow-none"><CardHeader className="p-4"><CardDescription>Dernier résultat</CardDescription><CardTitle className="text-base">{sessionContact.properties.statut_de_lappel || "Jamais appelé"}</CardTitle></CardHeader></Card>
                    <Card className="shadow-none"><CardHeader className="p-4"><CardDescription>Dernier contact</CardDescription><CardTitle className="text-base">{formatDateTime(sessionContact.properties.notes_last_contacted || sessionContact.properties.hs_last_sales_activity_timestamp)}</CardTitle></CardHeader></Card>
                  </div>
                  <div className="mt-4 rounded-2xl border border-violet-400/20 bg-violet-400/[0.06] p-4"><div className="text-xs font-semibold uppercase tracking-wide text-violet-300">Motif</div><p className="mt-2 text-sm leading-6">{sessionContact.priorityReason}</p></div>
                  <Button asChild size="lg" className="mt-5 h-14 w-full text-base shadow-glow"><a href={`tel:${phoneNumber(sessionContact)}`}><PhoneCall className="h-5 w-5" /> APPELER · {phoneNumber(sessionContact)}</a></Button>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => { setDrawerId(sessionContact.id); }}><Eye className="h-4 w-4" /> Voir la fiche</Button>
                    <Button variant="ghost" onClick={() => { resetOutcome(); setSessionIndex(index => Math.min(index + 1, Math.max(0, (data?.queue.length || 1) - 1))); }}><SkipForward className="h-4 w-4" /> Passer</Button>
                    <Button variant="ghost" onClick={() => { setPendingOutcome("À rappeler"); setReminderAt(localDateTime(reminderPreset("tomorrow-am"))); }}><RotateCcw className="h-4 w-4" /> Reporter</Button>
                  </div>
                </div>
                <div className="p-6">
                  <OutcomePanel contact={sessionContact} saving={saving} error={actionError} pendingOutcome={pendingOutcome} reminderAt={reminderAt}
                    onSelectOutcome={outcome => selectOutcome(sessionContact, outcome)} onReminderChange={setReminderAt}
                    onSaveReminder={() => saveOutcome(sessionContact, pendingOutcome, reminderAt)} onCancelReminder={resetOutcome} />
                  <div className="mt-6 border-t border-border pt-4">
                    <Button variant="ghost" className="w-full" onClick={() => setSessionOpen(false)}><XCircle className="h-4 w-4" /> Terminer la session</Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-96 flex-col items-center justify-center p-8 text-center"><CheckCircle2 className="h-10 w-10 text-emerald-300" /><DialogTitle className="mt-4">Session terminée</DialogTitle><DialogDescription className="mt-2">Aucun autre prospect n’est à appeler maintenant.</DialogDescription><Button className="mt-5" onClick={() => setSessionOpen(false)}>Fermer</Button></div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
