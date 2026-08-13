"use client";
import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronLeft, ChevronRight, Filter, ListChecks, Loader2, MoreVertical, Phone, PlusCircle, RefreshCw, Search, SlidersHorizontal, SquareKanban, Star, Table2, UserPlus, UserRound, Users } from "lucide-react";
import { ContactDrawer } from "@/components/contact-drawer";
import { CompanyDrawer } from "@/components/company-drawer";
import { NewContactDialog } from "@/components/new-contact-dialog";
import { ProspectionBoard } from "@/components/prospection-board";
import { ProspectionTasks } from "@/components/prospection-tasks";
import { formatDate, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Contact = { id: string; properties: Record<string, string | null | undefined> };
type Company = { id: string; properties: Record<string, string | null | undefined> };
type List = { listId: string; name: string; objectTypeId: string; size?: number; processingType?: string };
type Owner = { id: string; firstName?: string; lastName?: string; email?: string };
type ObjectType = "0-1" | "0-2";

const PROSPECTION_BADGES: Record<string, string> = {
  "À prospecter": "border-white/10 bg-white/5 text-slate-300",
  "En prospection": "border-amber-400/30 bg-amber-400/10 text-amber-300",
  "Conversation": "border-sky-400/30 bg-sky-400/10 text-sky-300",
  "RDV booké": "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  "À recycler": "border-orange-400/30 bg-orange-400/10 text-orange-300",
  "Non qualifié": "border-rose-400/30 bg-rose-400/10 text-rose-300",
  "Perdu": "border-rose-400/30 bg-rose-400/10 text-rose-300",
};

const PROSPECTION_OPTIONS = ["À prospecter", "En prospection", "Conversation", "RDV booké", "À recycler", "Non qualifié", "Perdu"];
const CALL_OPTIONS = ["Intéressé", "A Rappeler", "NRP", "HORS CIBLE", "Occupé", "pas intéressé"];

const CALL_BADGES: Record<string, string> = {
  "NRP": "border-white/15 bg-white/5 text-slate-300",
  "Occupé": "border-white/15 bg-white/5 text-slate-300",
  "HORS CIBLE": "border-rose-400/30 bg-rose-400/10 text-rose-300",
  "pas intéressé": "border-rose-400/30 bg-rose-400/10 text-rose-300",
  "A Rappeler": "border-amber-400/30 bg-amber-400/10 text-amber-300",
  "Intéressé": "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
};

function prospectionBadge(status?: string | null) {
  if (!status) return "border-white/10 bg-white/5 text-slate-400";
  return PROSPECTION_BADGES[status] || "border-white/10 bg-card text-slate-300";
}

function callBadge(status?: string | null) {
  if (!status) return "border-white/10 bg-muted text-muted-foreground";
  return CALL_BADGES[status] || "border-white/10 bg-muted/60 text-slate-300";
}

type PeriodPreset = "all" | "jour" | "semaine" | "mois" | "trimestre" | "annee" | "custom";

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function startOfWeek(d: Date) { const x = startOfDay(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x; }
function toMs(value?: string | null) {
  if (!value) return NaN;
  const s = String(value).trim();
  const n = Number(s);
  const t = s.length >= 12 && Number.isFinite(n) ? n : NaN;
  const d = Number.isNaN(t) ? new Date(s).getTime() : t;
  return Number.isFinite(d) ? d : NaN;
}

export function ProspectionView() {
  const [lists, setLists] = useState<List[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [objectType, setObjectType] = useState<ObjectType>("0-2");
  const [segmentId, setSegmentId] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [after, setAfter] = useState<string | undefined>();
  const [nextAfter, setNextAfter] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("");
  const [callStatus, setCallStatus] = useState("");
  const [prospection, setProspection] = useState("");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [companyDrawerId, setCompanyDrawerId] = useState<string | null>(null);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [view, setView] = useState<"table" | "board" | "tasks">("table");
  const [preset, setPreset] = useState<PeriodPreset>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const periodRange = useMemo(() => {
    const now = new Date();
    switch (preset) {
      case "jour": return { start: startOfDay(now), end: endOfDay(now) };
      case "semaine": return { start: startOfWeek(now), end: endOfDay(now) };
      case "mois": return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) };
      case "trimestre": { const qm = Math.floor(now.getMonth() / 3); return { start: new Date(now.getFullYear(), qm * 3, 1), end: endOfDay(now) }; }
      case "annee": return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(now) };
      case "custom": {
        if (!customStart || !customEnd) return null;
        const s = new Date(`${customStart}T00:00:00`);
        const e = new Date(`${customEnd}T23:59:59`);
        if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e) return null;
        return { start: s, end: e };
      }
      default: return null;
    }
  }, [preset, customStart, customEnd]);

  useEffect(() => {
    Promise.all([fetch("/api/segments").then(r => r.json()), fetch("/api/owners").then(r => r.json())])
      .then(([l, o]) => {
        const allLists = (l.lists || []) as List[];
        setLists(allLists);
        setOwners(o.results || []);
        const companyLists = allLists.filter(x => x.objectTypeId === "0-2");
        const contactLists = allLists.filter(x => x.objectTypeId === "0-1");
        if (companyLists.length) {
          setObjectType("0-2");
          setSegmentId(companyLists[0].listId);
        } else {
          setObjectType("0-1");
          const teori = contactLists.find(x => x.name.toLowerCase().includes("teori"));
          setSegmentId(teori ? teori.listId : contactLists[0]?.listId ?? "");
        }
      });
  }, []);

  function switchType(type: ObjectType) {
    setObjectType(type);
    setView("table");
    setAfter(undefined);
    setNextAfter(undefined);
    const pool = lists.filter(l => l.objectTypeId === type);
    setSegmentId(pool[0]?.listId ?? "");
  }

  async function loadContacts(reset = false, cursor?: string, silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const p = new URLSearchParams();
      if (segmentId) p.set("segmentId", segmentId);
      if (q && !segmentId) p.set("q", q);
      if (owner && !segmentId) p.set("owner", owner);
      if (callStatus && !segmentId) p.set("callStatus", callStatus);
      if (prospection && !segmentId) p.set("prospection", prospection);
      if (periodRange && !segmentId) { p.set("start", periodRange.start.toISOString()); p.set("end", periodRange.end.toISOString()); }
      const activeCursor = reset ? undefined : (cursor ?? after);
      if (activeCursor) p.set("after", activeCursor);
      const r = await fetch(`/api/contacts?${p}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Impossible de charger HubSpot");
      let rows = d.results || [];
      if (segmentId) {
        const low = q.toLowerCase();
        const ps = periodRange ? periodRange.start.getTime() : NaN;
        const pe = periodRange ? periodRange.end.getTime() : NaN;
        rows = rows.filter((c: Contact) => {
          const props = c.properties;
          const txt = [props.firstname, props.lastname, props.email, props.phone, props.company].join(" ").toLowerCase();
          if (periodRange) {
            const t = toMs(props.hs_last_sales_activity_timestamp);
            if (Number.isNaN(t) || t < ps || t > pe) return false;
          }
          return (!q || txt.includes(low)) && (!owner || props.hubspot_owner_id === owner) && (!callStatus || props.statut_de_lappel === callStatus) && (!prospection || props.statut_prospection === prospection);
        });
      }
      setContacts(rows);
      setTotal(d.total || rows.length);
      setNextAfter(d.paging?.next?.after);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadCompanies(reset = false, cursor?: string, silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const p = new URLSearchParams();
      if (segmentId) p.set("segmentId", segmentId);
      if (q && !segmentId) p.set("q", q);
      if (owner && !segmentId) p.set("owner", owner);
      if (periodRange && !segmentId) { p.set("start", periodRange.start.toISOString()); p.set("end", periodRange.end.toISOString()); }
      const activeCursor = reset ? undefined : (cursor ?? after);
      if (activeCursor) p.set("after", activeCursor);
      const r = await fetch(`/api/companies?${p}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Impossible de charger HubSpot");
      let rows = d.results || [];
      if (segmentId) {
        const low = q.toLowerCase();
        const ps = periodRange ? periodRange.start.getTime() : NaN;
        const pe = periodRange ? periodRange.end.getTime() : NaN;
        rows = rows.filter((c: Company) => {
          const props = c.properties;
          const txt = [props.name, props.domain, props.city, props.state, props.industry].join(" ").toLowerCase();
          if (periodRange) {
            const t = toMs(props.hs_last_sales_activity_timestamp);
            if (Number.isNaN(t) || t < ps || t > pe) return false;
          }
          return (!q || txt.includes(low)) && (!owner || props.hubspot_owner_id === owner);
        });
      }
      setCompanies(rows);
      setTotal(d.total || rows.length);
      setNextAfter(d.paging?.next?.after);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function load(reset = false, cursor?: string, silent = false) {
    if (objectType === "0-2") return loadCompanies(reset, cursor, silent);
    return loadContacts(reset, cursor, silent);
  }

  function handleBoardStatusChange(id: string, status: string) {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, properties: { ...c.properties, statut_prospection: status } } : c));
    load(true, undefined, true);
  }

  useEffect(() => { if (view === "tasks") return; load(true); }, [objectType, segmentId, owner, callStatus, prospection, periodRange, view]);
  useEffect(() => { if (view === "tasks") return; const t = setTimeout(() => load(true), 300); return () => clearTimeout(t); }, [q]);

  const isCompany = objectType === "0-2";
  const activeLists = lists.filter(l => l.objectTypeId === objectType);
  const currentList = lists.find(l => l.listId === segmentId);
  const ownerNames = Object.fromEntries(owners.map(o => [o.id, [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || o.id]));
  const attempted = contacts.filter(c => c.properties.statut_de_lappel).length;
  const connected = contacts.filter(c => { const s = (c.properties.statut_de_lappel || "").toLowerCase(); return s && !["nrp", "occupé", "numéro invalide", "hors cible"].some(x => s.includes(x)); }).length;
  const pending = Math.max(0, contacts.length - attempted);

  return (
    <div className="flex h-full min-h-[calc(100vh-24px)] flex-col overflow-hidden">
      {/* Segment tabs */}
      <div className="flex shrink-0 items-end gap-1.5 border-b border-border bg-card/80 px-5 pt-3 backdrop-blur minari-scrollbar">
        <div className="mb-2 flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
          <Button size="sm" variant={objectType === "0-1" ? "secondary" : "ghost"} className="h-8 gap-1.5 rounded-md px-3" onClick={() => switchType("0-1")}><Users size={14} /> Contacts</Button>
          <Button size="sm" variant={objectType === "0-2" ? "secondary" : "ghost"} className="h-8 gap-1.5 rounded-md px-3" onClick={() => switchType("0-2")}><Building2 size={14} /> Entreprises</Button>
        </div>
        <Button asChild variant="ghost" size="sm" className="mb-2 h-9 gap-2 rounded-lg px-3 font-semibold text-violet-300 hover:bg-accent/60 hover:text-violet-200">
          <a href="/segments"><PlusCircle size={15} /> New list</a>
        </Button>
        <div className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto">
          {activeLists.length === 0 ? <div className="flex h-11 items-center gap-2 text-sm text-muted-foreground">Aucun segment {objectType === "0-2" ? "d'entreprises" : "de contacts"}. Créez-en un sur la page Segments.</div> : null}
          {activeLists.slice(0, 8).map(l => {
            const active = segmentId === l.listId;
            return (
              <button key={l.listId} onClick={() => { setAfter(undefined); setSegmentId(l.listId); }}
                className={`relative flex h-11 shrink-0 items-center gap-2 rounded-t-xl border border-b-0 px-4 text-sm transition-colors ${
                  active
                    ? "border-border bg-background font-semibold text-foreground before:absolute before:inset-x-3 before:top-0 before:h-[2px] before:rounded-full before:bg-violet-400 before:shadow-[0_0_10px_rgba(115,93,243,0.8)]"
                    : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}>
                <span className="max-w-[160px] truncate">{l.name}</span>
                {l.size !== undefined && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{l.size}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-hidden p-5 pt-4">
        <Card className="flex h-full min-h-0 flex-col overflow-hidden">
          {/* Card header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <div>
                <h1 className="font-display text-lg font-bold tracking-tight">{currentList?.name || (isCompany ? "Toutes les entreprises" : "Tous les contacts")}</h1>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <Star size={13} className="fill-slate-500 text-slate-500" />
                  <span><span className="font-semibold text-foreground">{total}</span> {isCompany ? "entreprises" : "contacts"}</span>
                  <span className="text-border">·</span>
                  <span>Actualisé à l'instant</span>
                </div>
              </div>
              <MoreVertical size={16} className="self-start text-muted-foreground" />
            </div>
            {isCompany ? <div className="flex items-center gap-5 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-violet-300"><Building2 size={14} /> {total} entreprises</span>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={() => load(true)}><RefreshCw size={13} /> Refresh</Button>
            </div> : <div className="flex items-center gap-5 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-violet-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-400" />
                </span>
                {connected} connectés
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Attempted <span className="font-semibold text-foreground">{attempted}</span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" /> Pending <span className="font-semibold text-foreground">{pending}</span>
              </span>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={() => load(true)}><RefreshCw size={13} /> Refresh</Button>
            </div>}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-y border-border bg-muted/20 px-4 py-2.5">
            <div className="mr-1 flex items-center gap-0.5 rounded-lg border border-border bg-card/70 p-0.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]">
              <Button variant={view === "table" ? "secondary" : "ghost"} size="sm" className="h-7 gap-1.5 px-3 rounded-md" onClick={() => setView("table")}><Table2 size={14} /> Table</Button>
              {!isCompany ? <Button variant={view === "board" ? "secondary" : "ghost"} size="sm" className="h-7 gap-1.5 px-3 rounded-md" onClick={() => setView("board")}><SquareKanban size={14} /> Board</Button> : null}
              {!isCompany ? <Button variant={view === "tasks" ? "secondary" : "ghost"} size="sm" className="h-7 gap-1.5 px-3 rounded-md" onClick={() => setView("tasks")}><ListChecks size={14} /> Tâches</Button> : null}
            </div>
            <Button size="sm" className="h-9 gap-1.5" onClick={() => setNewContactOpen(true)}><UserPlus size={14} /> Nouveau contact</Button>
            <Button variant="outline" size="sm" className="h-9 text-muted-foreground"><Phone size={14} /> Account enabled</Button>
            <Button variant="outline" size="sm" className="h-9 text-muted-foreground"><SlidersHorizontal size={14} /> Sorted by <Badge variant="secondary" className="ml-1 bg-accent/60 text-violet-200">Last call</Badge></Button>
            <Select value={owner === "" ? "all" : owner} onValueChange={v => { setAfter(undefined); setOwner(v === "all" ? "" : v); }}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Commercial" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Commercial</SelectItem>
                {owners.map(o => <SelectItem key={o.id} value={o.id}>{[o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || o.id}</SelectItem>)}
              </SelectContent>
            </Select>
            {view !== "tasks" ? <>
            {!isCompany ? <Select value={callStatus === "" ? "all" : callStatus} onValueChange={v => { setAfter(undefined); setCallStatus(v === "all" ? "" : v); }}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Statut appel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Statut appel</SelectItem>
                {CALL_OPTIONS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select> : null}
            {!isCompany ? <Select value={prospection === "" ? "all" : prospection} onValueChange={v => { setAfter(undefined); setProspection(v === "all" ? "" : v); }}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Prospection" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Prospection</SelectItem>
                {PROSPECTION_OPTIONS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select> : null}
            <Select value={preset} onValueChange={v => { setAfter(undefined); setPreset(v as PeriodPreset); }}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Période" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes périodes</SelectItem>
                <SelectItem value="jour">Jour</SelectItem>
                <SelectItem value="semaine">Semaine</SelectItem>
                <SelectItem value="mois">Mois</SelectItem>
                <SelectItem value="trimestre">Trimestre</SelectItem>
                <SelectItem value="annee">Année</SelectItem>
                <SelectItem value="custom">Personnalisé</SelectItem>
              </SelectContent>
            </Select>
            {preset === "custom" ? <>
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-9 w-40" />
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-9 w-40" />
            </> : null}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher" className="h-9 w-44 pl-9" />
            </div>
            <Button variant="outline" size="sm" className="h-9"><Filter size={14} /> Filter</Button>
            </> : null}
          </div>

          {error ? <div className="mx-4 mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

          {view === "board" ? <ProspectionBoard contacts={contacts} segmentId={segmentId} loading={loading} onOpenContact={setDrawerId} onStatusChange={handleBoardStatusChange} onError={setError} /> : null}

          {view === "tasks" && !isCompany ? <ProspectionTasks segmentId={segmentId} owner={owner} owners={ownerNames} onOpenContact={setDrawerId} onError={setError} onUpdated={() => load(true)} /> : null}

          {view === "table" && isCompany ? <div className="min-h-0 flex-1 overflow-auto border-t border-border minari-scrollbar">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 px-4"><input type="checkbox" className="accent-violet-400" /></TableHead>
                  <TableHead className="px-3">Entreprise</TableHead>
                  <TableHead className="px-3">Contacts</TableHead>
                  <TableHead className="px-3">Domaine</TableHead>
                  <TableHead className="px-3">Téléphone</TableHead>
                  <TableHead className="px-3">Localisation</TableHead>
                  <TableHead className="px-3">Commercial</TableHead>
                  <TableHead className="px-3">Dernière activité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <TableRow className="hover:bg-transparent"><TableCell colSpan={8} className="h-64 text-center"><Loader2 className="mx-auto animate-spin text-violet-300" /></TableCell></TableRow>
                  : companies.map(c => {
                      const p = c.properties;
                      const loc = [p.city, p.state].filter(Boolean).join(", ");
                      const count = p.num_associated_contacts ? Number(p.num_associated_contacts) : 0;
                      return (
                        <TableRow key={c.id} className="group">
                          <TableCell className="px-4"><input type="checkbox" className="accent-violet-400" /></TableCell>
                          <TableCell className="px-3">
                            <Button variant="ghost" size="sm" className="h-8 gap-2 rounded-full border border-white/10 bg-card/60 pl-1 pr-3 font-medium shadow-sm hover:border-violet-400/40 hover:bg-accent/40"
                              onClick={() => setCompanyDrawerId(c.id)}>
                              <Avatar className="h-6 w-6 bg-accent"><AvatarFallback className="bg-accent text-[9px] font-bold text-violet-300"><Building2 size={12} /></AvatarFallback></Avatar>
                              {p.name || "Sans nom"}
                            </Button>
                          </TableCell>
                          <TableCell className="px-3"><span className="inline-flex items-center gap-2 text-muted-foreground"><Users size={14} /> {count || "—"}</span></TableCell>
                          <TableCell className="px-3 font-mono text-xs text-muted-foreground">{p.domain || "—"}</TableCell>
                          <TableCell className="px-3">
                            <a href={p.phone ? `tel:${p.phone}` : "#"}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/25 bg-violet-400/5 px-2.5 py-1 font-mono text-xs text-violet-200 transition-colors hover:border-violet-400/50 hover:bg-violet-400/10">
                              <Phone size={12} />{p.phone || "—"}
                            </a>
                          </TableCell>
                          <TableCell className="px-3 text-muted-foreground">{loc || "—"}</TableCell>
                          <TableCell className="px-3 text-muted-foreground">{p.hubspot_owner_id ? ownerNames[p.hubspot_owner_id] || "—" : "—"}</TableCell>
                          <TableCell className="px-3 font-mono text-xs text-muted-foreground">{formatDate(p.hs_last_sales_activity_timestamp)}</TableCell>
                        </TableRow>
                      );
                    })}
                {!loading && !companies.length ? <TableRow className="hover:bg-transparent"><TableCell colSpan={8} className="h-48 text-center text-muted-foreground">Aucune entreprise pour ces filtres.</TableCell></TableRow> : null}
              </TableBody>
            </Table>

            <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
              <span><span className="font-semibold text-foreground">1 - {companies.length}</span> sur {total}</span>
              <Button variant="outline" size="icon" disabled={!after} onClick={() => { setAfter(undefined); setTimeout(() => load(true), 0); }}><ChevronLeft size={15} /></Button>
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-violet-400/30 bg-accent/50 font-semibold text-violet-200">1</span>
              <Button variant="outline" size="icon" disabled={!nextAfter} onClick={() => { setAfter(nextAfter); load(false, nextAfter); }}><ChevronRight size={15} /></Button>
            </div>
          </div> : null}

          {view === "table" && !isCompany ? <div className="min-h-0 flex-1 overflow-auto border-t border-border minari-scrollbar">
            <Table className="min-w-[1220px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 px-4"><input type="checkbox" className="accent-violet-400" /></TableHead>
                  <TableHead className="px-3">Call status</TableHead>
                  <TableHead className="px-3">Calls</TableHead>
                  <TableHead className="px-3">Name</TableHead>
                  <TableHead className="px-3">Title</TableHead>
                  <TableHead className="px-3">Company</TableHead>
                  <TableHead className="px-3">Last call</TableHead>
                  <TableHead className="px-3">Status</TableHead>
                  <TableHead className="px-3">Phone number</TableHead>
                  <TableHead className="px-3">Statut prospection</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <TableRow className="hover:bg-transparent"><TableCell colSpan={10} className="h-64 text-center"><Loader2 className="mx-auto animate-spin text-violet-300" /></TableCell></TableRow>
                  : contacts.map(c => {
                      const p = c.properties;
                      const full = [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Sans nom";
                      return (
                        <TableRow key={c.id} className="group">
                          <TableCell className="px-4"><input type="checkbox" className="accent-violet-400" /></TableCell>
                          <TableCell className="px-3"><Badge variant="outline" className={`font-medium ${callBadge(p.statut_de_lappel)}`}>{p.statut_de_lappel || "Pending"}</Badge></TableCell>
                          <TableCell className="px-3"><span className="inline-flex items-center gap-2 text-muted-foreground"><Phone size={14} /> {Number(p.minari_call_count || 0)}</span></TableCell>
                          <TableCell className="px-3">
                            <Button variant="ghost" size="sm" className="h-8 gap-2 rounded-full border border-white/10 bg-card/60 pl-1 pr-3 font-medium shadow-sm hover:border-violet-400/40 hover:bg-accent/40"
                              onClick={() => setDrawerId(c.id)}>
                              <Avatar className="h-6 w-6 bg-accent"><AvatarFallback className="bg-accent text-[9px] font-bold text-violet-300">{initials(p.firstname, p.lastname)}</AvatarFallback></Avatar>
                              {full}
                            </Button>
                          </TableCell>
                          <TableCell className="px-3 text-muted-foreground">{p.jobtitle || "—"}</TableCell>
                          <TableCell className="px-3 font-medium text-foreground">{p.company || "—"}</TableCell>
                          <TableCell className="px-3 font-mono text-xs text-muted-foreground">{formatDate(p.notes_last_contacted || p.hs_last_sales_activity_timestamp)}</TableCell>
                          <TableCell className="px-3 text-muted-foreground">{p.resultat_prospection || "—"}</TableCell>
                          <TableCell className="px-3">
                            <a href={p.phone ? `tel:${p.phone}` : "#"}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/25 bg-violet-400/5 px-2.5 py-1 font-mono text-xs text-violet-200 transition-colors hover:border-violet-400/50 hover:bg-violet-400/10">
                              <Phone size={12} />{p.phone || p.mobilephone || "—"}
                            </a>
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate px-3"><Badge variant="outline" className={`font-medium ${prospectionBadge(p.statut_prospection)}`}>{p.statut_prospection || "—"}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                {!loading && !contacts.length ? <TableRow className="hover:bg-transparent"><TableCell colSpan={10} className="h-48 text-center text-muted-foreground">Aucun contact pour ces filtres.</TableCell></TableRow> : null}
              </TableBody>
            </Table>

            <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
              <span><span className="font-semibold text-foreground">1 - {contacts.length}</span> sur {total}</span>
              <Button variant="outline" size="icon" disabled={!after} onClick={() => { setAfter(undefined); setTimeout(() => load(true), 0); }}><ChevronLeft size={15} /></Button>
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-violet-400/30 bg-accent/50 font-semibold text-violet-200">1</span>
              <Button variant="outline" size="icon" disabled={!nextAfter} onClick={() => { setAfter(nextAfter); load(false, nextAfter); }}><ChevronRight size={15} /></Button>
            </div>
          </div> : null}
        </Card>
      </div>

      <ContactDrawer contactId={drawerId} open={Boolean(drawerId)} onOpenChange={o => !o && setDrawerId(null)} onUpdated={() => load(true)} />
      <CompanyDrawer companyId={companyDrawerId} open={Boolean(companyDrawerId)} onOpenChange={o => !o && setCompanyDrawerId(null)} />
      <NewContactDialog open={newContactOpen} onOpenChange={setNewContactOpen} onCreated={() => load(true)} />
    </div>
  );
}
