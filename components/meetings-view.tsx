"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowUpRight,
  BriefcaseBusiness,
  Bug,
  Building2,
  CalendarCheck2,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  FileText,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { CompanyDrawer } from "@/components/company-drawer";
import { ContactDrawer } from "@/components/contact-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type HubSpotObject = { id: string; properties: Record<string, string | null> };
type MeetingStatus = "SCHEDULED" | "COMPLETED" | "RESCHEDULED" | "NO_SHOW" | "CANCELED" | "UNREVIEWED";
type MeetingView = "all" | "today" | "upcoming" | "completed" | "no_show" | "canceled" | "rescheduled" | "no_next_action" | "presentation";
type MeetingAction = "complete" | "no_show" | "cancel" | "next_action" | "reschedule";

type Meeting = HubSpotObject & {
  associations: {
    contact: HubSpotObject | null;
    contacts: HubSpotObject[];
    company: HubSpotObject | null;
    companies: HubSpotObject[];
    deal: HubSpotObject | null;
    deals: HubSpotObject[];
  };
  derived: {
    status: MeetingStatus;
    startAt: string | null;
    endAt: string | null;
    isToday: boolean;
    isUpcoming: boolean;
    isAnomaly: boolean;
    nextActionAt: string | null;
    nextActionLabel: string | null;
    lastActivityAt: string | null;
    rebooked: boolean;
    isBrevo: boolean;
    isGoogle: boolean;
    isGandoPresentation: boolean;
  };
};

type Metrics = {
  booked: number;
  completed: number;
  upcoming: number;
  noShow: number;
  canceled: number;
  rescheduled: number;
  noNextAction: number;
  rebooked: number;
  showRate: number;
  noShowRate: number;
  opportunityRate: number;
  proposalRate: number;
  clientRate: number;
  presentations: number;
};

type Owner = { id: string; firstName?: string; lastName?: string; email?: string };
type SourceScope = { provider: "brevo"; marker: string; ownerId: string | null; ownerEmail: string | null };

type DebugReasons = {
  markerInBody: boolean;
  markerInLocation: boolean;
  brevoInTitle: boolean;
  brevoInSource: boolean;
  brevoInObjectSource: boolean;
  brevoMentionAnywhere: boolean;
};

type DebugRow = {
  id: string;
  title: string | null;
  startAt: string | null;
  endAt: string | null;
  outcome: string | null;
  included: boolean;
  matchedBySearch: boolean;
  reasons: DebugReasons;
};

type DebugData = {
  ownerId: string;
  ownerEmail: string;
  marker: string;
  scanned: number;
  limitHit: boolean;
  included: number;
  excluded: number;
  excludedByMarker: number;
  excludedBySearch: number;
  byMonth: Record<string, { total: number; included: number; excluded: number }>;
  rows: DebugRow[];
};

const VIEWS: Array<{ key: MeetingView; label: string }> = [
  { key: "all", label: "Tous" },
  { key: "today", label: "Aujourd’hui" },
  { key: "upcoming", label: "À venir" },
  { key: "completed", label: "Terminés" },
  { key: "no_show", label: "No-show" },
  { key: "canceled", label: "Annulés" },
  { key: "rescheduled", label: "À replanifier" },
  { key: "no_next_action", label: "Sans prochaine action" },
  { key: "presentation", label: "Présentations Gando" },
];

const STATUS_LABELS: Record<MeetingStatus, string> = {
  SCHEDULED: "Planifié",
  COMPLETED: "Terminé",
  RESCHEDULED: "Replanifié",
  NO_SHOW: "No-show",
  CANCELED: "Annulé",
  UNREVIEWED: "À traiter",
};

const OUTCOMES = [
  { value: "QUALIFIED", label: "Qualifié" },
  { value: "INTERESTED", label: "Intéressé" },
  { value: "PROPOSAL", label: "Proposition à envoyer" },
  { value: "SECOND_MEETING", label: "Second rendez-vous" },
  { value: "DECISION_MAKER", label: "Décideur à engager" },
  { value: "NURTURE", label: "Nurture" },
  { value: "TOO_EARLY", label: "Trop tôt" },
  { value: "NOT_QUALIFIED", label: "Non qualifié" },
  { value: "LOST", label: "Perdu" },
];

const ACTION_TITLES: Record<MeetingAction, string> = {
  complete: "Terminer le rendez-vous",
  no_show: "Marquer comme no-show",
  cancel: "Annuler et organiser la suite",
  next_action: "Créer la prochaine action",
  reschedule: "Replanifier le rendez-vous",
};

const ASSIGNMENT_STORAGE_KEY = "gando_gcal_assignments";

const emptyMetrics: Metrics = {
  booked: 0,
  completed: 0,
  upcoming: 0,
  noShow: 0,
  canceled: 0,
  rescheduled: 0,
  noNextAction: 0,
  rebooked: 0,
  showRate: 0,
  noShowRate: 0,
  opportunityRate: 0,
  proposalRate: 0,
  clientRate: 0,
  presentations: 0,
};

function formatDate(value?: string | null, withYear = false) {
  if (!value) return "Non renseigné";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Non renseigné";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(date);
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatRelative(value?: string | null) {
  if (!value) return "Jamais";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Non renseigné";
  const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
  if (days === 0) return "Aujourd’hui";
  if (days === 1) return "Demain";
  if (days === -1) return "Hier";
  if (days > 1 && days < 14) return `Dans ${days} jours`;
  if (days < -1 && days > -14) return `Il y a ${Math.abs(days)} jours`;
  return formatDate(value, true);
}

function toDateTimeLocal(date = new Date(Date.now() + 24 * 60 * 60 * 1000)) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toDateInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatMonthKey(key: string) {
  if (key === "sans-date") return "Sans date";
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date);
}

