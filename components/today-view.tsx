"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Eye,
  Loader2,
  Phone,
  PhoneCall,
  Play,
  RefreshCw,
  RotateCcw,
  SkipForward,
  UserRound,
  XCircle,
} from "lucide-react";
import { ContactDrawer } from "@/components/contact-drawer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  urgent: "border-rose-200 bg-rose-50 text-rose-700",
  today: "border-amber-200 bg-amber-50 text-amber-700",
  normal: "border-border bg-muted text-muted-foreground",
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function fullName(contact: QueueContact) {
  const p = contact.properties;
  return [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Contact sans nom";
}

function initials(contact: QueueContact) {
  return [contact.properties.firstname, contact.properties.lastname]
    .filter(Boolean)
    .map(value => String(value).slice(0, 1))
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
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
        <div className="eyebrow">Après l’appel</div>
        <h3 className="mt-1 text-lg font-bold tracking-tight">Quel est le résultat ?</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {OUTCOMES.map(outcome => (
          <Button
            key={outcome}
            variant="outline"
            disabled={saving}
            onClick={() => onSelectOutcome(outcome)}
            className={cn(
              "h-10 whitespace-normal px-2 text-[11px]",
              pendingOutcome === outcome && "border-primary bg-accent text-accent-foreground"
            )}
          >
            {outcome}
          </Button>
        ))}
      </div>

      {pendingOutcome ? (
        <div className="rounded-lg border border-border bg-muted/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="h-4 w-4 text-primary" /> Quand rappeler {fullName(contact)} ?
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button variant="outline" size="sm" onClick={() => onReminderChange(localDateTime(reminderPreset("hour")))}>Dans 1 heure</Button>
            <Button variant="outline" size="sm" onClick={() => onReminderChange(localDateTime(reminderPreset("afternoon")))}>Cet après-midi</Button>
            <Button variant="outline" size="sm" onClick={() => onReminderChange(localDateTime(reminderPreset("tomorrow-am")))}>Demain matin</Button>
            <Button variant="outline" size="sm" onClick={() => onReminderChange(localDateTime(reminderPreset("tomorrow-pm")))}>Demain · 15h</Button>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input type="datetime-local" value={reminderAt} min={localDateTime(new Date())} onChange={event => onReminderChange(event.target.value)} />
            <Button disabled={saving || !reminderAt} onClick={onSaveReminder} className="shrink-0">
              {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Programmer
            </Button>
            <Button variant="ghost" disabled={saving} onClick={onCancelReminder}>Annuler</Button>
          </div>
        </div>
      ) : null}
      {error ? <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div> : null}
    </div>
  );
}

function ProspectSummary({ contact, prominent = false }: { contact: QueueContact; prominent?: boolean }) {
  const p = contact.properties;
  return (
    <div className={cn("flex min-w-0 items-center gap-3", prominent && "items-start gap-4")}>
      <Avatar className={cn("shrink-0 rounded-lg border border-border bg-muted", prominent ? "h-12 w-12" : "h-9 w-9")}>
        <AvatarFallback className="rounded-lg bg-muted text-xs font-bold text-primary">{initials(contact)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={cn("truncate font-semibold", prominent ? "text-xl font-bold tracking-tight" : "text-sm")}>{fullName(contact)}</h3>
          {prominent ? <Badge variant="outline" className={toneClasses[contact.priorityTone]}>{contact.priorityLabel}</Badge> : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{p.company || "Sans entreprise"}</span>
          {prominent && p.jobtitle ? <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{p.jobtitle}</span> : null}
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
    return (
      <div className="page-shell grid min-h-screen place-items-center">
        <div className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Préparation de votre journée HubSpot…</p></div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-content">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.035em]">Aujourd’hui</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{data?.stats.actionsToday || 0} actions</span> à piloter, classées par priorité.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => load()}><RefreshCw /> Actualiser</Button>
        </header>

        {error ? <div role="alert" className="mt-4 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}

        <section className="mt-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="section-title">File d’appels</h2>
              <p className="mt-1 text-sm text-muted-foreground">{data?.queue.length || 0} contacts · rappels urgents en premier</p>
            </div>
            <Button disabled={!data?.queue.length} onClick={() => { setSessionIndex(0); resetOutcome(); setSessionOpen(true); }}>
              <Play className="fill-current" /> Démarrer la session
            </Button>
          </div>

          {!data?.queue.length ? (
            <div className="mt-4 flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card text-center">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><CheckCircle2 /></span>
              <h3 className="mt-3 font-semibold">Aucun prospect à appeler maintenant</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">Les rappels futurs remonteront automatiquement au bon moment.</p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
              <div className="hidden grid-cols-[minmax(220px,1.4fr)_135px_125px_125px_220px] items-center gap-3 border-b border-border bg-muted/70 px-4 py-2.5 lg:grid">
                <span className="eyebrow">Contact</span>
                <span className="eyebrow">Statut</span>
                <span className="eyebrow">Téléphone</span>
                <span className="eyebrow">Prochaine action</span>
                <span className="eyebrow text-right">Actions</span>
              </div>
              <div className="minari-scrollbar max-h-[calc(100vh-320px)] overflow-y-auto">
                {data.queue.slice(0, 100).map(contact => {
                  const p = contact.properties;
                  return (
                    <div key={contact.id} className="grid gap-3 border-b border-border/75 px-4 py-3 last:border-b-0 hover:bg-muted/40 lg:grid-cols-[minmax(220px,1.4fr)_135px_125px_125px_220px] lg:items-center">
                      <div className="min-w-0">
                        <ProspectSummary contact={contact} />
                        <p className="mt-1.5 truncate pl-12 text-[11px] text-muted-foreground">{contact.priorityReason}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={toneClasses[contact.priorityTone]}>{contact.priorityLabel}</Badge>
                        <span className="text-xs text-muted-foreground">{p.statut_de_lappel || "Jamais appelé"}</span>
                      </div>
                      <div className="text-xs">
                        {phoneNumber(contact) ? <span className="phone-chip"><Phone className="h-3 w-3" />{phoneNumber(contact)}</span> : <span className="text-muted-foreground">Sans numéro</span>}
                      </div>
                      <div>
                        <div className="text-xs font-semibold">{formatDateTime(contact.nextReminderAt)}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{contact.attemptCount} tentative{contact.attemptCount > 1 ? "s" : ""}</div>
                      </div>
                      <div className="flex flex-wrap justify-start gap-1.5 lg:justify-end">
                        <Button size="sm" disabled={!phoneNumber(contact)} onClick={() => setDrawerId(contact.id)} title="Ouvrir la fiche avant l’appel"><PhoneCall /> Appeler</Button>
                        <Button variant="outline" size="sm" onClick={() => openOutcome(contact)}><CheckCircle2 /> Résultat</Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDrawerId(contact.id)} aria-label={`Voir la fiche de ${fullName(contact)}`} title="Voir la fiche"><ChevronRight /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
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
                <div><div className="eyebrow text-primary">Session d’appels</div><div className="mt-1 text-sm text-muted-foreground">Prospect {Math.min(sessionIndex + 1, data?.queue.length || 1)} sur {data?.queue.length || 0}</div></div>
                <Badge variant="outline" className={toneClasses[sessionContact.priorityTone]}>Score {sessionContact.priorityScore}</Badge>
              </div>
              <div className="grid lg:grid-cols-[1.05fr_.95fr]">
                <div className="border-b border-border p-6 lg:border-b-0 lg:border-r">
                  <ProspectSummary contact={sessionContact} prominent />
                  <dl className="mt-6 grid grid-cols-2 overflow-hidden rounded-lg border border-border">
                    <div className="p-4"><dt className="eyebrow">Dernier résultat</dt><dd className="mt-1 text-sm font-semibold">{sessionContact.properties.statut_de_lappel || "Jamais appelé"}</dd></div>
                    <div className="border-l border-border p-4"><dt className="eyebrow">Dernier contact</dt><dd className="mt-1 text-sm font-semibold">{formatDateTime(sessionContact.properties.notes_last_contacted || sessionContact.properties.hs_last_sales_activity_timestamp)}</dd></div>
                  </dl>
                  <div className="mt-4 rounded-lg bg-muted p-4"><div className="eyebrow">Pourquoi maintenant</div><p className="mt-2 text-sm leading-6">{sessionContact.priorityReason}</p></div>
                  <Button size="lg" className="mt-5 w-full" onClick={() => { setSessionOpen(false); setDrawerId(sessionContact.id); }}><PhoneCall /> Appeler · {phoneNumber(sessionContact)}</Button>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => setDrawerId(sessionContact.id)}><Eye /> Voir la fiche</Button>
                    <Button variant="ghost" size="sm" onClick={() => { resetOutcome(); setSessionIndex(index => Math.min(index + 1, Math.max(0, (data?.queue.length || 1) - 1))); }}><SkipForward /> Passer</Button>
                    <Button variant="ghost" size="sm" onClick={() => { setPendingOutcome("À rappeler"); setReminderAt(localDateTime(reminderPreset("tomorrow-am"))); }}><RotateCcw /> Reporter</Button>
                  </div>
                </div>
                <div className="p-6">
                  <OutcomePanel contact={sessionContact} saving={saving} error={actionError} pendingOutcome={pendingOutcome} reminderAt={reminderAt}
                    onSelectOutcome={outcome => selectOutcome(sessionContact, outcome)} onReminderChange={setReminderAt}
                    onSaveReminder={() => saveOutcome(sessionContact, pendingOutcome, reminderAt)} onCancelReminder={resetOutcome} />
                  <div className="mt-6 border-t border-border pt-4">
                    <Button variant="ghost" className="w-full" onClick={() => setSessionOpen(false)}><XCircle /> Terminer la session</Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center"><CheckCircle2 className="h-9 w-9 text-emerald-600" /><DialogTitle className="mt-4">Session terminée</DialogTitle><DialogDescription className="mt-2">Aucun autre prospect n’est à appeler maintenant.</DialogDescription><Button className="mt-5" onClick={() => setSessionOpen(false)}>Fermer</Button></div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
