"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, ListFilter, Loader2, MapPin, Play, Plus, RefreshCw, Search, SquareKanban, Table2, Users } from "lucide-react";
import { CallRecommendationStrip } from "@/components/call-recommendation-strip";
import { CompanyDrawer } from "@/components/company-drawer";
import { NewCompanyDialog } from "@/components/new-company-dialog";
import { NewContactDialog } from "@/components/new-contact-dialog";
import { CompanyProspectionBoard, COMPANY_PIPELINE, deriveCompanyStage, type CompanyStage } from "@/components/company-prospection-board";
import { ProspectionSession } from "@/components/prospection-session";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  compareCompanyProspectionPriority,
  getCompanyProspectionDecision,
  type ProspectionBucket,
} from "@/lib/company-prospection-priority";
import { fetchAllPagedResults } from "@/lib/fetch-all-paged-results";
import {
  PROSPECTION_SEGMENT_PREFS_EVENT,
  orderVisibleCompanySegments,
  readProspectionSegmentPreferences,
  type ProspectionSegmentPreferences,
} from "@/lib/prospection-segment-preferences";
import { formatDate } from "@/lib/utils";

type Company = { id: string; properties: Record<string, string | null | undefined> };
type List = { listId: string; name: string; objectTypeId: string; size?: number };
type Owner = { id: string; firstName?: string; lastName?: string; email?: string };
type ViewMode = "board" | "table";
type WorkFilter = ProspectionBucket | "ALL";

const STAGE_LABELS = Object.fromEntries(COMPANY_PIPELINE.map(column => [column.value, column.label]));

function callLabel(value?: string | null) {
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
  return value ? labels[value] || value : "—";
}

function companyLocation(properties: Record<string, string | null | undefined>) {
  return [properties.zip, properties.city, properties.state, properties.country].filter(Boolean).join(" · ") || "—";
}

function companySuggestion(
  stage: CompanyStage,
  decision: ReturnType<typeof getCompanyProspectionDecision>,
) {
  if (decision.bucket === "SNOOZED") return "Attendre la prochaine relance";
  if (decision.bucket === "OPPORTUNITY") return "Préparer le RDV / deal";
  if (decision.bucket === "EXCLUDED") return "Ne pas appeler";
  if (decision.priority === 1) return "Traiter la tâche HubSpot en retard";
  if (stage === "FOLLOW_UP") return "Rappeler maintenant";
  if (stage === "ATTEMPTED_TO_CONTACT") return "Retenter l'appel";
  if (stage === "CONNECTED") return "Qualifier la prochaine étape";
  return "Effectuer le prochain appel";
}