function contactName(contact: HubSpotObject | null) {
  if (!contact) return "Contact non associé";
  const p = contact.properties;
  return [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Contact sans nom";
}

function StatusBadge({ status, anomaly }: { status: MeetingStatus; anomaly?: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md border-border bg-muted/45 font-medium text-muted-foreground",
        (status === "SCHEDULED" || status === "COMPLETED") && "border-primary/20 bg-primary/[0.07] text-primary",
        anomaly && "border-primary/30 bg-primary/10 text-primary",
      )}
    >
      {anomaly ? <AlertCircle className="h-3 w-3" /> : status === "COMPLETED" ? <Check className="h-3 w-3" /> : null}
      {anomaly ? "Action manquante" : STATUS_LABELS[status]}
    </Badge>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-foreground">{value || "Non renseigné"}</div>
    </div>
  );
}

function MetricCard({ label, value, detail, emphasized }: { label: string; value: string | number; detail: string; emphasized?: boolean }) {
  return (
    <Card className={cn("p-4", emphasized && "border-primary/25 bg-primary/[0.035]")}>
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={cn("mt-2 text-2xl font-bold tracking-tight", emphasized && "text-primary")}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </Card>
  );
}

export function MeetingsView() {
  const [view, setView] = useState<MeetingView>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
const [owners, setOwners] = useState<Owner[]>([]);
  const [sourceScope, setSourceScope] = useState<SourceScope | null>(null);
  const [googleConnected, setGoogleConnected] = useState(true);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [preparing, setPreparing] = useState<Meeting | null>(null);
  const [assignDialog, setAssignDialog] = useState<Meeting | null>(null);
  const [manualContacts, setManualContacts] = useState<Record<string, HubSpotObject>>({});
  const [manualCompanies, setManualCompanies] = useState<Record<string, HubSpotObject>>({});
  const [actionDialog, setActionDialog] = useState<{ meeting: Meeting; action: MeetingAction } | null>(null);
  const [saving, setSaving] = useState(false);
  const [total, setTotal] = useState(0);
  const [commercialOutcome, setCommercialOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [qualified, setQualified] = useState(false);
  const [noShow, setNoShow] = useState(false);
  const [nextAction, setNextAction] = useState("");
  const [dueAt, setDueAt] = useState(() => toDateTimeLocal());
  const [newStart, setNewStart] = useState(() => toDateTimeLocal());
  const requestSequence = useRef(0);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugError, setDebugError] = useState("");
  const [debugStart, setDebugStart] = useState(() => {
    const now = new Date();
    return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [debugEnd, setDebugEnd] = useState(() => {
    const now = new Date();
    return toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  });

  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view") as MeetingView | null;
    if (requestedView && VIEWS.some(item => item.key === requestedView)) setView(requestedView);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    fetch("/api/owners")
      .then(response => response.json())
      .then(data => setOwners(data.results || []))
      .catch(() => setOwners([]));
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ASSIGNMENT_STORAGE_KEY);
      if (!raw) return;
      const assignments = JSON.parse(raw) as Record<string, { contactId?: string; companyId?: string }>;
      for (const [eventId, assignment] of Object.entries(assignments)) {
        if (assignment.contactId) {
          fetch(`/api/contacts/${encodeURIComponent(assignment.contactId)}`, { cache: "no-store" })
            .then(response => response.json())
            .then(data => {
              if (data?.contact?.properties) setManualContacts(previous => ({ ...previous, [eventId]: data.contact }));
            })
            .catch(() => null);
        }
        if (assignment.companyId) {
          fetch(`/api/companies/${encodeURIComponent(assignment.companyId)}`, { cache: "no-store" })
            .then(response => response.json())
            .then(data => {
              if (data?.company?.properties) setManualCompanies(previous => ({ ...previous, [eventId]: data.company }));
            })
            .catch(() => null);
        }
      }
    } catch {
      // Stockage local indisponible : l’assignation reste sans effet.
    }
  }, []);

  const load = useCallback(async (silent = false) => {
    const requestId = ++requestSequence.current;
    if (!silent) setLoading(true);
    setError("");
    try {
const params = new URLSearchParams({ view });
      if (debouncedQuery) params.set("query", debouncedQuery);
      const response = await fetch(`/api/meetings?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Impossible de charger les rendez-vous");
      if (requestId !== requestSequence.current) return;
setMeetings(data.results || []);
      setMetrics(data.metrics || emptyMetrics);
      setTotal(data.total || 0);
      setSourceScope(data.sourceScope || null);
      setGoogleConnected(typeof data.googleConnected === "boolean" ? data.googleConnected : true);
    } catch (loadError) {
      if (requestId !== requestSequence.current) return;
      setError(loadError instanceof Error ? loadError.message : "Erreur de chargement");
    } finally {
      if (!silent && requestId === requestSequence.current) setLoading(false);
    }
  }, [view, debouncedQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const ownerNames = useMemo(() => new Map(owners.map(item => [item.id, [item.firstName, item.lastName].filter(Boolean).join(" ") || item.email || item.id])), [owners]);

  const debugMonthKeys = useMemo(() => (debugData ? Object.keys(debugData.byMonth).sort().reverse() : []), [debugData]);
  const debugExcludedRows = useMemo(() => (debugData ? debugData.rows.filter(row => !row.included) : []), [debugData]);

  async function runDebug() {
    setDebugLoading(true);
    setDebugError("");
    try {
      const start = new Date(`${debugStart}T00:00:00`);
      const end = new Date(`${debugEnd}T00:00:00`);
      end.setDate(end.getDate() + 1);
      const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
      const response = await fetch(`/api/meetings/debug?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Impossible d’analyser les rendez-vous");
      setDebugData(data);
    } catch (reason) {
      setDebugError(reason instanceof Error ? reason.message : "Erreur de diagnostic");
    } finally {
      setDebugLoading(false);
    }
  }

  function openDebug() {
    setDebugOpen(true);
    if (!debugData) void runDebug();
  }

  function openAction(meeting: Meeting, action: MeetingAction) {
    setActionDialog({ meeting, action });
    setCommercialOutcome("");
    setNotes("");
    setQualified(false);
    setNoShow(false);
    setError("");
    setMessage("");
    setNextAction(action === "no_show" ? "Appeler pour replacer le rendez-vous" : action === "cancel" ? "Recontacter pour proposer un nouveau créneau" : "Envoyer le compte-rendu et confirmer la prochaine étape");
    setDueAt(toDateTimeLocal());
    setNewStart(toDateTimeLocal());
    setMessage("");
  }

  async function submitAction() {
    if (!actionDialog) return;
    setSaving(true);
    setError("");
    try {
      const effectiveAction = actionDialog.action === "complete" && noShow ? "no_show" : actionDialog.action;
      const body = effectiveAction === "reschedule"
        ? { action: "reschedule", newStart: new Date(newStart).toISOString(), ...(actionDialog.meeting.derived.isGoogle ? { source: actionDialog.meeting } : {}) }
        : {
            action: effectiveAction,
            commercialOutcome: effectiveAction === "complete" ? (commercialOutcome || undefined) : undefined,
            notes,
            qualified,
            nextAction,
            dueAt: new Date(dueAt).toISOString(),
            ...(actionDialog.meeting.derived.isGoogle ? { source: actionDialog.meeting } : {}),
          };
      const response = await fetch(`/api/meetings/${actionDialog.meeting.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "HubSpot a rejeté l’action");
      const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(" ")}` : "";
      if (actionDialog.meeting.derived.isGoogle) {
        setMessage(`Statut synchronisé avec le CRM ; tâche de relance créée.${warnings}`);
        toast.success("Statut synchronisé avec le CRM ; tâche de relance créée.");
      } else {
        setMessage(`HubSpot a été mis à jour.${warnings}`);
        toast.success("HubSpot a été mis à jour.");
      }
      if (Array.isArray(data.warnings) && data.warnings.length) toast.warning(data.warnings.join(" "));
      setActionDialog(null);
      await load(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d’enregistrer l’action");
      toast.error(saveError instanceof Error ? saveError.message : "Impossible d’enregistrer l’action");
    } finally {
      setSaving(false);
    }
  }

  async function saveAssignment(meeting: Meeting, contactId?: string, companyId?: string) {
    try {
      const raw = window.localStorage.getItem(ASSIGNMENT_STORAGE_KEY);
      const assignments = raw ? JSON.parse(raw) as Record<string, { contactId?: string; companyId?: string }> : {};
      assignments[meeting.id] = {
        ...assignments[meeting.id],
        ...(contactId ? { contactId } : {}),
        ...(companyId ? { companyId } : {}),
      };
      window.localStorage.setItem(ASSIGNMENT_STORAGE_KEY, JSON.stringify(assignments));
    } catch {
      // Stockage local indisponible : l’assignation ne sera pas conservée.
    }

    if (contactId) {
      try {
        const response = await fetch(`/api/contacts/${encodeURIComponent(contactId)}`, { cache: "no-store" });
        const data = await response.json();
        if (data?.contact?.properties) setManualContacts(previous => ({ ...previous, [meeting.id]: data.contact }));
      } catch {
        // La fiche contact reste visible après la prochaine synchronisation.
      }
    } else {
      setManualContacts(previous => { const next = { ...previous }; delete next[meeting.id]; return next; });
    }
    if (companyId) {
      try {
        const response = await fetch(`/api/companies/${encodeURIComponent(companyId)}`, { cache: "no-store" });
        const data = await response.json();
        if (data?.company?.properties) setManualCompanies(previous => ({ ...previous, [meeting.id]: data.company }));
      } catch {
        // La fiche entreprise reste visible après la prochaine synchronisation.
      }
    } else {
      setManualCompanies(previous => { const next = { ...previous }; delete next[meeting.id]; return next; });
    }
    setAssignDialog(null);
  }

  const isNoShowFlow = noShow || actionDialog?.action === "no_show";

  return (
    <div className="page-shell h-screen overflow-y-auto p-5 lg:px-7 lg:py-6 minari-scrollbar">
      <div className="mx-auto max-w-[1500px] space-y-5">
<header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <CalendarCheck2 className="h-4 w-4" /> Rendez-vous
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em]">Rendez-vous</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Tous les rendez-vous de Google Calendar et de HubSpot, sans exclusion.</p>
          </div>
<div className="flex items-center gap-2">
            {!googleConnected ? (
              <Button variant="outline" size="sm" asChild><a href="/api/auth/google">Connecter Google Calendar</a></Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={openDebug}><Bug className="mr-1.5 h-4 w-4" /> Diagnostic</Button>
            <Badge variant="outline" className="h-9 border-primary/20 bg-primary/[0.06] px-3 text-primary">{googleConnected ? "Google Calendar" : sourceScope?.ownerEmail ? `Owner : ${sourceScope.ownerEmail}` : "HubSpot"}</Badge>
            <Button variant="outline" size="icon" aria-label="Actualiser" onClick={() => void load()}><RefreshCw className={cn(loading && "animate-spin")} /></Button>
          </div>
        </header>

        {!googleConnected ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
            <span><AlertCircle className="mr-2 inline h-4 w-4 text-amber-500" /> Google Calendar n’est pas connecté : seuls les rendez-vous HubSpot s’affichent.</span>
            <Button size="sm" asChild><a href="/api/auth/google">Connecter Google Calendar</a></Button>
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label="Indicateurs rendez-vous">
          <MetricCard label="À venir" value={metrics.upcoming} detail={`${metrics.booked} rendez-vous suivis`} />
          <MetricCard label="Tenus" value={metrics.completed} detail={`${metrics.showRate}% de taux de présence`} />
          <MetricCard label="No-show" value={metrics.noShow} detail={`${metrics.noShowRate}% des rendez-vous décidés`} />
          <MetricCard label="Vers opportunité" value={`${metrics.opportunityRate}%`} detail={`${metrics.proposalRate}% proposition · ${metrics.clientRate}% client`} />
          <MetricCard label="À sécuriser" value={metrics.noNextAction} detail="Terminés sans activité future" emphasized={metrics.noNextAction > 0} />
          <MetricCard label="Présentations Gando" value={metrics.presentations} detail="via meet.brevo.com/gando-presentation" emphasized={metrics.presentations > 0} />
        </section>

        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          <span><strong className="text-foreground">{metrics.canceled}</strong> annulé{metrics.canceled > 1 ? "s" : ""}</span>
          <span><strong className="text-foreground">{metrics.rescheduled}</strong> replanifié{metrics.rescheduled > 1 ? "s" : ""}</span>
          <span><strong className="text-foreground">{metrics.rebooked}</strong> no-show rebooké{metrics.rebooked > 1 ? "s" : ""}</span>
          <span><strong className="text-foreground">{metrics.clientRate}%</strong> rendez-vous vers client</span>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 pt-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 gap-1 overflow-x-auto pb-1 minari-scrollbar" role="tablist" aria-label="Vues de rendez-vous">
                {VIEWS.map(item => (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={view === item.key}
                    onClick={() => setView(item.key)}
                    className={cn(
                      "shrink-0 rounded-md px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                      view === item.key && "bg-primary/10 text-primary",
                    )}
                  >
                    {item.label}
                    {item.key === "no_next_action" && metrics.noNextAction ? <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-[9px] text-primary-foreground">{metrics.noNextAction}</span> : null}
                    {item.key === "presentation" && metrics.presentations ? <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-[9px] text-primary-foreground">{metrics.presentations}</span> : null}
                  </button>
                ))}
              </div>
              <div className="relative pb-3 xl:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Société, contact ou deal" className="h-9 bg-card pl-9" />
              </div>
            </div>
          </div>

          {error ? <div className="m-4 rounded-lg border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm text-foreground"><AlertCircle className="mr-2 inline h-4 w-4 text-primary" />{error}</div> : null}
          {message ? <div className="m-4 rounded-lg border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm text-foreground"><Check className="mr-2 inline h-4 w-4 text-primary" />{message}</div> : null}

          <div className="divide-y divide-border">
            {loading ? (
              <div className="grid min-h-72 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : meetings.length ? meetings.map(meeting => {
              const meetingProperties = meeting.properties;
              const contact = meeting.associations.contact || manualContacts[meeting.id] || null;
              const contactProperties = contact?.properties;
              const company = meeting.associations.company || manualCompanies[meeting.id] || null;
              const companyProperties = company?.properties;
              const deal = meeting.associations.deal;
              const phone = contactProperties?.mobilephone || contactProperties?.phone;
              const source = meetingProperties.hs_activity_type || meetingProperties.hs_object_source_label || meetingProperties.hs_meeting_location_type;
              return (
                <article key={meeting.id} className="px-4 py-5 transition-colors hover:bg-muted/20 lg:px-5">
                  <div className="grid gap-5 lg:grid-cols-[160px_minmax(0,1fr)] lg:items-start 2xl:grid-cols-[176px_minmax(240px,1.15fr)_minmax(380px,2fr)_auto] 2xl:items-center">
                    <div>
                      <div className="text-sm font-bold capitalize text-foreground">{formatDate(meeting.derived.startAt, true)}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> {formatTime(meeting.derived.startAt)} – {formatTime(meeting.derived.endAt)}</div>
                      {meetingProperties.hs_meeting_location ? <div className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {meetingProperties.hs_meeting_location}</div> : null}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={meeting.derived.status} anomaly={meeting.derived.isAnomaly} />
                        {meetingProperties.__gcal_synced_at ? <Badge variant="outline" className="border-primary/25 bg-primary/[0.06] font-medium text-primary"><Check className="mr-1 h-3 w-3" /> Sync HubSpot</Badge> : null}
                        {meeting.derived.isGoogle ? <Badge variant="outline" className="border-border bg-muted/45 font-medium text-muted-foreground">Google Calendar</Badge> : null}
                        {meeting.derived.isBrevo ? <Badge variant="outline" className="border-border bg-muted/45 font-medium text-muted-foreground">Brevo</Badge> : null}
                        {meeting.derived.isGandoPresentation ? <Badge variant="outline" className="border-primary/30 bg-primary/10 font-medium text-primary"><Sparkles className="mr-1 h-3 w-3" /> Présentation Gando</Badge> : null}
                      </div>
                    </div>

                    <div className="min-w-0 lg:col-start-2 2xl:col-start-auto">
                      <button type="button" disabled={!company} onClick={() => setCompanyId(company?.id || null)} className="flex max-w-full items-center gap-2 text-left disabled:cursor-default">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-4 w-4" /></span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">{companyProperties?.name || contactProperties?.company || "Société non associée"}</span>
                          <span className="block truncate text-xs text-muted-foreground">{companyProperties?.domain || "Domaine non renseigné"}</span>
                        </span>
                      </button>
                      <button type="button" disabled={!contact} onClick={() => setContactId(contact?.id || null)} className="mt-2 flex max-w-full items-center gap-2 text-left text-sm disabled:cursor-default">
                        <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{contactName(contact)}</span>
                        {meeting.associations.contacts.length > 1 ? <span className="shrink-0 text-xs text-primary">+{meeting.associations.contacts.length - 1}</span> : null}
                      </button>
                      <div className="ml-5 truncate text-xs text-muted-foreground">{contactProperties?.jobtitle || "Fonction non renseignée"}</div>
                      {contact && (contactProperties?.email || phone) ? (
                        <div className="ml-5 mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                          {contactProperties?.email ? <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" /> {contactProperties.email}</span> : null}
                          {phone ? <span className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" /> {phone}</span> : null}
                        </div>
                      ) : null}
                      {meeting.derived.isGoogle && !contact && meetingProperties.gcal_attendee_emails ? (
                        <div className="ml-5 mt-1 truncate text-xs text-muted-foreground"><Mail className="mr-1 inline h-3 w-3" /> {meetingProperties.gcal_attendee_emails}</div>
                      ) : null}
                    </div>

                    <div className="min-w-0 lg:col-start-2 2xl:col-start-auto">
                      <div className="truncate text-sm font-semibold">{meetingProperties.hs_meeting_title || "Rendez-vous sans titre"}</div>
                      <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3 lg:grid-cols-4">
                        <Field label="Commercial" value={ownerNames.get(meetingProperties.hubspot_owner_id || "") || meetingProperties.hubspot_owner_id} />
                        <Field label="Type / source" value={source} />
                        <Field label="Deal" value={deal?.properties.dealname} />
                        <Field label="Dernière activité" value={formatRelative(meeting.derived.lastActivityAt)} />
                      </div>
                      <div className={cn("mt-3 flex items-start gap-2 rounded-lg bg-muted/55 px-3 py-2 text-xs text-muted-foreground", meeting.derived.isAnomaly && "bg-primary/[0.07] text-foreground")}>
                        <ArrowUpRight className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", meeting.derived.isAnomaly && "text-primary")} />
                        <span><span className="font-semibold text-foreground">Prochaine action :</span> {meeting.derived.nextActionLabel || (meeting.derived.nextActionAt ? "Activité HubSpot planifiée" : "aucune")} {meeting.derived.nextActionAt ? `· ${formatRelative(meeting.derived.nextActionAt)}` : ""}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:col-start-2 2xl:col-start-auto 2xl:flex-nowrap 2xl:justify-end">
                      <Button variant="outline" size="sm" onClick={() => setPreparing(meeting)}><Sparkles /> Préparer</Button>
                      <Button variant="outline" size="sm" onClick={() => setAssignDialog(meeting)}><UserRound /> Associer</Button>
                      {meeting.derived.status === "SCHEDULED" || meeting.derived.status === "UNREVIEWED" ? <Button size="sm" onClick={() => openAction(meeting, "complete")}><Check /> Terminer</Button> : null}
                      {meeting.derived.isAnomaly ? <Button size="sm" onClick={() => openAction(meeting, "next_action")}><ArrowUpRight /> Agir</Button> : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Autres actions"><ChevronDown /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60">
                          {company ? <DropdownMenuItem onClick={() => setCompanyId(company.id)}><Building2 /> Ouvrir la société</DropdownMenuItem> : null}
                          {contact ? <DropdownMenuItem onClick={() => setContactId(contact.id)}><UserRound /> Ouvrir le contact</DropdownMenuItem> : null}
                          <DropdownMenuSeparator />
                          {phone ? <DropdownMenuItem asChild><a href={`tel:${phone}`}><Phone /> Appeler {phone}</a></DropdownMenuItem> : null}
                          {contactProperties?.email ? <DropdownMenuItem asChild><a href={`mailto:${contactProperties.email}`}><Mail /> Envoyer un email</a></DropdownMenuItem> : null}
                          {contactProperties?.hs_linkedin_url ? <DropdownMenuItem asChild><a href={contactProperties.hs_linkedin_url} target="_blank" rel="noreferrer"><Linkedin /> Ouvrir LinkedIn</a></DropdownMenuItem> : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openAction(meeting, "next_action")}><ArrowUpRight /> Créer la prochaine action</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAction(meeting, "reschedule")}><CalendarClock /> Replanifier</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAction(meeting, "no_show")}><UserRound /> Marquer no-show</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAction(meeting, "cancel")}><X /> Annuler le rendez-vous</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </article>
              );
            }) : (
              <div className="grid min-h-72 place-items-center px-6 text-center">
                <div>
                  <CalendarCheck2 className="mx-auto h-8 w-8 text-primary/60" />
                  <div className="mt-3 font-semibold">Aucun rendez-vous dans cette vue</div>
                  <div className="mt-1 text-sm text-muted-foreground">Aucun rendez-vous HubSpot ne correspond à cette vue.</div>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">{meetings.length} rendez-vous dans cette vue · {total} au total{sourceScope?.ownerEmail ? ` · owner ${sourceScope.ownerEmail}` : " · tous les owners"}</div>
        </Card>
      </div>

      <ContactDrawer contactId={contactId} open={Boolean(contactId)} onOpenChange={open => !open && setContactId(null)} onUpdated={() => void load(true)} />
      <CompanyDrawer companyId={companyId} open={Boolean(companyId)} onOpenChange={open => !open && setCompanyId(null)} />

      <Dialog open={Boolean(preparing)} onOpenChange={open => !open && setPreparing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto minari-scrollbar">
          <DialogHeader>
            <DialogTitle>Brief de préparation</DialogTitle>
            <DialogDescription>Résumé factuel produit uniquement à partir des données CRM disponibles.</DialogDescription>
          </DialogHeader>
          {preparing ? <PreparationBrief meeting={preparing} ownerName={ownerNames.get(preparing.properties.hubspot_owner_id || "")} manualContact={manualContacts[preparing.id]} manualCompany={manualCompanies[preparing.id]} /> : null}
          <DialogFooter><Button variant="outline" onClick={() => setPreparing(null)}>Fermer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {assignDialog ? (
        <AssignDialog
          meeting={assignDialog}
          onClose={() => setAssignDialog(null)}
          onSave={(contactId, companyId) => void saveAssignment(assignDialog, contactId, companyId)}
        />
      ) : null}

      <Dialog open={Boolean(actionDialog)} onOpenChange={open => !open && !saving && setActionDialog(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{actionDialog ? ACTION_TITLES[actionDialog.action] : "Action"}</DialogTitle>
            <DialogDescription>{actionDialog?.meeting.associations.company?.properties.name || actionDialog?.meeting.properties.hs_meeting_title || "Rendez-vous HubSpot"}</DialogDescription>
          </DialogHeader>
          {actionDialog ? (
            <div className="space-y-4">
              {actionDialog.action === "reschedule" ? (
                <div className="space-y-2">
                  <Label htmlFor="newStart">Nouveau créneau</Label>
                  <Input id="newStart" type="datetime-local" value={newStart} onChange={event => setNewStart(event.target.value)} />
                  <p className="text-xs text-muted-foreground">L’ancien rendez-vous sera conservé comme replanifié et un nouveau rendez-vous planifié sera créé avec les mêmes associations.</p>
                </div>
              ) : (
                <>
                  {actionDialog.action === "complete" ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Rendez-vous non honoré (no-show)</Label>
                        <Select value={noShow ? "true" : "false"} onValueChange={value => { const checked = value === "true"; setNoShow(checked); if (checked) setNextAction("Appeler pour replacer le rendez-vous"); }}>
                          <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="false">Non</SelectItem>
                            <SelectItem value="true">Oui</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {noShow ? (
                        <p className="text-xs text-muted-foreground">Le rendez-vous sera marqué comme no-show : il comptera dans le taux d’absence, restera visible pour une replanification, et une tâche d’appel téléphonique « Appeler pour replacer le rendez-vous » sera créée (échéance : 3 jours).</p>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Résultat commercial</Label>
                            <Select value={commercialOutcome} onValueChange={setCommercialOutcome}>
                              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                              <SelectContent>{OUTCOMES.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <label className="flex items-end gap-2 pb-2 text-sm font-medium">
                            <input type="checkbox" checked={qualified} onChange={event => setQualified(event.target.checked)} className="h-4 w-4 accent-violet-600" />
                            Opportunité qualifiée
                          </label>
                        </div>
                      )}
                    </div>
                  ) : null}
                  {!(actionDialog.action === "complete" && noShow) ? (
                    <>
                      {actionDialog.action !== "next_action" ? (
                        <div className="space-y-2">
                          <Label htmlFor="meetingNotes">{isNoShowFlow ? "Notes (facultatif)" : "Notes obligatoires"}</Label>
                          <textarea id="meetingNotes" value={notes} onChange={event => setNotes(event.target.value)} rows={4} placeholder={isNoShowFlow ? "Éventuel contexte utile pour la relance…" : "Faits, objections, décision et contexte utile…"} className="w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10" />
                        </div>
                      ) : null}
                      <div className="space-y-2">
                        <Label htmlFor="nextAction">{isNoShowFlow ? "Prochaine action (facultatif)" : "Prochaine action"}</Label>
                        <Input id="nextAction" value={nextAction} onChange={event => setNextAction(event.target.value)} placeholder={isNoShowFlow ? "Appeler pour replacer le rendez-vous" : "Ex. Envoyer la proposition"} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dueAt">{isNoShowFlow ? "Date d’échéance (facultatif)" : "Date d’échéance"}</Label>
                        <Input id="dueAt" type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} />
                      </div>
                      {isNoShowFlow ? <p className="text-xs leading-5 text-muted-foreground">Une tâche d’appel téléphonique « Appeler pour replacer le rendez-vous » sera créée automatiquement (échéance par défaut : 3 jours).</p> : <p className="text-xs leading-5 text-muted-foreground">Une tâche HubSpot sera créée et associée au contact, à la société et au deal liés au rendez-vous.</p>}
                    </>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
          {error ? <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"><AlertCircle className="mr-1.5 inline h-4 w-4" />{error}</div> : null}
          {message ? <div className="rounded-lg border border-primary/20 bg-primary/[0.06] px-3 py-2 text-sm text-foreground"><Check className="mr-1.5 inline h-4 w-4 text-primary" />{message}</div> : null}
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setActionDialog(null)}>Annuler</Button>
            <Button disabled={saving} onClick={() => void submitAction()}>{saving ? <Loader2 className="animate-spin" /> : <Check />} Enregistrer dans HubSpot</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={debugOpen} onOpenChange={open => !open && setDebugOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto minari-scrollbar">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Bug className="h-4 w-4 text-primary" /> Diagnostic des rendez-vous Brevo</DialogTitle>
            <DialogDescription>Analyse de tous les rendez-vous du propriétaire {debugData?.ownerEmail || sourceScope?.ownerEmail || "sales@gando.app"} pour voir lesquels sont marqués Brevo.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/35 p-3">
            <label className="space-y-1.5"><span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Du</span><Input type="date" value={debugStart} onChange={event => setDebugStart(event.target.value)} className="h-9 w-[160px] bg-card" /></label>
            <label className="space-y-1.5"><span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Au</span><Input type="date" value={debugEnd} onChange={event => setDebugEnd(event.target.value)} className="h-9 w-[160px] bg-card" /></label>
            <Button size="sm" onClick={() => void runDebug()} disabled={debugLoading}>{debugLoading ? <Loader2 className="animate-spin" /> : <Bug />} Analyser</Button>
          </div>

          {debugError ? <div role="alert" className="mt-4 rounded-lg border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm text-foreground"><AlertCircle className="mr-2 inline h-4 w-4 text-primary" />{debugError}</div> : null}

          {debugLoading ? (
            <div className="grid min-h-48 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : debugData ? (
            <div className="space-y-5">
              {debugData.limitHit ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">Analyse limitée à {debugData.scanned} rendez-vous (cap de sécurité). Réduisez la période pour un détail complet.</div> : null}

              <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard label="Rendez-vous scannés" value={debugData.scanned} detail={debugData.limitHit ? "cap de sécurité atteint" : "sur la période"} />
                <MetricCard label="Marqués Brevo" value={debugData.included} detail="avec marqueur meet.brevo.com" emphasized />
                <MetricCard label="Mentionnent Brevo" value={debugData.excludedByMarker} detail="sans le domaine dans body/location" />
                <MetricCard label="Aucune mention Brevo" value={debugData.excludedBySearch} detail="réservés ailleurs ou saisis à la main" />
              </section>

              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs leading-5 text-muted-foreground">
                <p className="font-semibold text-foreground">Règle actuelle</p>
                <p className="mt-1"><strong className="text-foreground">Tous les rendez-vous du compte</strong> sont désormais affichés. Un rendez-vous est <strong className="text-foreground">marqué « Brevo »</strong> s’il contient <code className="font-mono">meet.brevo.com</code> dans le corps (<code className="font-mono">hs_meeting_body</code>) ou la localisation (<code className="font-mono">hs_meeting_location</code>), ou le marqueur <code className="font-mono">meet.brevo.com/gando-presentation</code>.</p>
                <p className="mt-1.5"><strong className="text-foreground">Mentionnent Brevo</strong> : le rendez-vous parle de Brevo (titre, source…) mais le domaine n’est pas dans body/location → affiché sans badge « Brevo ».</p>
                <p className="mt-1.5"><strong className="text-foreground">Aucune mention Brevo</strong> : rendez-vous réservés ailleurs (Google Meet, Zoom…) ou saisis à la main dans HubSpot → affichés sans badge « Brevo ».</p>
              </div>

              <section>
                <h3 className="text-sm font-semibold">Répartition par mois</h3>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-3 font-semibold">Mois</th>
                        <th className="py-2 pr-3 font-semibold">Total</th>
                        <th className="py-2 pr-3 font-semibold">Inclus</th>
                        <th className="py-2 pr-3 font-semibold">Exclus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {debugMonthKeys.map(key => {
                        const bucket = debugData.byMonth[key];
                        return (
                          <tr key={key}>
                            <td className="py-2 pr-3 font-medium">{formatMonthKey(key)}</td>
                            <td className="py-2 pr-3 text-muted-foreground">{bucket.total}</td>
                            <td className="py-2 pr-3 font-semibold text-primary">{bucket.included}</td>
                            <td className="py-2 font-semibold">{bucket.excluded}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold">Rendez-vous non marqués Brevo ({debugExcludedRows.length})</h3>
                {debugExcludedRows.length ? (
                  <div className="mt-2 space-y-2">
                    {debugExcludedRows.map(row => (
                      <div key={row.id} className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{row.title || "Rendez-vous sans titre"}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {row.startAt ? `${formatDate(row.startAt, true)} · ${formatTime(row.startAt)}` : "Sans date"}
                              {row.outcome ? ` · ${STATUS_LABELS[row.outcome as MeetingStatus] || row.outcome}` : ""}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {!row.matchedBySearch ? (
                              <Badge variant="outline" className="bg-muted/60 font-medium text-muted-foreground">Aucune mention « Brevo »</Badge>
                            ) : (
                              <Badge variant="outline" className="border-primary/25 bg-primary/[0.08] font-medium text-primary">Marqueur absent</Badge>
                            )}
                            {row.reasons.brevoInTitle ? <Badge variant="outline" className="bg-muted/60 font-medium">« Brevo » dans le titre</Badge> : null}
                            {row.reasons.brevoInSource ? <Badge variant="outline" className="bg-muted/60 font-medium">« Brevo » dans la source</Badge> : null}
                            {row.reasons.brevoInObjectSource ? <Badge variant="outline" className="bg-muted/60 font-medium">« Brevo » dans l’objet source</Badge> : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Tous les rendez-vous de la période sont marqués Brevo.</p>
                )}
              </section>
            </div>
          ) : null}

          <DialogFooter><Button variant="outline" onClick={() => setDebugOpen(false)}>Fermer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PreparationBrief({ meeting, ownerName, manualContact, manualCompany }: { meeting: Meeting; ownerName?: string; manualContact?: HubSpotObject | null; manualCompany?: HubSpotObject | null }) {
  const contact = (meeting.associations.contact || manualContact || null)?.properties;
  const company = (meeting.associations.company || manualCompany || null)?.properties;
  const deal = meeting.associations.deal?.properties;
  const missing = [
    !company?.name && "société associée",
    !company?.industry && "secteur d’activité",
    !contact?.jobtitle && "fonction du contact",
    !deal?.dealname && "opportunité associée",
    !meeting.properties.hs_meeting_body && "agenda ou contexte du rendez-vous",
    !meeting.derived.nextActionLabel && "prochaine étape du deal",
  ].filter(Boolean) as string[];
  const body = meeting.properties.hs_meeting_body?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-2">
        <Field label="Société" value={company?.name} />
        <Field label="Contact" value={contactName(meeting.associations.contact || manualContact || null)} />
        <Field label="Fonction" value={contact?.jobtitle} />
        <Field label="Email" value={contact?.email} />
        <Field label="Téléphone" value={contact?.mobilephone || contact?.phone} />
        <Field label="Commercial" value={ownerName} />
        <Field label="Deal" value={deal?.dealname} />
        <Field label="Montant" value={deal?.amount ? `${Number(deal.amount).toLocaleString("fr-FR")} €` : null} />
      </div>
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" /> Contexte disponible</h3>
        <p className="mt-2 rounded-lg bg-muted/45 p-3 text-sm leading-6 text-muted-foreground">{body || "Aucun agenda ni contexte n’est renseigné dans l’activité HubSpot."}</p>
      </section>
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold"><BriefcaseBusiness className="h-4 w-4 text-primary" /> Points à valider pendant l’échange</h3>
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
          <li>• Quel problème prioritaire le prospect veut-il résoudre maintenant ?</li>
          <li>• Qui participe à la décision et selon quel calendrier ?</li>
          <li>• Quelle prochaine étape précise doit être datée avant la fin du rendez-vous ?</li>
        </ul>
      </section>
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold"><AlertCircle className="h-4 w-4 text-primary" /> Informations manquantes</h3>
        {missing.length ? <div className="mt-2 flex flex-wrap gap-2">{missing.map(item => <Badge key={item} variant="outline" className="bg-muted/45 font-medium">{item}</Badge>)}</div> : <p className="mt-2 text-sm text-muted-foreground">Les informations essentielles sont présentes dans le CRM.</p>}
      </section>
    </div>
  );
}

function AssignDialog({ meeting, onClose, onSave }: { meeting: Meeting; onClose: () => void; onSave: (contactId?: string, companyId?: string) => void }) {
  const initialContact = meeting.associations.contact || null;
  const initialCompany = meeting.associations.company || null;
  const [contactQuery, setContactQuery] = useState(() => meeting.properties.gcal_attendee_emails?.split(",")[0]?.trim() || "");
  const [contactResults, setContactResults] = useState<HubSpotObject[]>([]);
  const [selectedContact, setSelectedContact] = useState<HubSpotObject | null>(initialContact);
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyResults, setCompanyResults] = useState<HubSpotObject[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<HubSpotObject | null>(initialCompany);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!contactQuery.trim()) { setContactResults([]); return; }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/contacts?q=${encodeURIComponent(contactQuery.trim())}`, { cache: "no-store" });
        const data = await response.json();
        setContactResults((data.results || []).slice(0, 8));
      } catch {
        setContactResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [contactQuery]);

  useEffect(() => {
    if (!companyQuery.trim()) { setCompanyResults([]); return; }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/companies?q=${encodeURIComponent(companyQuery.trim())}`, { cache: "no-store" });
        const data = await response.json();
        setCompanyResults((data.results || []).slice(0, 8));
      } catch {
        setCompanyResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [companyQuery]);

  const attendeeEmails = meeting.properties.gcal_attendee_emails?.split(",").map(email => email.trim()).filter(Boolean) || [];

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" /> Associer un contact et une entreprise</DialogTitle>
          <DialogDescription>Rattache ce rendez-vous à des fiches HubSpot pour afficher prénom, nom, email et téléphone. L’association est conservée dans ce navigateur.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Contact</Label>
            {attendeeEmails.length ? <p className="text-xs text-muted-foreground">Participants Google : {attendeeEmails.join(", ")}</p> : null}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={contactQuery} onChange={event => setContactQuery(event.target.value)} placeholder="Rechercher par nom, email ou téléphone…" className="h-9 bg-card pl-9" />
            </div>
            {searching ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Recherche…</div> : null}
            {contactResults.length ? (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border bg-card p-1 minari-scrollbar">
                {contactResults.map(candidate => {
                  const p = candidate.properties;
                  const name = [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Contact sans nom";
                  const selected = selectedContact?.id === candidate.id;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => { setSelectedContact(candidate); setContactQuery(name); setContactResults([]); }}
                      className={cn("flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted", selected && "bg-primary/10")}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{[p.email, p.mobilephone || p.phone, p.company].filter(Boolean).join(" · ") || "Aucune coordonnée"}</span>
                      </span>
                      {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                    </button>
                  );
                })}
              </div>
            ) : selectedContact ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  <span className="block truncate font-semibold text-foreground">{contactName(selectedContact)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[selectedContact.properties.email, selectedContact.properties.mobilephone || selectedContact.properties.phone].filter(Boolean).join(" · ")}</span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedContact(null)}><X className="h-4 w-4" /></Button>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Entreprise</Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={companyQuery} onChange={event => setCompanyQuery(event.target.value)} placeholder="Rechercher par nom, domaine ou ville…" className="h-9 bg-card pl-9" />
            </div>
            {companyResults.length ? (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border bg-card p-1 minari-scrollbar">
                {companyResults.map(candidate => {
                  const p = candidate.properties;
                  const selected = selectedCompany?.id === candidate.id;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => { setSelectedCompany(candidate); setCompanyQuery(p.name || ""); setCompanyResults([]); }}
                      className={cn("flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted", selected && "bg-primary/10")}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.name || "Entreprise sans nom"}</span>
                        <span className="block truncate text-xs text-muted-foreground">{[p.domain, p.city].filter(Boolean).join(" · ")}</span>
                      </span>
                      {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                    </button>
                  );
                })}
              </div>
            ) : selectedCompany ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-semibold text-foreground">{selectedCompany.properties.name || "Entreprise sans nom"}</span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedCompany(null)}><X className="h-4 w-4" /></Button>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={!selectedContact && !selectedCompany} onClick={() => onSave(selectedContact?.id, selectedCompany?.id)}>
            <Check /> Associer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
