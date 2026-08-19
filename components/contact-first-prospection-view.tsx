"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ListFilter,
  Loader2,
  Phone,
  Plus,
  RefreshCw,
  Search,
  SquareKanban,
  Table2,
  Users,
} from "lucide-react";
import { CallRecommendationStrip } from "@/components/call-recommendation-strip";
import { ContactDrawer } from "@/components/contact-drawer";
import { NewContactDialog } from "@/components/new-contact-dialog";
import { ProspectionBoard } from "@/components/prospection-board";
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
} from "@/lib/contact-prospection-priority";
import type { ProspectionBucket } from "@/lib/company-prospection-priority";
import { formatDate, initials } from "@/lib/utils";

type Contact = { id: string; properties: Record<string, string | null | undefined> };
type List = { listId: string; name: string; objectTypeId: string; size?: number };
type Owner = { id: string; firstName?: string; lastName?: string; email?: string };
type ViewMode = "board" | "table";
type WorkFilter = ProspectionBucket | "ALL";

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

export function ContactFirstProspectionView() {
  const [lists, setLists] = useState<List[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [segmentId, setSegmentId] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("");
  const [prospectionStatus, setProspectionStatus] = useState("");
  const [workFilter, setWorkFilter] = useState<WorkFilter>("ACTIONABLE");
  const [view, setView] = useState<ViewMode>("board");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [newContactOpen, setNewContactOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/segments", { cache: "no-store" }).then(response => response.json()),
      fetch("/api/owners", { cache: "no-store" }).then(response => response.json()),
    ])
      .then(([segmentData, ownerData]) => {
        const contactLists = ((segmentData.lists || []) as List[]).filter(item => item.objectTypeId === "0-1");
        setLists(contactLists);
        setOwners(ownerData.results || []);
        setSegmentId(contactLists[0]?.listId || "");
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : "Impossible de charger la prospection contacts"));
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
      if (!segmentId && prospectionStatus) params.set("prospection", prospectionStatus);
      const response = await fetch(`/api/contacts?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossible de charger les contacts HubSpot");
      setContacts(payload.results || []);
      setTotal(payload.total || payload.results?.length || 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur de chargement");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [segmentId]);

  const baseFiltered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return contacts.filter(contact => {
      const p = contact.properties;
      const haystack = [p.firstname, p.lastname, p.email, p.phone, p.mobilephone, p.company, p.jobtitle]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (!needle || haystack.includes(needle))
        && (!owner || p.hubspot_owner_id === owner)
        && (!prospectionStatus || p.statut_prospection === prospectionStatus);
    });
  }, [contacts, query, owner, prospectionStatus]);

  const classified = useMemo(() => {
    const now = Date.now();
    return baseFiltered
      .slice()
      .sort((a, b) => compareContactProspectionPriority(a, b, now))
      .map(contact => ({ contact, decision: getContactProspectionDecision(contact, now) }));
  }, [baseFiltered]);

  const filteredContacts = useMemo(
    () => classified
      .filter(item => workFilter === "ALL" || item.decision.bucket === workFilter)
      .map(item => item.contact),
    [classified, workFilter],
  );

  const recommendations = useMemo(() => classified
    .filter(item => item.decision.bucket === "ACTIONABLE")
    .slice(0, 3)
    .map(({ contact, decision }) => {
      const p = contact.properties;
      const fullName = [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Contact sans nom";
      return {
        id: contact.id,
        title: fullName,
        subtitle: [p.company, callLabel(p.statut_de_lappel)].filter(Boolean).join(" · "),
        phone: p.phone || p.mobilephone,
        priorityLabel: decision.priorityLabel,
        reason: decision.reason,
        suggestion: decision.suggestion,
      };
    }), [classified]);

  const actionableCount = classified.filter(item => item.decision.bucket === "ACTIONABLE").length;
  const opportunities = classified.filter(item => item.decision.bucket === "OPPORTUNITY").length;
  const snoozed = classified.filter(item => item.decision.bucket === "SNOOZED").length;
  const excluded = classified.filter(item => item.decision.bucket === "EXCLUDED").length;
  const currentList = lists.find(item => item.listId === segmentId);

  async function sync() {
    setSyncing(true);
    setError("");
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

  function handleBoardStatusChange(contactId: string, status: string) {
    setContacts(current => current.map(contact => contact.id === contactId
      ? { ...contact, properties: { ...contact.properties, statut_prospection: status } }
      : contact));
    void load(true);
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
          <button onClick={() => setSegmentId("")} className={`relative flex h-11 shrink-0 items-center rounded-t-xl border border-b-0 px-4 text-sm ${!segmentId ? "border-border bg-background font-semibold" : "border-transparent text-muted-foreground hover:bg-muted/60"}`}>Tous les contacts</button>
          {lists.map(list => (
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
              <h1 className="font-display text-lg font-bold tracking-tight">{currentList?.name || "Prospection par contact"}</h1>
              <p className="mt-0.5 text-xs text-muted-foreground"><strong className="text-primary">{actionableCount} à appeler</strong> · {opportunities} RDV/opportunités · {snoozed} relances futures · {excluded} exclus · {total} contacts au total</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden rounded-lg border border-primary/20 bg-primary/[0.05] px-3 py-2 text-xs text-muted-foreground xl:block"><strong className="text-primary">Priorité automatique</strong> · le statut HubSpot décide de l'ordre de traitement.</div>
              <Button size="sm" className="h-9 gap-1.5" onClick={() => setNewContactOpen(true)}><Plus size={14} /> Nouveau contact</Button>
            </div>
          </div>

          <CallRecommendationStrip items={recommendations} onOpen={setDrawerId} />

          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
              <Button variant={view === "board" ? "secondary" : "ghost"} size="sm" className="h-7 gap-1.5" onClick={() => setView("board")}><SquareKanban size={14} /> Pipeline contacts</Button>
              <Button variant={view === "table" ? "secondary" : "ghost"} size="sm" className="h-7 gap-1.5" onClick={() => setView("table")}><Table2 size={14} /> Tableau</Button>
            </div>
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
            <Select value={owner || "all"} onValueChange={value => setOwner(value === "all" ? "" : value)}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Commercial" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tous les commerciaux</SelectItem>{owners.map(item => <SelectItem key={item.id} value={item.id}>{ownerNames[item.id]}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={prospectionStatus || "all"} onValueChange={value => setProspectionStatus(value === "all" ? "" : value)}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Statut prospection" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tous les statuts</SelectItem>{PROSPECTION_OPTIONS.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
            </Select>
            <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Contact, société…" className="h-9 w-52 pl-9" /></div>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => void sync()} disabled={syncing}>{syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {syncing ? "Synchronisation…" : "Synchroniser"}</Button>
            <span className="ml-auto text-[11px] text-muted-foreground">La file est recalculée à chaque changement de statut ou de relance.</span>
          </div>

          {error ? <div className="mx-4 mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

          {view === "board" ? (
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
              <Table className="min-w-[1250px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Priorité</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Statut prospection</TableHead>
                    <TableHead>Dernier appel</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Prochaine relance</TableHead>
                    <TableHead>Commercial</TableHead>
                    <TableHead>Dernière activité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? <TableRow><TableCell colSpan={9} className="h-64 text-center"><Loader2 className="mx-auto animate-spin text-primary" /></TableCell></TableRow> : filteredContacts.map(contact => {
                    const p = contact.properties;
                    const decision = getContactProspectionDecision(contact);
                    const fullName = [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Sans nom";
                    return (
                      <TableRow key={contact.id} className="cursor-pointer" onClick={() => setDrawerId(contact.id)}>
                        <TableCell>
                          <div className="min-w-[145px]">
                            <Badge variant={decision.bucket === "ACTIONABLE" ? "secondary" : "outline"}>{decision.priorityLabel}</Badge>
                            <div className="mt-1 max-w-[190px] text-[10px] leading-4 text-muted-foreground">{decision.suggestion}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7 bg-accent"><AvatarFallback className="bg-accent text-[9px] font-bold text-primary">{initials(p.firstname, p.lastname)}</AvatarFallback></Avatar>
                            <div><div className="font-medium">{fullName}</div><div className="text-[11px] text-muted-foreground">{p.jobtitle || p.email || "—"}</div></div>
                          </div>
                        </TableCell>
                        <TableCell>{p.company || "—"}</TableCell>
                        <TableCell><Badge variant="outline">{p.statut_prospection || "À prospecter"}</Badge></TableCell>
                        <TableCell>{callLabel(p.statut_de_lappel)}</TableCell>
                        <TableCell>{p.phone || p.mobilephone ? <a href={`tel:${p.phone || p.mobilephone}`} onClick={event => event.stopPropagation()} className="phone-chip font-mono text-xs"><Phone size={12} />{p.phone || p.mobilephone}</a> : "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{reminderValue(p) ? formatDate(reminderValue(p)) : "—"}</TableCell>
                        <TableCell>{p.hubspot_owner_id ? ownerNames[p.hubspot_owner_id] || "—" : "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(p.notes_last_contacted || p.hs_last_sales_activity_timestamp)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!loading && !filteredContacts.length ? <TableRow><TableCell colSpan={9} className="h-40 text-center text-muted-foreground">Aucun contact pour ces filtres.</TableCell></TableRow> : null}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </Card>
      </div>

      <ContactDrawer contactId={drawerId} open={Boolean(drawerId)} onOpenChange={open => !open && setDrawerId(null)} onUpdated={() => void load(true)} />
      <NewContactDialog open={newContactOpen} onOpenChange={setNewContactOpen} onCreated={() => void load(true)} />
    </div>
  );
}
