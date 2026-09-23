"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, ListFilter, Loader2, MapPin, RefreshCw, Search, SquareKanban, Table2 } from "lucide-react";
import { CompanyMultiFilter } from "@/components/company-multi-filter";
import { NewCompanyDialog } from "@/components/new-company-dialog";
import { CompanyProspectionBoard, COMPANY_PIPELINE, deriveCompanyStage, type CompanyStage } from "@/components/company-prospection-board";
import { ProspectionSession } from "@/components/prospection-session";
import { SdrWorkQueue } from "@/components/sdr-work-queue";
import { PageHeader } from "@/components/cockpit/page-header";
import { ProspectionPageSkeleton } from "@/components/prospection-page-skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCompanies, type CompanyRecord as Company } from "@/hooks/queries/use-companies";
import {
  useCurrentCockpitUser,
  useOwners,
  useProspectionAssignments,
  useSegments,
  type CockpitAssignment,
} from "@/hooks/queries/use-prospection-reference-data";
import { useCompanyProspectionParams } from "@/hooks/use-company-prospection-params";
import { companyMatchesFilters } from "@/lib/company-multi-filters";
import { compareCompanyProspectionPriority, getCompanyProspectionDecision } from "@/lib/company-prospection-priority";
import {
  PROSPECTION_SEGMENT_PREFS_EVENT,
  orderVisibleCompanySegments,
  readProspectionSegmentPreferences,
  type ProspectionSegmentPreferences,
} from "@/lib/prospection-segment-preferences";
import { queryKeys } from "@/lib/query/query-keys";
import { formatDate } from "@/lib/utils";
import { getBestCallTimeForProperties } from "@/lib/call-timing";

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
  return [properties.zip || properties.postal_code, properties.city, properties.state, properties.country].filter(Boolean).join(" · ") || "—";
}

function companySuggestion(stage: CompanyStage, decision: ReturnType<typeof getCompanyProspectionDecision>) {
  if (decision.bucket === "SNOOZED") return "Attendre la prochaine relance";
  if (decision.bucket === "OPPORTUNITY") return "Préparer le RDV / deal";
  if (decision.bucket === "EXCLUDED") return "Ne pas appeler";
  if (decision.priority === 1) return "Traiter la tâche en retard";
  if (stage === "FOLLOW_UP") return "Rappeler maintenant";
  if (stage === "ATTEMPTED_TO_CONTACT") return "Retenter l'appel";
  if (stage === "CONNECTED") return "Qualifier la prochaine étape";
  return "Effectuer le prochain appel";
}