export function CompanyFirstProspectionView() {
  const [lists, setLists] = useState<List[]>([]);
  const [segmentPreferences, setSegmentPreferences] = useState<ProspectionSegmentPreferences>({});
  const [owners, setOwners] = useState<Owner[]>([]);
  const [segmentId, setSegmentId] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [owner, setOwner] = useState("");
  const [stageFilter, setStageFilter] = useState<CompanyStage | "">("");
  const [workFilter, setWorkFilter] = useState<WorkFilter>("ACTIONABLE");
  const [view, setView] = useState<ViewMode>("board");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [newCompanyOpen, setNewCompanyOpen] = useState(false);
  const [newContactOpen, setNewContactOpen] = useState(false);

  useEffect(() => {
    const initialPreferences = readProspectionSegmentPreferences();
    setSegmentPreferences(initialPreferences);
    Promise.all([
      fetch("/api/segments", { cache: "no-store" }).then(response => response.json()),
      fetch("/api/owners", { cache: "no-store" }).then(response => response.json()),
    ])
      .then(([segments, ownerData]) => {
        const companyLists = ((segments.lists || []) as List[]).filter(item => item.objectTypeId === "0-2");
        const visible = orderVisibleCompanySegments(companyLists, initialPreferences);
        setLists(companyLists);
        setOwners(ownerData.results || []);
        setSegmentId(visible[0]?.listId || "");
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : "Impossible de charger le Cockpit"));

    const refreshPreferences = () => setSegmentPreferences(readProspectionSegmentPreferences());
    window.addEventListener(PROSPECTION_SEGMENT_PREFS_EVENT, refreshPreferences);
    window.addEventListener("storage", refreshPreferences);
    return () => {
      window.removeEventListener(PROSPECTION_SEGMENT_PREFS_EVENT, refreshPreferences);
      window.removeEventListener("storage", refreshPreferences);
    };
  }, []);

  const visibleLists = useMemo(
    () => orderVisibleCompanySegments(lists, segmentPreferences),
    [lists, segmentPreferences],
  );

  useEffect(() => {
    if (!segmentId) return;
    if (!visibleLists.some(item => item.listId === segmentId)) setSegmentId(visibleLists[0]?.listId || "");
  }, [visibleLists, segmentId]);

  const ownerNames = useMemo(() => Object.fromEntries(owners.map(item => [
    item.id,
    [item.firstName, item.lastName].filter(Boolean).join(" ") || item.email || item.id,
  ])), [owners]);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (segmentId) params.set("segmentId", segmentId);
      if (!segmentId && query) params.set("q", query);
      if (!segmentId && owner) params.set("owner", owner);
      const payload = await fetchAllPagedResults<Company>(`/api/companies?${params.toString()}`);
      setCompanies(payload.results);
      setTotal(payload.total);
      if (payload.truncated) setError("Le volume est très important : seuls les 10 000 premiers comptes ont été chargés.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur de chargement");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [segmentId]);

  const baseFiltered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const locationNeedle = locationQuery.trim().toLowerCase();
    return companies.filter(company => {
      const p = company.properties;
      const haystack = [p.name, p.domain, p.phone, p.website, p.industry].filter(Boolean).join(" ").toLowerCase();
      const locationHaystack = [p.zip, p.city, p.state, p.country].filter(Boolean).join(" ").toLowerCase();
      return (!needle || haystack.includes(needle))
        && (!locationNeedle || locationHaystack.includes(locationNeedle))
        && (!owner || p.hubspot_owner_id === owner)
        && (!stageFilter || deriveCompanyStage(company) === stageFilter);
    });
  }, [companies, query, locationQuery, owner, stageFilter]);

  const classified = useMemo(() => {
    const now = Date.now();
    return baseFiltered
      .map(company => {
        const stage = deriveCompanyStage(company, now);
        return { company, stage, decision: getCompanyProspectionDecision(company, stage, now) };
      })
      .sort((a, b) => compareCompanyProspectionPriority(a, b, now));
  }, [baseFiltered]);

  const filtered = useMemo(
    () => classified
      .filter(item => workFilter === "ALL" || item.decision.bucket === workFilter)
      .map(item => item.company),
    [classified, workFilter],
  );

  const actionableCompanies = useMemo(
    () => classified.filter(item => item.decision.bucket === "ACTIONABLE").map(item => item.company),
    [classified],
  );

  const recommendations = useMemo(() => classified
    .filter(item => item.decision.bucket === "ACTIONABLE")
    .slice(0, 3)
    .map(({ company, stage, decision }) => {
      const p = company.properties;
      return {
        id: company.id,
        title: p.name || "Entreprise sans nom",
        subtitle: [callLabel(p.statut_de_lappel), p.city || p.domain].filter(Boolean).join(" · "),
        phone: p.phone,
        priorityLabel: decision.priorityLabel,
        reason: decision.reason,
        suggestion: companySuggestion(stage, decision),
      };
    }), [classified]);

  const currentList = visibleLists.find(item => item.listId === segmentId);
  const actionableCount = classified.filter(item => item.decision.bucket === "ACTIONABLE").length;
  const opportunities = classified.filter(item => item.decision.bucket === "OPPORTUNITY").length;
  const snoozed = classified.filter(item => item.decision.bucket === "SNOOZED").length;
  const excluded = classified.filter(item => item.decision.bucket === "EXCLUDED").length;

  async function sync() {
    setSyncing(true);
    try {
      const response = await fetch("/api/sync?resource=all");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Synchronisation impossible");
      await load(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur de synchronisation");
    } finally {
      setSyncing(false);
    }
  }

  function handleStatusChange(id: string, stage: CompanyStage, updated?: Record<string, string | null | undefined>) {
    setCompanies(current => current.map(company => {
      if (company.id !== id) return company;
      const fallback: Record<string, string | null | undefined> = {};
      if (stage === "WON") fallback.lifecyclestage = "customer";
      if (stage === "LOST") fallback.hs_lead_status = "UNQUALIFIED";
      if (stage === "LATER" || stage === "FOLLOW_UP") fallback.hs_lead_status = "BAD_TIMING";
      if (["NEW", "OPEN", "ATTEMPTED_TO_CONTACT", "CONNECTED", "OPEN_DEAL"].includes(stage)) fallback.hs_lead_status = stage;
      return { ...company, properties: { ...company.properties, ...fallback, ...(updated || {}) } };
    }));
    void load(true);
  }

  return (
    <div className="page-shell flex h-screen flex-col overflow-hidden">
      <div className="flex shrink-0 items-end gap-1.5 border-b border-border bg-card px-5 pt-3 minari-scrollbar">
        <div className="mb-2 flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
          <Button size="sm" variant="secondary" className="h-8 gap-1.5 rounded-md px-3"><Building2 size={14} /> Entreprises</Button>
          <Button asChild size="sm" variant="ghost" className="h-8 gap-1.5 rounded-md px-3"><a href="/prospection?mode=contacts"><Users size={14} /> Contacts</a></Button>
        </div>
        <Button asChild variant="ghost" size="sm" className="mb-2 h-9 gap-2 px-3 font-semibold text-primary hover:bg-accent"><a href="/segments"><ListFilter size={15} /> Gérer les segments</a></Button>
        <div className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto">
          <button onClick={() => setSegmentId("")} className={`relative flex h-11 shrink-0 items-center rounded-t-xl border border-b-0 px-4 text-sm ${!segmentId ? "border-border bg-background font-semibold" : "border-transparent text-muted-foreground hover:bg-muted/60"}`}>Toutes les entreprises</button>
          {visibleLists.map(list => (
            <button key={list.listId} onClick={() => setSegmentId(list.listId)} className={`relative flex h-11 shrink-0 items-center gap-2 rounded-t-xl border border-b-0 px-4 text-sm ${segmentId === list.listId ? "border-border bg-background font-semibold text-foreground before:absolute before:inset-x-3 before:top-0 before:h-[2px] before:bg-primary" : "border-transparent text-muted-foreground hover:bg-muted/60"}`}>
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
              <h1 className="font-display text-lg font-bold tracking-tight">{currentList?.name || "Prospection par entreprise"}</h1>
              <p className="mt-0.5 text-xs text-muted-foreground"><strong className="text-primary">{actionableCount} à traiter</strong> · {opportunities} RDV/deals · {snoozed} relances futures · {excluded} exclus · {total} comptes au total</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="hidden rounded-lg border border-primary/20 bg-primary/[0.05] px-3 py-2 text-xs text-muted-foreground 2xl:block"><strong className="text-primary">File sécurisée</strong> · pas intéressé, hors cible, RDV pris et relances futures sont retirés de la session</div>
              <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setNewContactOpen(true)}><Plus size={14} /> Contact</Button>
              <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setNewCompanyOpen(true)}><Building2 size={14} /> Entreprise</Button>
              <Button disabled={loading || !actionableCompanies.length} onClick={() => setSessionOpen(true)} className="gap-2">
                <Play size={15} className="fill-current" /> Démarrer la session
                {actionableCompanies.length ? <Badge variant="secondary" className="ml-1 bg-background/80 text-foreground">{actionableCompanies.length}</Badge> : null}
              </Button>
            </div>
          </div>

          <CallRecommendationStrip items={recommendations} onOpen={setDrawerId} />

          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
              <Button variant={view === "board" ? "secondary" : "ghost"} size="sm" className="h-7 gap-1.5" onClick={() => setView("board")}><SquareKanban size={14} /> Pipeline comptes</Button>
              <Button variant={view === "table" ? "secondary" : "ghost"} size="sm" className="h-7 gap-1.5" onClick={() => setView("table")}><Table2 size={14} /> Tableau</Button>
            </div>
            <Select value={workFilter} onValueChange={value => setWorkFilter(value as WorkFilter)}>
              <SelectTrigger className="h-9 w-[190px]"><SelectValue placeholder="File de travail" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIONABLE">À traiter maintenant</SelectItem>
                <SelectItem value="ALL">Tous les comptes</SelectItem>
                <SelectItem value="OPPORTUNITY">RDV / opportunités</SelectItem>
                <SelectItem value="SNOOZED">Relances futures</SelectItem>
                <SelectItem value="EXCLUDED">Exclus de prospection</SelectItem>
              </SelectContent>
            </Select>
            <Select value={owner || "all"} onValueChange={value => setOwner(value === "all" ? "" : value)}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Commercial" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tous les commerciaux</SelectItem>{owners.map(item => <SelectItem key={item.id} value={item.id}>{ownerNames[item.id]}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={stageFilter || "all"} onValueChange={value => setStageFilter(value === "all" ? "" : value as CompanyStage)}>
              <SelectTrigger className="h-9 w-[165px]"><SelectValue placeholder="Statut compte" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tous les statuts</SelectItem>{COMPANY_PIPELINE.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
            <div className="relative"><MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={locationQuery} onChange={event => setLocationQuery(event.target.value)} placeholder="Ville, région, pays, CP…" className="h-9 w-52 pl-9" /></div>
            <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Entreprise, domaine…" className="h-9 w-52 pl-9" /></div>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => void sync()} disabled={syncing}>{syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {syncing ? "Synchronisation…" : "Synchroniser"}</Button>
            <span className="ml-auto text-[11px] text-muted-foreground">La session appelle uniquement les comptes « À traiter maintenant » correspondant à ces filtres.</span>
          </div>

          {error ? <div className="mx-4 mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

          {view === "board" ? (
            <CompanyProspectionBoard
              companies={filtered}
              ownerNames={ownerNames}
              loading={loading}
              onOpenCompany={setDrawerId}
              onStatusChange={handleStatusChange}
              onError={setError}
            />
          ) : null}

          {view === "table" ? (
            <div className="min-h-0 flex-1 overflow-auto border-t border-border minari-scrollbar">
              <Table className="min-w-[1400px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Priorité</TableHead>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Localisation</TableHead>
                    <TableHead>Étape workflow</TableHead>
                    <TableHead>Dernier appel</TableHead>
                    <TableHead>Prochaine reprise</TableHead>
                    <TableHead>Contacts</TableHead>
                    <TableHead>Deals</TableHead>
                    <TableHead>Commercial</TableHead>
                    <TableHead>Dernière activité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? <TableRow><TableCell colSpan={10} className="h-64 text-center"><Loader2 className="mx-auto animate-spin text-primary" /></TableCell></TableRow> : filtered.map(company => {
                    const p = company.properties;
                    const stage = deriveCompanyStage(company);
                    const decision = getCompanyProspectionDecision(company, stage);
                    return (
                      <TableRow key={company.id} className="cursor-pointer" onClick={() => setDrawerId(company.id)}>
                        <TableCell>
                          <div className="min-w-[120px]">
                            <Badge variant={decision.bucket === "ACTIONABLE" ? "secondary" : "outline"}>{decision.priorityLabel}</Badge>
                            <div className="mt-1 max-w-[180px] text-[10px] leading-4 text-muted-foreground">{companySuggestion(stage, decision)}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7 rounded-lg bg-accent"><AvatarFallback className="rounded-lg bg-accent text-primary"><Building2 size={13} /></AvatarFallback></Avatar>
                            <div><div className="font-medium">{p.name || "Sans nom"}</div><div className="text-[11px] text-muted-foreground">{p.domain || "—"}</div></div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><MapPin size={12} />{companyLocation(p)}</span></TableCell>
                        <TableCell><Badge variant="outline">{STAGE_LABELS[stage]}</Badge></TableCell>
                        <TableCell>{callLabel(p.statut_de_lappel)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{stage === "LATER" || stage === "FOLLOW_UP" ? formatDate(p.qualification_next_action_at || p.date_de_rappel || p.notes_next_activity_date) : "—"}</TableCell>
                        <TableCell>{p.qualification_contacts_count || p.num_associated_contacts || 0}</TableCell>
                        <TableCell>{p.qualification_deals_count || p.num_associated_deals || 0}</TableCell>
                        <TableCell>{p.hubspot_owner_id ? ownerNames[p.hubspot_owner_id] || "—" : "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(p.qualification_last_activity_at || p.notes_last_updated || p.hs_last_sales_activity_timestamp)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!loading && !filtered.length ? <TableRow><TableCell colSpan={10} className="h-40 text-center text-muted-foreground">Aucune entreprise pour ces filtres.</TableCell></TableRow> : null}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </Card>
      </div>

      <ProspectionSession open={sessionOpen} onOpenChange={setSessionOpen} companies={actionableCompanies} onOpenCompany={setDrawerId} />
      <CompanyDrawer companyId={drawerId} open={Boolean(drawerId)} onOpenChange={open => !open && setDrawerId(null)} />
      <NewCompanyDialog open={newCompanyOpen} onOpenChange={setNewCompanyOpen} onCreated={() => void load(true)} />
      <NewContactDialog open={newContactOpen} onOpenChange={setNewContactOpen} onCreated={() => void load(true)} />
    </div>
  );
}
