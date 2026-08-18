"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, ListFilter, Loader2, RefreshCw, Search, Table2, Users, SquareKanban } from "lucide-react";
import { CompanyDrawer } from "@/components/company-drawer";
import { CompanyProspectionBoard, COMPANY_PIPELINE } from "@/components/company-prospection-board";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

type Company = { id: string; properties: Record<string, string | null | undefined> };
type List = { listId: string; name: string; objectTypeId: string; size?: number };
type Owner = { id: string; firstName?: string; lastName?: string; email?: string };
type ViewMode = "board" | "table";

const LEAD_LABELS = Object.fromEntries(COMPANY_PIPELINE.map(column => [column.value, column.label]));

function callLabel(value?: string | null) {
  const labels: Record<string, string> = {
    interesse: "Intéressé", interesse_mais: "Intéressé mais", a_une_date_ulterieure: "À une date ultérieure",
    a_rappeler: "À rappeler", pas_interesse: "Pas intéressé", occupe: "Occupé", nrp: "NRP",
    hors_cible: "Hors cible", en_attente_decision: "En attente décision", numero_invalide: "Numéro invalide", autres: "Autres",
  };
  return value ? labels[value] || value : "—";
}

export function CompanyFirstProspectionView() {
  const [lists, setLists] = useState<List[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [segmentId, setSegmentId] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("");
  const [leadStatus, setLeadStatus] = useState("");
  const [view, setView] = useState<ViewMode>("board");
  const [drawerId, setDrawerId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/segments").then(r => r.json()), fetch("/api/owners").then(r => r.json())])
      .then(([segments, ownerData]) => {
        const companyLists = ((segments.lists || []) as List[]).filter(item => item.objectTypeId === "0-2");
        setLists(companyLists);
        setOwners(ownerData.results || []);
        setSegmentId(companyLists[0]?.listId || "");
      })
      .catch(error => setError(error instanceof Error ? error.message : "Impossible de charger le Cockpit"));
  }, []);

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
      const response = await fetch(`/api/companies?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible de charger les entreprises");
      setCompanies(data.results || []);
      setTotal(data.total || data.results?.length || 0);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Erreur de chargement");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [segmentId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return companies.filter(company => {
      const p = company.properties;
      const haystack = [p.name, p.domain, p.city, p.country, p.phone].filter(Boolean).join(" ").toLowerCase();
      return (!needle || haystack.includes(needle))
        && (!owner || p.hubspot_owner_id === owner)
        && (!leadStatus || (p.hs_lead_status || "NEW") === leadStatus);
    });
  }, [companies, query, owner, leadStatus]);

  const currentList = lists.find(item => item.listId === segmentId);
  const reminders = filtered.filter(company => company.properties.date_de_rappel || company.properties.notes_next_activity_date).length;
  const opportunities = filtered.filter(company => company.properties.hs_lead_status === "OPEN_DEAL" || Number(company.properties.num_associated_deals || 0) > 0).length;

  async function sync() {
    setSyncing(true);
    try {
      const response = await fetch("/api/sync?resource=all");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Synchronisation impossible");
      await load(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Erreur de synchronisation");
    } finally {
      setSyncing(false);
    }
  }

  function handleStatusChange(id: string, status: string) {
    setCompanies(current => current.map(company => company.id === id
      ? { ...company, properties: { ...company.properties, hs_lead_status: status } }
      : company));
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
          {lists.slice(0, 10).map(list => <button key={list.listId} onClick={() => setSegmentId(list.listId)} className={`relative flex h-11 shrink-0 items-center gap-2 rounded-t-xl border border-b-0 px-4 text-sm ${segmentId === list.listId ? "border-border bg-background font-semibold text-foreground before:absolute before:inset-x-3 before:top-0 before:h-[2px] before:bg-primary" : "border-transparent text-muted-foreground hover:bg-muted/60"}`}><span className="max-w-[150px] truncate">{list.name}</span>{list.size !== undefined ? <Badge variant="secondary" className="text-[10px]">{list.size}</Badge> : null}</button>)}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-5 pt-4 lg:px-7">
        <Card className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <div>
              <h1 className="font-display text-lg font-bold tracking-tight">{currentList?.name || "Prospection par entreprise"}</h1>
              <p className="mt-0.5 text-xs text-muted-foreground"><strong className="text-foreground">{total}</strong> comptes HubSpot · {reminders} rappels · {opportunities} opportunités</p>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/[0.05] px-3 py-2 text-xs text-muted-foreground"><strong className="text-primary">Company-first</strong> · appeler une personne, faire avancer le compte</div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-y border-border bg-muted/30 px-4 py-2.5">
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
              <Button variant={view === "board" ? "secondary" : "ghost"} size="sm" className="h-7 gap-1.5" onClick={() => setView("board")}><SquareKanban size={14} /> Pipeline comptes</Button>
              <Button variant={view === "table" ? "secondary" : "ghost"} size="sm" className="h-7 gap-1.5" onClick={() => setView("table")}><Table2 size={14} /> Tableau</Button>
            </div>
            <Select value={owner || "all"} onValueChange={value => setOwner(value === "all" ? "" : value)}><SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Commercial" /></SelectTrigger><SelectContent><SelectItem value="all">Tous les commerciaux</SelectItem>{owners.map(item => <SelectItem key={item.id} value={item.id}>{ownerNames[item.id]}</SelectItem>)}</SelectContent></Select>
            <Select value={leadStatus || "all"} onValueChange={value => setLeadStatus(value === "all" ? "" : value)}><SelectTrigger className="h-9 w-[165px]"><SelectValue placeholder="Statut compte" /></SelectTrigger><SelectContent><SelectItem value="all">Tous les statuts</SelectItem>{COMPANY_PIPELINE.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
            <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Entreprise, ville…" className="h-9 w-52 pl-9" /></div>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => void sync()} disabled={syncing}>{syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {syncing ? "Synchronisation…" : "Synchroniser"}</Button>
          </div>

          {error ? <div className="mx-4 mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

          {view === "board" ? <CompanyProspectionBoard companies={filtered} ownerNames={ownerNames} loading={loading} onOpenCompany={setDrawerId} onStatusChange={handleStatusChange} onError={setError} /> : null}

          {view === "table" ? <div className="min-h-0 flex-1 overflow-auto border-t border-border minari-scrollbar"><Table className="min-w-[1150px]"><TableHeader><TableRow><TableHead>Entreprise</TableHead><TableHead>Statut compte</TableHead><TableHead>Dernier appel</TableHead><TableHead>Rappel</TableHead><TableHead>Contacts</TableHead><TableHead>Deals</TableHead><TableHead>Commercial</TableHead><TableHead>Dernière activité</TableHead></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={8} className="h-64 text-center"><Loader2 className="mx-auto animate-spin text-primary" /></TableCell></TableRow> : filtered.map(company => { const p = company.properties; return <TableRow key={company.id} className="cursor-pointer" onClick={() => setDrawerId(company.id)}><TableCell><div className="flex items-center gap-2"><Avatar className="h-7 w-7 rounded-lg bg-accent"><AvatarFallback className="rounded-lg bg-accent text-primary"><Building2 size={13} /></AvatarFallback></Avatar><div><div className="font-medium">{p.name || "Sans nom"}</div><div className="text-[11px] text-muted-foreground">{p.domain || "—"}</div></div></div></TableCell><TableCell><Badge variant="outline">{LEAD_LABELS[p.hs_lead_status || "NEW"] || p.hs_lead_status || "À travailler"}</Badge></TableCell><TableCell>{callLabel(p.statut_de_lappel)}</TableCell><TableCell className="text-xs text-muted-foreground">{formatDate(p.date_de_rappel || p.notes_next_activity_date)}</TableCell><TableCell>{p.num_associated_contacts || 0}</TableCell><TableCell>{p.num_associated_deals || 0}</TableCell><TableCell>{p.hubspot_owner_id ? ownerNames[p.hubspot_owner_id] || "—" : "—"}</TableCell><TableCell className="text-xs text-muted-foreground">{formatDate(p.notes_last_updated || p.hs_last_sales_activity_timestamp)}</TableCell></TableRow>; })}{!loading && !filtered.length ? <TableRow><TableCell colSpan={8} className="h-40 text-center text-muted-foreground">Aucune entreprise pour ces filtres.</TableCell></TableRow> : null}</TableBody></Table></div> : null}
        </Card>
      </div>

      <CompanyDrawer companyId={drawerId} open={Boolean(drawerId)} onOpenChange={open => !open && setDrawerId(null)} />
    </div>
  );
}
