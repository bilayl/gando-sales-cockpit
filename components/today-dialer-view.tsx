"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  ListTodo,
  Loader2,
  Mail,
  Phone,
  PhoneCall,
  RefreshCw,
  Target,
  UserRound,
  UsersRound,
} from "lucide-react";
import { AddContactButton } from "@/components/add-contact-button";
import { ProspectionSession } from "@/components/prospection-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ONOFF_EXTENSION_URL = "https://chromewebstore.google.com/detail/onoff-business-click2call/jbfkkljambdhjlkcfkcbpjfkkamkccfm";

type Contact = {
  id: string;
  properties: Record<string, string | null | undefined>;
  ownership?: "MINE" | "UNASSIGNED" | "OTHER";
  assignee?: string | null;
};

type Company = { id: string; properties: Record<string, string | null | undefined> };

type Task = {
  id: string;
  properties: Record<string, string | null | undefined>;
  cockpitAssignee?: { email?: string | null; displayName?: string | null } | null;
  associations?: {
    contact?: { id: string; properties?: Record<string, string | null | undefined> } | null;
    company?: { id: string; properties?: Record<string, string | null | undefined> } | null;
  };
};

type TodayPayload = {
  member?: { email?: string; displayName?: string | null };
  results?: Contact[];
  mineCount?: number;
  availableCount?: number;
  callableCount?: number;
  totalActionable?: number;
  callWindow?: string;
  error?: string;
};

type OnoffStatus = {
  configured?: boolean;
  connected?: boolean | null;
  latestProcessingStatus?: string | null;
  error?: string | null;
};

type AgendaPayload = { results?: any[]; reminders?: Contact[]; warnings?: string[] };

type UnifiedAction =
  | { kind: "TASK"; key: string; priority: number; at: number; task: Task; overdue: boolean }
  | { kind: "REMINDER"; key: string; priority: number; at: number; contact: Contact }
  | { kind: "CALL"; key: string; priority: number; at: number; contact: Contact }
  | { kind: "MEETING"; key: string; priority: number; at: number; meeting: any };