export function CompanyFirstProspectionView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    query,
    setQuery,
    segmentId,
    setSegmentId,
    workFilter,
    setWorkFilter,
    view,
    setView,
    filters,
    setFilters,
  } = useCompanyProspectionParams();

  const [segmentPreferences, setSegmentPreferences] = useState<ProspectionSegmentPreferences>({});
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionCompanies, setSessionCompanies] = useState<Company[]>([]);
  const [newCompanyOpen, setNewCompanyOpen] = useState(false);
  const [localError, setLocalError] = useState("");
  const [evaluationTime, setEvaluationTime] = useState(Date.now);

  const companiesQuery = useCompanies(segmentId);
  const segmentsQuery = useSegments();
  const ownersQuery = useOwners();
  const currentUserQuery = useCurrentCockpitUser();
  const assignmentsQuery = useProspectionAssignments();

  const companies = companiesQuery.data?.results ?? [];
  const total = companiesQuery.data?.total ?? 0;
  const owners = ownersQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const currentUserEmail = String(currentUserQuery.data?.email || "").trim().toLowerCase();
  const lists = useMemo(
    () => (segmentsQuery.data ?? []).filter(item => item.objectTypeId === "0-2"),
    [segmentsQuery.data],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setEvaluationTime(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const refreshPreferences = () => setSegmentPreferences(readProspectionSegmentPreferences());
    refreshPreferences();
    window.addEventListener(PROSPECTION_SEGMENT_PREFS_EVENT, refreshPreferences);
    window.addEventListener("storage", refreshPreferences);
    return () => {
      window.removeEventListener(PROSPECTION_SEGMENT_PREFS_EVENT, refreshPreferences);
      window.removeEventListener("storage", refreshPreferences);
    };
  }, []);

  const visibleLists = useMemo(() => orderVisibleCompanySegments(lists, segmentPreferences), [lists, segmentPreferences]);

  useEffect(() => {
    if (segmentsQuery.isPending || !segmentsQuery.data) return;
    if (segmentId && !visibleLists.some(item => item.listId === segmentId)) {
      void setSegmentId("");
    }
  }, [segmentId, segmentsQuery.data, segmentsQuery.isPending, setSegmentId, visibleLists]);

  const ownerNames = useMemo(() => Object.fromEntries(owners.map(item => [
    item.id,
    [item.firstName, item.lastName].filter(Boolean).join(" ") || item.email || item.id,
  ])), [owners]);

  const assignmentByCompanyId = useMemo(() => new Map(assignments.map(assignment => [
    assignment.company_id,
    String(assignment.assignee_cockpit_email || "").trim().toLowerCase(),
  ])), [assignments]);

  const baseFiltered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return companies.filter(company => {
      const p = company.properties;
      const haystack = [p.name, p.domain, p.phone, p.website, p.industry, p.city, p.state, p.country, p.zip, p.postal_code]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const stage = deriveCompanyStage(company);
      return (!needle || haystack.includes(needle)) && companyMatchesFilters(p, filters, stage);
    });
  }, [companies, query, filters]);

  const classified = useMemo(() => {
    const now = evaluationTime;
    return baseFiltered
      .map(company => {
        const stage = deriveCompanyStage(company, now);
        return { company, stage, decision: getCompanyProspectionDecision(company, stage, now) };
      })
      .sort((a, b) => compareCompanyProspectionPriority(a, b, now));
  }, [baseFiltered, evaluationTime]);

  const filtered = useMemo(
    () => classified.filter(item => workFilter === "ALL" || item.decision.bucket === workFilter).map(item => item.company),
    [classified, workFilter],
  );

  const actionableCompanies = useMemo(
    () => classified.filter(item => item.decision.bucket === "ACTIONABLE").map(item => item.company),
    [classified],
  );

  const sessionCandidates = useMemo(() => actionableCompanies.filter(company => {
    const assignee = assignmentByCompanyId.get(company.id);
    return (!assignee || assignee === currentUserEmail)
      && getBestCallTimeForProperties(company.properties, new Date(evaluationTime)).callNow;
  }), [actionableCompanies, assignmentByCompanyId, currentUserEmail, evaluationTime]);

  const myAssignedCompanies = useMemo(
    () => actionableCompanies.filter(company => assignmentByCompanyId.get(company.id) === currentUserEmail),
    [actionableCompanies, assignmentByCompanyId, currentUserEmail],
  );

  const blockedByTimingCount = myAssignedCompanies.filter(
    company => !getBestCallTimeForProperties(company.properties, new Date(evaluationTime)).callNow,
  ).length;
  const unassignedCount = actionableCompanies.filter(company => !assignmentByCompanyId.has(company.id)).length;
  const currentList = visibleLists.find(item => item.listId === segmentId);
  const actionableCount = classified.filter(item => item.decision.bucket === "ACTIONABLE").length;
  const opportunities = classified.filter(item => item.decision.bucket === "OPPORTUNITY").length;
  const snoozed = classified.filter(item => item.decision.bucket === "SNOOZED").length;
  const excluded = classified.filter(item => item.decision.bucket === "EXCLUDED").length;

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/sync?resource=all");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Synchronisation impossible");
      return payload;
    },
    onSuccess: async () => {
      setLocalError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.companies.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.owners.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.segments.all }),
      ]);
    },
    onError: error => setLocalError(error instanceof Error ? error.message : "Erreur de synchronisation"),
  });

  const sessionMutation = useMutation({
    mutationFn: async (companyIds: string[]) => {
      const response = await fetch("/api/prospection/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyIds }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || "Impossible d’attribuer la session");
      return payload;
    },
    onError: error => setLocalError(error instanceof Error ? error.message : "Impossible de démarrer la session"),
  });

  async function startSession() {
    setLocalError("");
    const payload = await sessionMutation.mutateAsync(sessionCandidates.slice(0, 100).map(company => company.id)).catch(() => null);
    if (!payload) return;

    const claimed = new Set((payload.claimedCompanyIds || []).map(String));
    const selected = sessionCandidates.filter(company => claimed.has(company.id));
    if (!selected.length) {
      setLocalError("Aucune entreprise disponible : elles ont peut-être déjà été prises par un autre commercial.");
      return;
    }

    queryClient.setQueryData<CockpitAssignment[]>(queryKeys.prospection.assignments, current => {
      const existing = current ?? [];
      const preserved = existing.filter(item => !claimed.has(item.company_id));
      return [...preserved, ...selected.map(company => ({
        company_id: company.id,
        assignee_cockpit_email: currentUserEmail,
      }))];
    });
    setSessionCompanies(selected);
    setSessionOpen(true);
  }

  function handleStatusChange(id: string, stage: CompanyStage, updated?: Record<string, string | null | undefined>) {
    queryClient.setQueryData(queryKeys.companies.list({ segmentId }), (current: any) => {
      if (!current?.results) return current;
      return {
        ...current,
        results: current.results.map((company: Company) => {
          if (company.id !== id) return company;
          const fallback: Record<string, string | null | undefined> = {};
          if (stage === "WON") fallback.lifecyclestage = "customer";
          if (stage === "LOST") fallback.hs_lead_status = "UNQUALIFIED";
          if (stage === "LATER" || stage === "FOLLOW_UP") fallback.hs_lead_status = "BAD_TIMING";
          if (["NEW", "OPEN", "ATTEMPTED_TO_CONTACT", "CONNECTED", "OPEN_DEAL"].includes(stage)) fallback.hs_lead_status = stage;
          return { ...company, properties: { ...company.properties, ...fallback, ...(updated || {}) } };
        }),
      };
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.companies.detail(id) });
  }

  const loading = companiesQuery.isPending || segmentsQuery.isPending || ownersQuery.isPending;
  const queryError = [companiesQuery.error, segmentsQuery.error, ownersQuery.error, assignmentsQuery.error]
    .find(Boolean);
  const error = localError
    || (companiesQuery.data?.truncated ? "Le volume est très important : seuls les 10 000 premiers comptes ont été chargés." : "")
    || (queryError instanceof Error ? queryError.message : "");

  if (loading && !companiesQuery.data) {
    return <ProspectionPageSkeleton />;
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[1440px] min-w-0 flex-col overflow-hidden px-3 py-5 sm:px-5 lg:px-7 lg:py-7">
      <PageHeader
        eyebrow="Prospection"
        title="Entreprises"
        description="Une file de travail unique pour qualifier, appeler et faire progresser les comptes."
        actions={
          <>
            <Select value={segmentId || "__all__"} onValueChange={value => void setSegmentId(value === "__all__" ? "" : value)}>
              <SelectTrigger className="h-8 w-full min-w-[190px] sm:w-[220px]"><SelectValue placeholder="Segment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toutes les entreprises</SelectItem>
                {visibleLists.map(list => (
                  <SelectItem key={list.listId} value={list.listId}>{list.name}{list.size !== undefined ? ` · ${list.size}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5">
              <a href="/segments"><ListFilter size={14} /> Segments</a>
            </Button>
            <Button size="sm" className="h-8 gap-1.5" onClick={() => setNewCompanyOpen(true)}>
              <Building2 size={14} /> Ajouter
            </Button>
          </>
        }
      />

      <div className="mt-6 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/50 bg-background">
        <SdrWorkQueue
          activeFilter={workFilter}
          actionableCount={actionableCount}
          callableNowCount={sessionCandidates.length}
          blockedByTimingCount={blockedByTimingCount}
          unassignedCount={unassignedCount}
          opportunitiesCount={opportunities}
          snoozedCount={snoozed}
          excludedCount={excluded}
          totalCount={classified.length}
          segmentName={currentList?.name}
          loading={loading || sessionMutation.isPending}
          onFilterChange={value => void setWorkFilter(value)}
          onStartSession={() => void startSession()}
        />

        <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border/45 px-3 py-2.5 sm:px-4">
          <div className="flex items-center gap-0.5 rounded-lg bg-muted/45 p-0.5">
            <Button variant={view === "table" ? "secondary" : "ghost"} size="sm" className="h-7 gap-1.5 shadow-none" onClick={() => void setView("table")}>
              <Table2 size={14} /> Base
            </Button>
            <Button variant={view === "board" ? "secondary" : "ghost"} size="sm" className="h-7 gap-1.5 shadow-none" onClick={() => void setView("board")}>
              <SquareKanban size={14} /> Pipeline
            </Button>
          </div>

          <CompanyMultiFilter companies={companies} owners={owners} value={filters} onChange={value => void setFilters(value)} />
          <div className="relative min-w-[180px] flex-1 sm:max-w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={event => void setQuery(event.target.value)}
              placeholder="Entreprise, domaine, ville…"
              className="h-8 border-0 bg-muted/45 pl-8 shadow-none focus-visible:ring-1"
            />
          </div>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            {syncMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Synchroniser
          </Button>
          <span className="ml-auto hidden text-[11px] text-muted-foreground 2xl:inline">{total.toLocaleString("fr-FR")} prospects</span>
        </div>

        {error ? <div className="mx-4 mt-3 rounded-lg bg-destructive/7 px-3 py-2 text-xs text-destructive">{error}</div> : null}

        {view === "board" ? (
          <CompanyProspectionBoard
            companies={filtered}
            ownerNames={ownerNames}
            loading={loading}
            onOpenCompany={id => router.push(`/companies/${id}`)}
            onStatusChange={handleStatusChange}
            onError={setLocalError}
          />
        ) : null}

        {view === "table" ? (
          <div className="min-h-0 min-w-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain border-t border-border/45 minari-scrollbar">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden w-[90px] 2xl:table-cell">Priorité</TableHead>
                  <TableHead className="hidden w-[190px] xl:table-cell">Prochaine action</TableHead>
                  <TableHead>Entreprise</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Dernier appel</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Localisation</TableHead>
                  <TableHead className="w-[120px]">Statut</TableHead>
                  <TableHead className="hidden w-[150px] lg:table-cell">Rappel prévu</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Contacts</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Deals</TableHead>
                  <TableHead className="hidden w-[180px] xl:table-cell">Commercial</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Dernière activité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={11} className="h-52 text-center"><Loader2 className="mx-auto animate-spin text-muted-foreground" /></TableCell></TableRow>
                ) : filtered.map(company => {
                  const p = company.properties;
                  const stage = deriveCompanyStage(company);
                  const decision = getCompanyProspectionDecision(company, stage);
                  return (
                    <TableRow key={company.id} className="cursor-pointer" onClick={() => router.push(`/companies/${company.id}`)}>
                      <TableCell className="hidden 2xl:table-cell"><Badge variant={decision.bucket === "ACTIONABLE" ? "secondary" : "outline"}>{decision.priorityLabel}</Badge></TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-foreground">{companySuggestion(stage, decision)}</div>
                          <div className="mt-1 max-w-[240px] text-[10px] leading-4 text-muted-foreground">{decision.reason}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar className="h-7 w-7 rounded-lg bg-muted"><AvatarFallback className="rounded-lg bg-muted text-foreground/70"><Building2 size={13} /></AvatarFallback></Avatar>
                          <div className="min-w-0"><div className="truncate font-medium">{p.name || "Sans nom"}</div><div className="truncate text-[11px] text-muted-foreground">{p.domain || "—"}</div></div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden 2xl:table-cell">{callLabel(p.statut_de_lappel)}</TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground 2xl:table-cell"><span className="inline-flex items-center gap-1.5"><MapPin size={12} />{companyLocation(p)}</span></TableCell>
                      <TableCell><Badge variant="outline">{STAGE_LABELS[stage]}</Badge></TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">{stage === "LATER" || stage === "FOLLOW_UP" ? formatDate(p.qualification_next_action_at || p.date_de_rappel || p.notes_next_activity_date) : "—"}</TableCell>
                      <TableCell className="hidden 2xl:table-cell">{p.qualification_contacts_count || p.num_associated_contacts || 0}</TableCell>
                      <TableCell className="hidden 2xl:table-cell">{p.qualification_deals_count || p.num_associated_deals || 0}</TableCell>
                      <TableCell className="hidden truncate xl:table-cell">{assignmentByCompanyId.get(company.id) || "Non attribuée"}</TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground 2xl:table-cell">{formatDate(p.qualification_last_activity_at || p.notes_last_updated || p.hs_last_sales_activity_timestamp)}</TableCell>
                    </TableRow>
                  );
                })}
                {!loading && !filtered.length ? (
                  <TableRow><TableCell colSpan={11} className="h-40 text-center text-muted-foreground">Aucune entreprise pour ces filtres.</TableCell></TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>

      <ProspectionSession open={sessionOpen} onOpenChange={setSessionOpen} companies={sessionCompanies} onOpenCompany={id => router.push(`/companies/${id}`)} />
      <NewCompanyDialog
        open={newCompanyOpen}
        onOpenChange={setNewCompanyOpen}
        onCreated={() => void queryClient.invalidateQueries({ queryKey: queryKeys.companies.all })}
      />
    </div>
  );
}
