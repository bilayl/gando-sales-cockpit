"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Database,
  ListFilter,
  Loader2,
  MapPin,
  Phone,
  Play,
  Plus,
  RefreshCw,
  Search,
  SquareKanban,
  Table2,
  Users,
  X,
} from "lucide-react";
import { ContactDrawer } from "@/components/contact-drawer";
import { NewCompanyDialog } from "@/components/new-company-dialog";
import { NewContactDialog } from "@/components/new-contact-dialog";
import { ProspectionBoard } from "@/components/prospection-board";
import { SalesCallDecisionControls } from "@/components/sales-call-decision-controls";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  compareContactProspectionPriority,
  getContactProspectionDecision,
  type ContactProspectionDecision,
} from "@/lib/contact-prospection-priority";
import type { ProspectionBucket } from "@/lib/company-prospection-priority";
import { fetchAllPagedResults } from "@/lib/fetch-all-paged-results";
import {
  PROSPECTION_SEGMENT_PREFS_EVENT,
  orderVisibleContactSegments,
  readProspectionSegmentPreferences,
  type ProspectionSegmentPreferences,
} from "@/lib/prospection-segment-preferences";
import { formatDate, initials } from "@/lib/utils";

type Contact = { id: string; properties: Record<string, string | null | undefined> };
type List = { listId: string; name: string; objectTypeId: string; size?: number };
type Owner = { id: string; firstName?: string; lastName?: string; email?: string };
type ViewMode = "board" | "table";
type WorkFilter = ProspectionBucket | "ALL";
type RecommendationSummary = { ACTIONABLE: number; OPPORTUNITY: number; SNOOZED: number; EXCLUDED: number };
type RecommendationBucket = keyof RecommendationSummary;
type SessionMeta = { id: string; name: string; remaining: number; totalItems: number };

const CALL_RECOMMENDATIONS_SEGMENT = "__database_call_recommendations__";
const EMPTY_SUMMARY: RecommendationSummary = { ACTIONABLE: 0, OPPORTUNITY: 0, SNOOZED: 0, EXCLUDED: 0 };
const PROSPECTION_OPTIONS = ["À prospecter", "En prospection", "Conversation", "RDV booké", "À recycler", "Non qualifié", "Perdu"];
const CALL_LABELS: Record<string, string> = {
  interesse: "Intéressé",
  "intéressé": "Intéressé",
  "intéressé mais": "Intéressé mais",
  "a rappeler": "À rappeler",
  "à rappeler": "À rappeler",
  nrp: "NRP",
  occupe: "Occupé",
  "occupé": "Occupé",
  "hors cible": "Hors cible",
  "pas intéressé": "Pas intéressé",
  "pas interesse": "Pas intéressé",
  "en attente décision": "En attente décision",
  "en attente decision": "En attente décision",
  "numéro invalide": "Numéro invalide",
  "numero invalide": "Numéro invalide",
};

function callLabel(value?: string | null) {
  if (!value) return "—";
  return CALL_LABELS[String(value).trim().toLowerCase()] || value;
}

function reminderValue(properties: Record<string, string | null | undefined>) {
  return properties.date_prochaine_relance
    || properties.qualification_next_action_at
    || properties.date_de_rappel
    || properties.notes_next_activity_date;
}

function contactLocation(properties: Record<string, string | null | undefined>) {
  return [properties.zip, properties.city, properties.state, properties.country].filter(Boolean).join(" · ") || "—";
}

function databaseDecision(contact: Contact): ContactProspectionDecision {
  const p = contact.properties;
  const score = Number(p.db_call_score || 0);
  return {
    bucket: (p.db_call_bucket as ProspectionBucket) || "ACTIONABLE",
    priority: Math.max(1, 101 - score),
    priorityLabel: p.db_call_priority_label || `Score ${score}/100`,
    reason: p.db_call_reason || "Contact noté par la base de données",
    suggestion: p.db_call_action || "Appeler et qualifier",
  };
}