function fullName(contact?: Contact | null) {
  if (!contact) return "—";
  const p = contact.properties;
  return [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Contact sans nom";
}

function numberFor(contact?: Contact | null) {
  return String(contact?.properties.mobilephone || contact?.properties.phone || "").trim();
}

function callResult(value?: string | null) {
  const labels: Record<string, string> = {
    interesse: "Intéressé",
    interesse_mais: "Intéressé mais",
    a_une_date_ulterieure: "À une date ultérieure",
    a_rappeler: "À rappeler",
    pas_interesse: "Pas intéressé",
    occupe: "Occupé",
    nrp: "NRP",
    hors_cible: "Hors cible",
    en_attente_decision: "En attente décision",
    numero_invalide: "Numéro invalide",
    autres: "Autres",
  };
  return value ? labels[value] || value : "Aucun appel";
}

function commercialStage(properties: Record<string, string | null | undefined>) {
  const value = properties.statut_prospection || properties.qualification_status || properties.prospecting_status;
  if (!value) return "À traiter";
  const labels: Record<string, string> = {
    "À travailler": "À traiter",
    "À contacter": "En prospection",
    Tentative: "En prospection",
    "Contact établi": "Conversation",
    "À relancer": "Conversation",
    Ultérieur: "Conversation",
    "Démo prévue": "RDV planifié",
    Opportunité: "Opportunité",
    Gagné: "Gagné",
  };
  return labels[value] || value;
}

function dateMs(value?: string | null) {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function dayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function taskLabel(task: Task) {
  return task.properties?.hs_task_subject || "Action commerciale";
}

function taskContext(task: Task) {
  const contact = task.associations?.contact?.properties;
  const company = task.associations?.company?.properties;
  const contactName = contact ? [contact.firstname, contact.lastname].filter(Boolean).join(" ") || contact.email : "";
  return [contactName, company?.name].filter(Boolean).join(" · ") || "HubSpot";
}

function taskAssignee(task: Task) {
  return task.cockpitAssignee?.displayName || task.cockpitAssignee?.email || (task.properties?.hubspot_owner_id ? "Assignée dans HubSpot" : "Non assignée");
}

function taskIcon(type?: string | null) {
  if (type === "CALL") return Phone;
  if (type === "EMAIL") return Mail;
  if (type === "MEETING") return CalendarDays;
  return ListTodo;
}

function meetingStart(meeting: any) {
  const raw = meeting?.properties?.hs_meeting_start_time || meeting?.start?.dateTime || meeting?.start;
  return typeof raw === "string" ? raw : "";
}

export function TodayDialerView() {
  const [today, setToday] = useState<TodayPayload | null>(null);
  const [onoff, setOnoff] = useState<OnoffStatus | null>(null);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [agenda, setAgenda] = useState<AgendaPayload>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionStarting, setSessionStarting] = useState(false);
  const [sessionCompany, setSessionCompany] = useState<Company | null>(null);

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const range = dayRange();
      const [todayResponse, onoffResponse, todayTasksResponse, overdueResponse, agendaResponse] = await Promise.all([
        fetch("/api/today", { cache: "no-store" }),
        fetch("/api/onoff/status", { cache: "no-store" }),
        fetch("/api/tasks?period=today", { cache: "no-store" }),
        fetch("/api/tasks?period=overdue", { cache: "no-store" }),
        fetch(`/api/agenda?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`, { cache: "no-store" }),
      ]);

      const todayPayload = await todayResponse.json();
      if (!todayResponse.ok) throw new Error(todayPayload.error || "Impossible de charger la journée SDR");
      setToday(todayPayload);
      setOnoff(onoffResponse.ok ? await onoffResponse.json() : null);
      setTodayTasks(todayTasksResponse.ok ? (await todayTasksResponse.json()).results || [] : []);
      setOverdueTasks(overdueResponse.ok ? (await overdueResponse.json()).results || [] : []);
      setAgenda(agendaResponse.ok ? await agendaResponse.json() : {});

      const first = todayPayload.results?.[0];
      setSelectedId(current => current && todayPayload.results?.some((item: Contact) => item.id === current) ? current : first?.id || null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const results = today?.results || [];
  const selected = useMemo(() => results.find(contact => contact.id === selectedId) || results[0] || null, [results, selectedId]);
  const p = selected?.properties || {};
  const selectedNumber = numberFor(selected);
  const apiHealthy = Boolean(onoff?.configured && onoff?.connected !== false);

  // Important: the dashboard is global. Assignment is display metadata only, never a filter.
  const openTodayTasks = useMemo(
    () => todayTasks.filter(task => task.properties?.hs_task_status !== "COMPLETED"),
    [todayTasks],
  );
  const openOverdueTasks = useMemo(
    () => overdueTasks.filter(task => task.properties?.hs_task_status !== "COMPLETED"),
    [overdueTasks],
  );
  const allMeetings = useMemo(
    () => (agenda.results || []).slice().sort((a, b) => dateMs(meetingStart(a)) - dateMs(meetingStart(b))),
    [agenda],
  );
  const allReminders = useMemo(() => agenda.reminders || [], [agenda]);

  const actionTasks = useMemo(() => {
    const map = new Map<string, { task: Task; overdue: boolean }>();
    openOverdueTasks.forEach(task => map.set(task.id, { task, overdue: true }));
    openTodayTasks.forEach(task => { if (!map.has(task.id)) map.set(task.id, { task, overdue: false }); });
    return Array.from(map.values());
  }, [openOverdueTasks, openTodayTasks]);

  const unifiedActions = useMemo<UnifiedAction[]>(() => {
    const actions: UnifiedAction[] = [];
    const coveredContacts = new Set<string>();

    for (const { task, overdue } of actionTasks) {
      const contactId = String(task.associations?.contact?.id || "");
      if (contactId) coveredContacts.add(contactId);
      actions.push({
        kind: "TASK",
        key: `task:${task.id}`,
        priority: overdue ? 0 : 2,
        at: dateMs(task.properties.hs_timestamp),
        task,
        overdue,
      });
    }

    for (const contact of allReminders) {
      if (coveredContacts.has(String(contact.id))) continue;
      coveredContacts.add(String(contact.id));
      const at = contact.properties.date_prochaine_relance || contact.properties.date_recyclage;
      actions.push({ kind: "REMINDER", key: `reminder:${contact.id}`, priority: 1, at: dateMs(at), contact });
    }

    results.forEach((contact, index) => {
      if (coveredContacts.has(String(contact.id))) return;
      coveredContacts.add(String(contact.id));
      actions.push({ kind: "CALL", key: `call:${contact.id}`, priority: 3, at: Date.now() + index, contact });
    });

    allMeetings.forEach(meeting => {
      actions.push({
        kind: "MEETING",
        key: `meeting:${meeting.id || meetingStart(meeting)}`,
        priority: 4,
        at: dateMs(meetingStart(meeting)),
        meeting,
      });
    });

    return actions.sort((a, b) => a.priority - b.priority || a.at - b.at);
  }, [actionTasks, allReminders, results, allMeetings]);

  const prioritySentence = unifiedActions[0]
    ? unifiedActions[0].kind === "TASK"
      ? `${unifiedActions[0].overdue ? "Action en retard" : "Action du jour"} : ${taskLabel(unifiedActions[0].task)}.`
      : unifiedActions[0].kind === "REMINDER"
        ? `Prochaine action : rappeler ${fullName(unifiedActions[0].contact)}.`
        : unifiedActions[0].kind === "CALL"
          ? `Prochaine meilleure action : appeler ${fullName(unifiedActions[0].contact)} maintenant.`
          : `Prochain rendez-vous à ${formatTime(meetingStart(unifiedActions[0].meeting))}.`
    : "Aucune action commerciale détectée pour le moment.";

  async function completeTask(taskId: string) {
    setSavingTaskId(taskId);
    setMessage("");
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Impossible de terminer la tâche");
      setTodayTasks(current => current.filter(task => task.id !== taskId));
      setOverdueTasks(current => current.filter(task => task.id !== taskId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de terminer la tâche");
    } finally {
      setSavingTaskId(null);
    }
  }

  async function resolveCompanyIds(contact: Contact) {
    let candidate = String(contact.properties.db_company_id || "").trim();
    if (!candidate) {
      const response = await fetch(`/api/contacts/${encodeURIComponent(contact.id)}/centralized`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Impossible de retrouver l’entreprise associée à ce lead.");
      candidate = String(payload.companies?.[0]?.id || "").trim();
    }
    if (!candidate) throw new Error("Ce lead n’a aucune entreprise associée : impossible d’ouvrir la session d’appel.");

    const response = await fetch(`/api/prospection/company-id/${encodeURIComponent(candidate)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Impossible de résoudre l’identifiant HubSpot de cette entreprise.");
    const hubspotId = String(payload.hubspotId || "").trim();
    const assignmentId = String(payload.localId || candidate).trim();
    if (!hubspotId) throw new Error("Cette entreprise n’a pas encore d’identifiant HubSpot exploitable.");
    return { assignmentId, hubspotId };
  }

  async function openCallSession(contact = selected) {
    if (!contact || sessionStarting) return;
    setSelectedId(contact.id);
    setSessionStarting(true);
    setMessage("");
    try {
      const { assignmentId, hubspotId } = await resolveCompanyIds(contact);
      const assignmentResponse = await fetch("/api/prospection/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyIds: [assignmentId] }),
      });
      const assignmentPayload = await assignmentResponse.json().catch(() => ({}));
      if (!assignmentResponse.ok) throw new Error(assignmentPayload.message || assignmentPayload.error || "Impossible de préparer la session d’appel.");
      const claimed = new Set((assignmentPayload.claimedCompanyIds || []).map(String));
      if (!claimed.has(assignmentId)) throw new Error("Ce lead est déjà pris en charge par un autre commercial.");

      const companyResponse = await fetch(`/api/companies/${encodeURIComponent(hubspotId)}/centralized`, { cache: "no-store" });
      const companyPayload = await companyResponse.json().catch(() => ({}));
      if (!companyResponse.ok || !companyPayload.company) throw new Error(companyPayload.error || "Impossible de charger la session d’appel.");
      setSessionCompany(companyPayload.company as Company);
      setSessionOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible d’ouvrir la session d’appel.");
    } finally {
      setSessionStarting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-5 text-foreground transition-colors sm:px-6 lg:px-7">
      <div className="mx-auto max-w-[1540px]">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-primary">Aujourd’hui · Tableau de bord SDR</div>
            <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.035em]">Journée commerciale Gando</h1>
            <p className="mt-1 max-w-3xl text-[13px] text-muted-foreground">{prioritySentence} Les tâches, relances et RDV sont affichés pour toute l’équipe, sans filtre par SDR.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AddContactButton />
            <Button variant="outline" className="h-9 rounded-lg border-border bg-card" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Actualiser
            </Button>
            <Button asChild className="h-9 rounded-lg"><Link href="/prospection"><UsersRound className="mr-2 h-4 w-4" />Prospection</Link></Button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 py-5 lg:grid-cols-4">
          <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3">
            <div className="flex items-center justify-between"><ListTodo className="h-4 w-4 text-primary" /><span className="text-[22px] font-semibold tracking-[-0.03em]">{unifiedActions.length}</span></div>
            <div className="mt-2 text-[12px] font-medium">Actions à faire</div><div className="text-[11px] text-muted-foreground">Toute l’équipe · sans filtre SDR</div>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex items-center justify-between"><PhoneCall className="h-4 w-4 text-primary" /><span className="text-[22px] font-semibold tracking-[-0.03em]">{results.length}</span></div>
            <div className="mt-2 text-[12px] font-medium">Appels maintenant</div><div className="text-[11px] text-muted-foreground">Joignables dans votre file</div>
          </div>
          <Link href="/tasks" className="rounded-xl border border-border bg-card px-4 py-3 transition hover:border-primary/30 hover:bg-muted/20">
            <div className="flex items-center justify-between"><AlertTriangle className={`h-4 w-4 ${openOverdueTasks.length ? "text-amber-600" : "text-muted-foreground"}`} /><span className="text-[22px] font-semibold tracking-[-0.03em]">{openOverdueTasks.length}</span></div>
            <div className="mt-2 text-[12px] font-medium">En retard</div><div className="text-[11px] text-muted-foreground">Toutes les tâches en retard</div>
          </Link>
          <Link href="/meetings" className="rounded-xl border border-border bg-card px-4 py-3 transition hover:border-primary/30 hover:bg-muted/20">
            <div className="flex items-center justify-between"><CalendarDays className="h-4 w-4 text-primary" /><span className="text-[22px] font-semibold tracking-[-0.03em]">{allMeetings.length}</span></div>
            <div className="mt-2 text-[12px] font-medium">RDV aujourd’hui</div><div className="text-[11px] text-muted-foreground">Toute l’équipe commerciale</div>
          </Link>
        </div>

        {message ? <div className="mb-4 rounded-lg border border-border bg-muted px-4 py-3 text-[13px]">{message}</div> : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_460px]">
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div><div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">Priorité maintenant</div><div className="mt-1 text-[16px] font-semibold">Prochaine meilleure action</div></div>
              <Badge variant="outline" className="rounded-md border-border bg-muted text-foreground">{results.length} appels dans la file</Badge>
            </div>

            {loading ? (
              <div className="grid h-[420px] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : selected ? (
              <div className="grid min-h-[420px] lg:grid-cols-[minmax(0,1fr)_310px]">
                <div className="p-6 lg:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary"><UserRound className="h-5 w-5" /></div>
                      <h2 className="text-[25px] font-semibold tracking-[-0.035em]">{fullName(selected)}</h2>
                      <div className="mt-1 text-[14px] text-muted-foreground">{p.jobtitle || "Fonction à qualifier"}{p.company ? ` · ${p.company}` : ""}</div>
                    </div>
                    <Badge className={selected.ownership === "MINE" ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300" : "bg-muted text-muted-foreground hover:bg-muted"}>{selected.ownership === "MINE" ? "À moi" : "Disponible"}</Badge>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Étape commerciale</div><div className="mt-1.5 text-[14px] font-semibold">{commercialStage(p)}</div></div>
                    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Dernier résultat</div><div className="mt-1.5 text-[14px] font-semibold">{callResult(p.statut_de_lappel)}</div></div>
                    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Prochaine action</div><div className="mt-1.5 text-[14px] font-semibold">{p.date_prochaine_relance || p.date_recyclage ? `Rappeler · ${formatDateTime(p.date_prochaine_relance || p.date_recyclage)}` : "Appeler maintenant"}</div></div>
                    <div className="rounded-xl border border-primary/20 bg-primary/[0.05] px-4 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">Priorité</div><div className="mt-1.5 text-[14px] font-semibold">{p.db_call_priority_label || `Score ${p.db_call_score || 0}/100`}</div></div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><Phone size={13} />{selectedNumber || "Aucun numéro"}</span>
                    <span className="inline-flex items-center gap-1.5"><Clock3 size={13} />{p.db_call_local_time || "—"} · {p.db_call_timezone || "Fuseau inconnu"}</span>
                  </div>

                  <div className="mt-7 flex flex-wrap gap-2">
                    <Button className="h-11 rounded-xl px-6" onClick={() => void openCallSession()} disabled={sessionStarting || !selectedNumber}>
                      {sessionStarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Phone className="mr-2 h-4 w-4" />}Appeler maintenant
                    </Button>
                    {p.email ? <Button variant="outline" className="h-11 rounded-xl" asChild><a href={`mailto:${p.email}`}><Mail className="mr-2 h-4 w-4" />Email</a></Button> : null}
                    <Button variant="outline" className="h-11 rounded-xl" asChild><Link href={`/contacts/${selected.id}`}>Voir la fiche <ExternalLink className="ml-2 h-3.5 w-3.5" /></Link></Button>
                  </div>
                </div>

                <div className="border-t border-border bg-muted/25 p-3 lg:border-l lg:border-t-0">
                  <div className="flex items-center justify-between px-2 pb-2"><span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">File d’appel</span><span className="text-[10px] text-muted-foreground">par priorité</span></div>
                  <div className="max-h-[390px] space-y-1 overflow-y-auto pr-1 minari-scrollbar">
                    {results.slice(0, 100).map((contact, index) => {
                      const cp = contact.properties;
                      return (
                        <button key={contact.id} onClick={() => setSelectedId(contact.id)} className={`w-full rounded-xl border px-3 py-3 text-left transition ${selected.id === contact.id ? "border-primary/25 bg-card shadow-sm" : "border-transparent hover:bg-card"}`}>
                          <div className="flex items-start gap-2.5"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-muted text-[9px] font-semibold text-muted-foreground">{index + 1}</span><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold">{fullName(contact)}</div><div className="mt-0.5 truncate text-[11px] text-muted-foreground">{cp.company || "Sans entreprise"} · {cp.db_call_local_time || "—"}</div><div className="mt-1 text-[10px] font-medium text-primary">{cp.db_call_priority_label || commercialStage(cp)}</div></div></div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid h-[420px] place-items-center px-6 text-center"><div><CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600 dark:text-emerald-300" /><div className="mt-3 text-[15px] font-semibold">Aucun appel joignable maintenant</div><div className="mt-1 text-[12px] text-muted-foreground">Les tâches, relances et RDV de toute l’équipe restent visibles dans la liste à droite.</div></div></div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div><div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">À ne pas rater</div><h3 className="mt-1 text-[15px] font-semibold">Actions à faire · équipe</h3></div>
              <Badge variant={openOverdueTasks.length ? "destructive" : "outline"}>{unifiedActions.length}</Badge>
            </div>
            <div className="max-h-[500px] overflow-y-auto p-3 minari-scrollbar">
              {unifiedActions.length ? unifiedActions.slice(0, 30).map(action => {
                if (action.kind === "TASK") {
                  const Icon = taskIcon(action.task.properties.hs_task_type);
                  return (
                    <div key={action.key} className="mb-2 rounded-xl border border-border p-3 last:mb-0">
                      <div className="flex items-start gap-3">
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${action.overdue ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}><Icon size={14} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2"><div className="truncate text-[13px] font-semibold">{taskLabel(action.task)}</div>{action.overdue ? <Badge variant="outline" className="border-amber-500/30 text-[9px] text-amber-700 dark:text-amber-300">En retard</Badge> : null}</div>
                          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{taskContext(action.task)}</div>
                          <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-muted-foreground"><span>{formatDateTime(action.task.properties.hs_timestamp)}</span><span>·</span><span>{taskAssignee(action.task)}</span></div>
                        </div>
                        <button type="button" title="Marquer comme terminée" onClick={() => void completeTask(action.task.id)} disabled={savingTaskId === action.task.id} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-700 disabled:opacity-50">{savingTaskId === action.task.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}</button>
                      </div>
                    </div>
                  );
                }

                if (action.kind === "REMINDER") {
                  const rp = action.contact.properties;
                  return <Link key={action.key} href={`/contacts/${action.contact.id}`} className="mb-2 flex items-start gap-3 rounded-xl border border-border p-3 transition last:mb-0 hover:border-primary/25 hover:bg-muted/20"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Target size={14} /></span><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold">Rappeler {fullName(action.contact)}</div><div className="mt-0.5 truncate text-[11px] text-muted-foreground">{rp.company || rp.jobtitle || "Contact"}</div><div className="mt-1 text-[10px] font-medium text-primary">Relance · {formatDateTime(rp.date_prochaine_relance || rp.date_recyclage)}</div></div></Link>;
                }

                if (action.kind === "CALL") {
                  const cp = action.contact.properties;
                  return <button key={action.key} type="button" onClick={() => setSelectedId(action.contact.id)} className="mb-2 flex w-full items-start gap-3 rounded-xl border border-border p-3 text-left transition last:mb-0 hover:border-primary/25 hover:bg-muted/20"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><PhoneCall size={14} /></span><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold">Appeler {fullName(action.contact)}</div><div className="mt-0.5 truncate text-[11px] text-muted-foreground">{cp.company || "Sans entreprise"}</div><div className="mt-1 text-[10px] font-medium text-primary">Maintenant · {cp.db_call_local_time || "heure locale inconnue"}</div></div></button>;
                }

                const mp = action.meeting?.properties || {};
                return <Link key={action.key} href="/meetings" className="mb-2 flex items-start gap-3 rounded-xl border border-border p-3 transition last:mb-0 hover:border-primary/25 hover:bg-muted/20"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><CalendarDays size={14} /></span><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold">{mp.hs_meeting_title || action.meeting?.summary || "Rendez-vous"}</div><div className="mt-0.5 truncate text-[11px] text-muted-foreground">Préparer le rendez-vous</div><div className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(meetingStart(action.meeting))}</div></div></Link>;
              }) : <div className="py-12 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600" /><div className="mt-2 text-[13px] font-semibold">Aucune action détectée</div><div className="mt-1 text-[11px] text-muted-foreground">Aucune tâche, relance, réunion ou appel exploitable ne remonte aujourd’hui.</div></div>}
            </div>
            <div className="border-t border-border p-3"><Button asChild variant="outline" size="sm" className="w-full"><Link href="/tasks">Gérer toutes les tâches</Link></Button></div>
          </section>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px]">
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><CalendarDays size={15} className="text-primary" /><h3 className="text-[14px] font-semibold">Rendez-vous du jour · équipe</h3></div><Badge variant="outline">{allMeetings.length}</Badge></div>
            <div className="mt-3 space-y-2">{allMeetings.slice(0, 5).map(meeting => { const mp = meeting.properties || {}; const start = meetingStart(meeting); return <div key={meeting.id || `${mp.hs_meeting_title}-${start}`} className="rounded-xl border border-border px-3 py-2.5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-[12px] font-semibold">{mp.hs_meeting_title || meeting.summary || "Rendez-vous"}</div><div className="mt-0.5 truncate text-[10px] text-muted-foreground">{mp.hs_meeting_location || meeting.location || "À distance / lieu non renseigné"}</div></div><Badge variant="secondary" className="text-[10px]">{formatTime(start)}</Badge></div></div>; })}{!allMeetings.length ? <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">Aucun rendez-vous aujourd’hui.</div> : null}</div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Target size={15} className="text-primary" /><h3 className="text-[14px] font-semibold">Relances du jour · équipe</h3></div><Badge variant="outline">{allReminders.length}</Badge></div>
            <div className="mt-3 space-y-2">{allReminders.slice(0, 5).map(contact => { const rp = contact.properties || {}; return <Link key={contact.id} href={`/contacts/${contact.id}`} className="block rounded-xl border border-border px-3 py-2.5 transition hover:border-primary/25 hover:bg-muted/20"><div className="truncate text-[12px] font-semibold">{fullName(contact)}</div><div className="mt-0.5 flex items-center justify-between gap-3 text-[10px] text-muted-foreground"><span className="truncate">{rp.company || rp.jobtitle || "Contact"}</span><span className="shrink-0">{formatTime(rp.date_prochaine_relance || rp.date_recyclage)}</span></div></Link>; })}{!allReminders.length ? <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">Aucune relance planifiée aujourd’hui.</div> : null}</div>
          </section>

          <aside className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between"><h3 className="text-[14px] font-semibold">Téléphonie</h3><span className={`h-2 w-2 rounded-full ${apiHealthy ? "bg-emerald-500" : "bg-amber-500"}`} /></div>
            <div className="mt-3 space-y-3 text-[11px]"><div><div className="text-muted-foreground">Onoff</div><div className="mt-0.5 font-medium">{!onoff?.configured ? "Clé non configurée" : onoff?.connected === false ? "Connexion à vérifier" : "Opérationnel"}</div></div><div><div className="text-muted-foreground">Dernier traitement</div><div className="mt-0.5 font-medium">{onoff?.latestProcessingStatus || "—"}</div></div><div><div className="text-muted-foreground">Plage d’appel</div><div className="mt-0.5 font-medium">{today?.callWindow || "08:00–19:00"} heure locale prospect</div></div><a href={ONOFF_EXTENSION_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline underline-offset-4">Extension Onoff <ExternalLink className="h-3 w-3" /></a></div>
            {onoff?.error ? <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-[10px] leading-4 text-amber-700 dark:text-amber-300">{onoff.error}</div> : null}
          </aside>
        </div>
      </div>

      {sessionCompany ? <ProspectionSession open={sessionOpen} onOpenChange={setSessionOpen} companies={[sessionCompany]} onOpenCompany={companyId => { window.location.href = `/companies/${companyId}`; }} /> : null}
    </div>
  );
}