export function ContactFirstProspectionView() {
  const [lists, setLists] = useState<List[]>([]);
  const [segmentPreferences, setSegmentPreferences] = useState<ProspectionSegmentPreferences>({});
  const [owners, setOwners] = useState<Owner[]>([]);
  const [segmentId, setSegmentId] = useState(CALL_RECOMMENDATIONS_SEGMENT);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sessionCreating, setSessionCreating] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [owner, setOwner] = useState("");
  const [prospectionStatus, setProspectionStatus] = useState("");
  const [workFilter, setWorkFilter] = useState<WorkFilter>("ACTIONABLE");
  const [recommendationBucket, setRecommendationBucket] = useState<RecommendationBucket>("ACTIONABLE");
  const [view, setView] = useState<ViewMode>("table");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [newCompanyOpen, setNewCompanyOpen] = useState(false);
  const [recommendationSummary, setRecommendationSummary] = useState<RecommendationSummary>(EMPTY_SUMMARY);
  const [recommendationEvaluatedAt, setRecommendationEvaluatedAt] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionMeta, setSessionMeta] = useState<SessionMeta | null>(null);

  const isRecommendationSegment = segmentId === CALL_RECOMMENDATIONS_SEGMENT;

  useEffect(() => {
    const initialPreferences = readProspectionSegmentPreferences();
    setSegmentPreferences(initialPreferences);

    Promise.all([
      fetch("/api/segments", { cache: "no-store" }).then(response => response.json()),
      fetch("/api/owners", { cache: "no-store" }).then(response => response.json()),
    ])
      .then(([segmentData, ownerData]) => {
        const contactLists = ((segmentData.lists || []) as List[]).filter(item => item.objectTypeId === "0-1");
        setLists(contactLists);
        setOwners(ownerData.results || []);
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : "Impossible de charger la prospection contacts"));

    const refreshPreferences = () => setSegmentPreferences(readProspectionSegmentPreferences());
    window.addEventListener(PROSPECTION_SEGMENT_PREFS_EVENT, refreshPreferences);
    window.addEventListener("storage", refreshPreferences);
    return () => {
      window.removeEventListener(PROSPECTION_SEGMENT_PREFS_EVENT, refreshPreferences);
      window.removeEventListener("storage", refreshPreferences);
    };
  }, []);

  const visibleLists = useMemo(
    () => orderVisibleContactSegments(lists, segmentPreferences),
    [lists, segmentPreferences],
  );

  useEffect(() => {
    if (!segmentId || segmentId === CALL_RECOMMENDATIONS_SEGMENT) return;
    if (!visibleLists.some(item => item.listId === segmentId)) {
      setSegmentId(CALL_RECOMMENDATIONS_SEGMENT);
      setActiveSessionId(null);
      setSessionMeta(null);
    }
  }, [visibleLists, segmentId]);

  const ownerNames = useMemo(() => Object.fromEntries(owners.map(item => [
    item.id,
    [item.firstName, item.lastName].filter(Boolean).join(" ") || item.email || item.id,
  ])), [owners]);

  async function load(silent = false, forceRecommendationRefresh = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      if (isRecommendationSegment) {
        if (activeSessionId) {
          const response = await fetch(`/api/call-recommendations/sessions?id=${encodeURIComponent(activeSessionId)}`, { cache: "no-store" });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || payload.message || "Impossible de charger la session d'appels");
          setContacts(payload.results || []);
          setTotal(payload.remaining || 0);
          setSessionMeta({ id: payload.session.id, name: payload.session.name, remaining: payload.remaining || 0, totalItems: payload.totalItems || 0 });
          return;
        }

        const params = new URLSearchParams({ bucket: recommendationBucket, limit: "2000" });
        if (forceRecommendationRefresh) params.set("refresh", "1");
        const response = await fetch(`/api/call-recommendations?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || payload.message || "Impossible de charger les suggestions d'appels");
        setContacts(payload.results || []);
        setTotal(payload.total || payload.results?.length || 0);
        setRecommendationSummary(payload.summary || EMPTY_SUMMARY);
        setRecommendationEvaluatedAt(payload.evaluatedAt || null);
        return;
      }

      const params = new URLSearchParams();
      if (segmentId) params.set("segmentId", segmentId);
      if (!segmentId && query) params.set("q", query);
      if (!segmentId && owner) params.set("owner", owner);
      if (!segmentId && prospectionStatus) params.set("prospection", prospectionStatus);
      const payload = await fetchAllPagedResults<Contact>(`/api/contacts?${params.toString()}`);
      setContacts(payload.results);
      setTotal(payload.total);
      if (payload.truncated) setError("Le volume est très important : seuls les 10 000 premiers contacts ont été chargés.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur de chargement");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [segmentId, recommendationBucket, activeSessionId]);

  useEffect(() => {
    if (!isRecommendationSegment) return;
    setView("table");
    setWorkFilter("ACTIONABLE");
  }, [isRecommendationSegment]);

  const baseFiltered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const locationNeedle = locationQuery.trim().toLowerCase();
    return contacts.filter(contact => {
      const p = contact.properties;
      const haystack = [p.firstname, p.lastname, p.email, p.phone, p.mobilephone, p.company, p.jobtitle]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const locationHaystack = [p.zip, p.city, p.state, p.country].filter(Boolean).join(" ").toLowerCase();
      return (!needle || haystack.includes(needle))
        && (!locationNeedle || locationHaystack.includes(locationNeedle))
        && (!owner || p.hubspot_owner_id === owner)
        && (!prospectionStatus || p.statut_prospection === prospectionStatus);
    });
  }, [contacts, query, locationQuery, owner, prospectionStatus]);

  const classified = useMemo(() => {
    if (isRecommendationSegment) {
      return baseFiltered
        .slice()
        .sort((a, b) => Number(b.properties.db_call_score || 0) - Number(a.properties.db_call_score || 0))
        .map(contact => ({ contact, decision: databaseDecision(contact) }));
    }
    const now = Date.now();
    return baseFiltered
      .slice()
      .sort((a, b) => compareContactProspectionPriority(a, b, now))
      .map(contact => ({ contact, decision: getContactProspectionDecision(contact, now) }));
  }, [baseFiltered, isRecommendationSegment]);

  const filteredContacts = useMemo(
    () => classified
      .filter(item => isRecommendationSegment || workFilter === "ALL" || item.decision.bucket === workFilter)
      .map(item => item.contact),
    [classified, workFilter, isRecommendationSegment],
  );

  const actionableCount = isRecommendationSegment
    ? recommendationSummary.ACTIONABLE
    : classified.filter(item => item.decision.bucket === "ACTIONABLE").length;
  const opportunities = isRecommendationSegment
    ? recommendationSummary.OPPORTUNITY
    : classified.filter(item => item.decision.bucket === "OPPORTUNITY").length;
  const snoozed = isRecommendationSegment
    ? recommendationSummary.SNOOZED
    : classified.filter(item => item.decision.bucket === "SNOOZED").length;
  const excluded = isRecommendationSegment
    ? recommendationSummary.EXCLUDED
    : classified.filter(item => item.decision.bucket === "EXCLUDED").length;
  const currentList = visibleLists.find(item => item.listId === segmentId);
  const pageTitle = activeSessionId && sessionMeta ? sessionMeta.name : isRecommendationSegment ? "Suggestions d’appels" : currentList?.name || "Prospection par contact";

  async function sync() {
    setSyncing(true);
    setError("");
    try {
      const response = await fetch("/api/sync?resource=all");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Synchronisation impossible");
      await load(true, isRecommendationSegment);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur de synchronisation");
    } finally {
      setSyncing(false);
    }
  }

  async function createSession() {
    setSessionCreating(true);
    setError("");
    try {
      const response = await fetch("/api/call-recommendations/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ owner: owner || undefined, targetCount: 80 }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Impossible de créer la session d'appels");
      setActiveSessionId(payload.session.id);
      setSessionMeta({ id: payload.session.id, name: payload.session.name, remaining: payload.remaining || 0, totalItems: payload.totalItems || 0 });
      setContacts(payload.results || []);
      setTotal(payload.remaining || 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de créer la session d'appels");
    } finally {
      setSessionCreating(false);
    }
  }

  async function markSessionContact(contactId: string) {
    if (!activeSessionId) return;
    try {
      const response = await fetch("/api/call-recommendations/sessions", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: activeSessionId, contactId, status: "CALLED", outcome: "Traité dans le cockpit" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Impossible de mettre à jour la session");
      setContacts(payload.results || []);
      setTotal(payload.remaining || 0);
      setSessionMeta(current => current ? { ...current, remaining: payload.remaining || 0 } : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de mettre à jour la session");
    }
  }

  function leaveSession() {
    setSessionMeta(null);
    setActiveSessionId(null);
    setRecommendationBucket("ACTIONABLE");
  }

  function handleBoardStatusChange(contactId: string, status: string) {
    setContacts(current => current.map(contact => contact.id === contactId
      ? { ...contact, properties: { ...contact.properties, statut_prospection: status } }
      : contact));
    void load(true, isRecommendationSegment);
  }

  return (
    <div className="page-shell flex h-screen flex-col overflow-hidden">
      <div className="flex shrink-0 items-end gap-1.5 border-b border-border bg-card px-5 pt-3 minari-scrollbar">
        <div className="mb-2 flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
          <Button asChild size="sm" variant="ghost" className="h-8 gap-1.5 rounded-md px-3"><a href="/prospection"><Building2 size={14} /> Entreprises</a></Button>
          <Button size="sm" variant="secondary" className="h-8 gap-1.5 rounded-md px-3"><Users size={14} /> Contacts</Button>
        </div>
        <Button asChild variant="ghost" size="sm" className="mb-2 h-9 gap-2 px-3 font-semibold text-primary hover:bg-accent"><a href="/segments"><ListFilter size={15} /> Gérer les segments</a></Button>
        <div className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto">
          <button
            onClick={() => { setSegmentId(CALL_RECOMMENDATIONS_SEGMENT); leaveSession(); }}
            className={`relative flex h-11 shrink-0 items-center gap-2 rounded-t-xl border border-b-0 px-4 text-sm ${isRecommendationSegment ? "border-border bg-background font-semibold text-foreground before:absolute before:inset-x-3 before:top-0 before:h-[2px] before:bg-primary" : "border-transparent text-muted-foreground hover:bg-muted/60"}`}
          >
            <Database size={14} className="text-primary" /> Suggestions d’appels
            <Badge variant="secondary" className="text-[10px]">{recommendationSummary.ACTIONABLE}</Badge>
          </button>
          <button onClick={() => { leaveSession(); setSegmentId(""); }} className={`relative flex h-11 shrink-0 items-center rounded-t-xl border border-b-0 px-4 text-sm ${!segmentId ? "border-border bg-background font-semibold" : "border-transparent text-muted-foreground hover:bg-muted/60"}`}>Tous les contacts</button>
          {visibleLists.map(list => (
            <button key={list.listId} onClick={() => { leaveSession(); setSegmentId(list.listId); }} className={`relative flex h-11 shrink-0 items-center gap-2 rounded-t-xl border border-b-0 px-4 text-sm ${segmentId === list.listId ? "border-border bg-background font-semibold text-foreground before:absolute before:inset-x-3 before:top-0 before:h-[2px] before:bg-primary" : "border-transparent text-muted-foreground hover:bg-muted/60"}`}>
              <span className="max-w-[150px] truncate">{list.name}</span>
              {list.size !== undefined ? <Badge variant="secondary" className="text-[10px]">{list.size}</Badge> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-5 pt-4 lg:px-7">
        <Card className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <div>
              <h1 className="font-display text-lg font-bold tracking-tight">{pageTitle}</h1>
              {activeSessionId && sessionMeta ? (
                <p className="mt-0.5 text-xs text-muted-foreground"><strong className="text-primary">{sessionMeta.remaining} contacts restant dans la session</strong> · {sessionMeta.totalItems} sélectionnés au départ · les contacts reportés ou exclus sortent automatiquement de la file.</p>
              ) : isRecommendationSegment ? (
                <p className="mt-0.5 text-xs text-muted-foreground"><strong className="text-primary">{actionableCount} contacts à appeler</strong> · {opportunities} RDV/opportunités · {snoozed} à rappeler plus tard · {excluded} exclus / ne plus appeler</p>
              ) : (
                <p className="mt-0.5 text-xs text-muted-foreground"><strong className="text-primary">{actionableCount} à appeler</strong> · {opportunities} RDV/opportunités · {snoozed} relances futures · {excluded} exclus · {total} contacts au total</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isRecommendationSegment && !activeSessionId ? (
                <Button size="sm" className="h-9 gap-1.5" onClick={() => void createSession()} disabled={sessionCreating || recommendationSummary.ACTIONABLE === 0}>
                  {sessionCreating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Créer une session de 80 appels
                </Button>
              ) : null}
              {activeSessionId ? <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={leaveSession}><X size={14} /> Quitter la session</Button> : null}
              <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setNewCompanyOpen(true)}><Building2 size={14} /> Entreprise</Button>
              <Button size="sm" className="h-9 gap-1.5" onClick={() => setNewContactOpen(true)}><Plus size={14} /> Nouveau contact</Button>
            </div>
          </div>

          {isRecommendationSegment && !activeSessionId ? (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-primary/[0.025] px-4 py-2">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Décision Sales</span>
              <Button size="sm" variant={recommendationBucket === "ACTIONABLE" ? "secondary" : "ghost"} className="h-8" onClick={() => setRecommendationBucket("ACTIONABLE")}>À appeler <Badge variant="outline" className="ml-1.5 text-[10px]">{actionableCount}</Badge></Button>
              <Button size="sm" variant={recommendationBucket === "SNOOZED" ? "secondary" : "ghost"} className="h-8" onClick={() => setRecommendationBucket("SNOOZED")}>À rappeler plus tard <Badge variant="outline" className="ml-1.5 text-[10px]">{snoozed}</Badge></Button>
              <Button size="sm" variant={recommendationBucket === "EXCLUDED" ? "secondary" : "ghost"} className="h-8" onClick={() => setRecommendationBucket("EXCLUDED")}>Ne plus appeler <Badge variant="outline" className="ml-1.5 text-[10px]">{excluded}</Badge></Button>
              <Button size="sm" variant={recommendationBucket === "OPPORTUNITY" ? "secondary" : "ghost"} className="h-8" onClick={() => setRecommendationBucket("OPPORTUNITY")}>RDV / opportunités <Badge variant="outline" className="ml-1.5 text-[10px]">{opportunities}</Badge></Button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-y border-border bg-muted/30 px-4 py-2.5">
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
              {!isRecommendationSegment ? <Button variant={view === "board" ? "secondary" : "ghost"} size="sm" className="h-7 gap-1.5" onClick={() => setView("board")}><SquareKanban size={14} /> Pipeline contacts</Button> : null}
              <Button variant={view === "table" ? "secondary" : "ghost"} size="sm" className="h-7 gap-1.5" onClick={() => setView("table")}><Table2 size={14} /> Tableau</Button>
            </div>
            {isRecommendationSegment ? (
              <Badge variant="outline" className="h-9 gap-1.5 border-primary/20 bg-card px-3 text-primary"><Database size={13} /> {activeSessionId ? "Session persistante" : "Classement par score /100"}</Badge>
            ) : (
              <Select value={workFilter} onValueChange={value => setWorkFilter(value as WorkFilter)}>
                <SelectTrigger className="h-9 w-[190px]"><SelectValue placeholder="File de travail" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIONABLE">À appeler maintenant</SelectItem>
                  <SelectItem value="ALL">Tous les contacts</SelectItem>
                  <SelectItem value="OPPORTUNITY">RDV / opportunités</SelectItem>
                  <SelectItem value="SNOOZED">Relances futures</SelectItem>
                  <SelectItem value="EXCLUDED">Exclus de prospection</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select value={owner || "all"} onValueChange={value => setOwner(value === "all" ? "" : value)} disabled={Boolean(activeSessionId)}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Commercial" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tous les commerciaux</SelectItem>{owners.map(item => <SelectItem key={item.id} value={item.id}>{ownerNames[item.id]}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={prospectionStatus || "all"} onValueChange={value => setProspectionStatus(value === "all" ? "" : value)}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Statut prospection" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tous les statuts</SelectItem>{PROSPECTION_OPTIONS.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
            </Select>
            <div className="relative"><MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={locationQuery} onChange={event => setLocationQuery(event.target.value)} placeholder="Ville, région, pays, CP…" className="h-9 w-52 pl-9" /></div>
            <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Contact, société…" className="h-9 w-52 pl-9" /></div>
            {isRecommendationSegment && !activeSessionId ? (
              <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => void load(false, true)} disabled={loading}><Database size={14} /> Recalculer les scores</Button>
            ) : null}
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => void sync()} disabled={syncing}>{syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {syncing ? "Synchronisation…" : "Synchroniser HubSpot"}</Button>
            <span className="ml-auto text-[11px] text-muted-foreground">{isRecommendationSegment ? "Une décision du responsable Sales passe toujours avant le score automatique." : "Les priorités du segment restent calculées depuis les propriétés HubSpot."}</span>
          </div>

          {error ? <div className="mx-4 mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

          {view === "board" && !isRecommendationSegment ? (
            <ProspectionBoard
              contacts={filteredContacts}
              segmentId={segmentId}
              loading={loading}
              onOpenContact={setDrawerId}
              onStatusChange={handleBoardStatusChange}
              onError={setError}
            />
          ) : null}

          {view === "table" ? (
            <div className="min-h-0 flex-1 overflow-auto border-t border-border minari-scrollbar">
              <Table className={isRecommendationSegment ? "min-w-[1720px]" : "min-w-[1460px]"}>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRecommendationSegment ? "Score / priorité" : "Priorité"}</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Localisation</TableHead>
                    <TableHead>Statut prospection</TableHead>
                    <TableHead>Dernier appel</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Prochaine relance</TableHead>
                    <TableHead>Commercial</TableHead>
                    <TableHead>Dernière activité</TableHead>
                    {isRecommendationSegment ? <TableHead>Décision Sales</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? <TableRow><TableCell colSpan={isRecommendationSegment ? 11 : 10} className="h-64 text-center"><Loader2 className="mx-auto animate-spin text-primary" /></TableCell></TableRow> : filteredContacts.map(contact => {
                    const p = contact.properties;
                    const decision = isRecommendationSegment ? databaseDecision(contact) : getContactProspectionDecision(contact);
                    const fullName = [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Sans nom";
                    const score = Number(p.db_call_score || 0);
                    return (
                      <TableRow key={contact.id} className="cursor-pointer" onClick={() => setDrawerId(contact.id)}>
                        <TableCell>
                          <div className="min-w-[210px]">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant={decision.bucket === "ACTIONABLE" ? "secondary" : "outline"}>{decision.priorityLabel}</Badge>
                              {isRecommendationSegment && recommendationBucket === "ACTIONABLE" && !activeSessionId ? <Badge variant="outline" className="border-primary/20 text-primary">{score}/100</Badge> : null}
                              {p.db_call_manual_decision ? <Badge variant="outline" className="border-primary/30 bg-primary/[0.04] text-primary">Décision manuelle</Badge> : null}
                            </div>
                            <div className="mt-1 text-[11px] font-semibold leading-4 text-primary">{decision.suggestion}</div>
                            {isRecommendationSegment ? <div className="mt-1 max-w-[280px] text-[10px] leading-4 text-muted-foreground">{decision.reason}</div> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7 bg-accent"><AvatarFallback className="bg-accent text-[9px] font-bold text-primary">{initials(p.firstname, p.lastname)}</AvatarFallback></Avatar>
                            <div><div className="font-medium">{fullName}</div><div className="text-[11px] text-muted-foreground">{p.jobtitle || p.email || "—"}</div></div>
                          </div>
                        </TableCell>
                        <TableCell>{p.company || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><MapPin size={12} />{contactLocation(p)}</span></TableCell>
                        <TableCell><Badge variant="outline">{p.statut_prospection || "À prospecter"}</Badge></TableCell>
                        <TableCell>{callLabel(p.statut_de_lappel)}</TableCell>
                        <TableCell>{p.phone || p.mobilephone ? <a href={`tel:${p.phone || p.mobilephone}`} onClick={event => event.stopPropagation()} className="phone-chip font-mono text-xs"><Phone size={12} />{p.phone || p.mobilephone}</a> : "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{reminderValue(p) ? formatDate(reminderValue(p)) : "—"}</TableCell>
                        <TableCell>{p.hubspot_owner_id ? ownerNames[p.hubspot_owner_id] || "—" : "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(p.db_call_last_call_at || p.db_call_last_contacted_at || p.notes_last_contacted || p.hs_last_sales_activity_timestamp)}</TableCell>
                        {isRecommendationSegment ? (
                          <TableCell onClick={event => event.stopPropagation()}>
                            <div className="flex items-center gap-1.5">
                              <SalesCallDecisionControls
                                contactId={contact.id}
                                decision={p.db_call_manual_decision}
                                snoozedUntil={p.db_call_snoozed_until}
                                reason={p.db_call_manual_reason}
                                onChanged={() => void load(true, true)}
                              />
                              {activeSessionId && !p.db_call_manual_decision ? (
                                <Button size="sm" variant="secondary" className="h-8 gap-1 px-2" onClick={() => void markSessionContact(contact.id)}><CheckCircle2 size={13} /> Traité</Button>
                              ) : null}
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                  {!loading && !filteredContacts.length ? <TableRow><TableCell colSpan={isRecommendationSegment ? 11 : 10} className="h-40 text-center text-muted-foreground">{activeSessionId ? "Session terminée : aucun contact restant." : "Aucun contact pour ces filtres."}</TableCell></TableRow> : null}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </Card>
      </div>

      <ContactDrawer contactId={drawerId} open={Boolean(drawerId)} onOpenChange={open => !open && setDrawerId(null)} onUpdated={() => void load(true, isRecommendationSegment)} />
      <NewCompanyDialog open={newCompanyOpen} onOpenChange={setNewCompanyOpen} onCreated={() => void load(true, isRecommendationSegment)} />
      <NewContactDialog open={newContactOpen} onOpenChange={setNewContactOpen} onCreated={() => void load(true, isRecommendationSegment)} />
    </div>
  );
}
