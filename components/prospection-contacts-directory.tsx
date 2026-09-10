"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ListFilter, Loader2, Mail, MapPin, Phone, RefreshCw, Search, Table2, UserRound, UserRoundCheck, UserRoundX } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchAllPagedResults } from "@/lib/fetch-all-paged-results";
import { formatDate, initials } from "@/lib/utils";

type Contact = { id: string; properties: Record<string, string | null | undefined> };
type Owner = { id: string; firstName?: string; lastName?: string; email?: string };
type List = { listId: string; name: string; objectTypeId: string; size?: number };
type DirectoryFilter = "CALLABLE" | "FOLLOW_UP" | "LINKED" | "UNLINKED" | "ALL";

const FOLLOW_UP_STATUSES = new Set(["a_rappeler", "a_une_date_ulterieure", "interesse_mais", "en_attente_decision"]);

function contactName(properties: Contact["properties"]) {
  return [properties.firstname, properties.lastname].filter(Boolean).join(" ") || properties.email || properties.phone || properties.mobilephone || "Contact sans nom";
}

function callStatus(value?: string | null) {
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

function contactLocation(properties: Contact["properties"]) {
  return [properties.city, properties.state || properties.hs_country_region_code].filter(Boolean).join(" · ") || "—";
}

function hasCompany(contact: Contact) {
  return Boolean(contact.properties.company?.trim());
}

function hasPhone(contact: Contact) {
  return Boolean((contact.properties.phone || contact.properties.mobilephone)?.trim());
}

const directoryFilters: Array<{
  value: DirectoryFilter;
  label: string;
  description: string;
  icon: typeof Phone;
}> = [
  { value: "CALLABLE", label: "Joignables", description: "Avec un numéro", icon: Phone },
  { value: "FOLLOW_UP", label: "À rappeler", description: "Relance identifiée", icon: RefreshCw },
  { value: "LINKED", label: "Avec entreprise", description: "Compte renseigné", icon: Building2 },
  { value: "UNLINKED", label: "Sans entreprise", description: "À rattacher", icon: UserRoundX },
  { value: "ALL", label: "Tous", description: "Tout le répertoire", icon: UserRound },
];

export function ProspectionContactsDirectory() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [segmentId, setSegmentId] = useState("");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [callFilter, setCallFilter] = useState("");
  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilter>("ALL");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/segments", { cache: "no-store" }).then(response => response.json()).catch(() => ({ lists: [] })),
      fetch("/api/owners", { cache: "no-store" }).then(response => response.json()).catch(() => ({ results: [] })),
    ]).then(([segments, ownerPayload]) => {
      setLists(((segments.lists || []) as List[]).filter(item => item.objectTypeId === "0-1"));
      setOwners(ownerPayload.results || []);
    }).catch(cause => setError(cause instanceof Error ? cause.message : "Impossible de charger le Cockpit"));
  }, []);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (segmentId) params.set("segmentId", segmentId);
      const contactPayload = await fetchAllPagedResults<Contact>(`/api/contacts?${params.toString()}`);
      setContacts(contactPayload.results);
      setTotal(contactPayload.total);
      if (contactPayload.truncated) setError("Le volume est très important : seuls les 10 000 premiers contacts ont été chargés.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger les contacts");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [segmentId]);

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

  const ownerNames = useMemo(() => Object.fromEntries(owners.map(owner => [
    owner.id,
    [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.email || owner.id,
  ])), [owners]);

  const baseFiltered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr-FR");
    return contacts.filter(contact => {
      const p = contact.properties;
      const haystack = [p.firstname, p.lastname, p.email, p.phone, p.mobilephone, p.company, p.jobtitle, p.city, p.state]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("fr-FR");
      if (needle && !haystack.includes(needle)) return false;
      if (ownerFilter && p.hubspot_owner_id !== ownerFilter) return false;
      if (callFilter && p.statut_de_lappel !== callFilter) return false;
      return true;
    });
  }, [contacts, query, ownerFilter, callFilter]);

  const counts = useMemo(() => ({
    CALLABLE: baseFiltered.filter(hasPhone).length,
    FOLLOW_UP: baseFiltered.filter(contact => FOLLOW_UP_STATUSES.has(contact.properties.statut_de_lappel || "")).length,
    LINKED: baseFiltered.filter(hasCompany).length,
    UNLINKED: baseFiltered.filter(contact => !hasCompany(contact)).length,
    ALL: baseFiltered.length,
  }), [baseFiltered]);

  const filtered = useMemo(() => baseFiltered.filter(contact => {
    if (directoryFilter === "CALLABLE") return hasPhone(contact);
    if (directoryFilter === "FOLLOW_UP") return FOLLOW_UP_STATUSES.has(contact.properties.statut_de_lappel || "");
    if (directoryFilter === "LINKED") return hasCompany(contact);
    if (directoryFilter === "UNLINKED") return !hasCompany(contact);
    return true;
  }), [baseFiltered, directoryFilter]);

  const currentList = lists.find(item => item.listId === segmentId);

  return (
    <div className="page-shell flex h-screen flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border bg-card px-5 py-3 lg:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Prospection · Contacts</span>
              <span className="text-[10px] text-muted-foreground">{total} contacts enregistrés</span>
            </div>
            <p className="mt-0.5 text-sm font-semibold text-foreground">1 contact = 1 personne à joindre. Le prospect commercial reste l’entreprise associée.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={segmentId || "__all__"} onValueChange={value => setSegmentId(value === "__all__" ? "" : value)}>
              <SelectTrigger className="h-9 w-[220px]"><SelectValue placeholder="Segment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous les contacts</SelectItem>
                {lists.map(list => (
                  <SelectItem key={list.listId} value={list.listId}>{list.name}{list.size !== undefined ? ` · ${list.size}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5"><a href="/segments"><ListFilter size={14} /> Segments</a></Button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden p-4 lg:px-6 lg:py-5">
        <Card className="flex h-full min-h-0 flex-col overflow-hidden">
          <section className="border-b border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-lg font-bold tracking-tight">Répertoire contacts</h1>
                  {currentList ? <Badge variant="outline" className="max-w-[240px] truncate">{currentList.name}</Badge> : null}
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  <strong className="text-foreground">{counts.CALLABLE} contact{counts.CALLABLE > 1 ? "s" : ""} avec un numéro</strong>
                  {counts.FOLLOW_UP ? ` · ${counts.FOLLOW_UP} à rappeler` : ""}
                  {counts.UNLINKED ? ` · ${counts.UNLINKED} sans entreprise renseignée` : ""}.
                </p>
              </div>
              <Badge variant="secondary" className="gap-1.5"><UserRoundCheck size={13} /> {filtered.length} visibles</Badge>
            </div>

            <div className="grid grid-cols-2 border-t border-border sm:grid-cols-3 lg:grid-cols-5">
              {directoryFilters.map(item => {
                const Icon = item.icon;
                const active = directoryFilter === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setDirectoryFilter(item.value)}
                    className={`flex min-w-0 items-center gap-3 border-r border-border px-4 py-3 text-left transition-colors last:border-r-0 hover:bg-muted/50 ${active ? "bg-primary/[0.06]" : ""}`}
                  >
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border bg-background ${active ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}><Icon size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2"><span className={`truncate text-sm font-semibold ${active ? "text-primary" : ""}`}>{item.label}</span><span className="text-sm font-bold tabular-nums text-foreground">{counts[item.value]}</span></span>
                      <span className="block truncate text-[11px] text-muted-foreground">{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
              <Button variant="secondary" size="sm" className="h-7 gap-1.5"><Table2 size={14} /> Base contacts</Button>
            </div>

            <Select value={ownerFilter || "__all__"} onValueChange={value => setOwnerFilter(value === "__all__" ? "" : value)}>
              <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Commercial" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous les commerciaux</SelectItem>
                {owners.map(owner => <SelectItem key={owner.id} value={owner.id}>{ownerNames[owner.id]}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={callFilter || "__all__"} onValueChange={value => setCallFilter(value === "__all__" ? "" : value)}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Dernier appel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous les résultats</SelectItem>
                <SelectItem value="interesse">Intéressé</SelectItem>
                <SelectItem value="interesse_mais">Intéressé mais</SelectItem>
                <SelectItem value="a_rappeler">À rappeler</SelectItem>
                <SelectItem value="a_une_date_ulterieure">À une date ultérieure</SelectItem>
                <SelectItem value="en_attente_decision">En attente décision</SelectItem>
                <SelectItem value="nrp">NRP</SelectItem>
                <SelectItem value="occupe">Occupé</SelectItem>
                <SelectItem value="pas_interesse">Pas intéressé</SelectItem>
                <SelectItem value="hors_cible">Hors cible</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Contact, entreprise, email…" className="h-9 w-56 pl-9" /></div>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => void sync()} disabled={syncing}>{syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {syncing ? "Synchronisation…" : "Synchroniser"}</Button>
            <span className="ml-auto hidden text-[11px] text-muted-foreground 2xl:inline">Même expérience que la base entreprises, sans recréer un pipeline contact parallèle.</span>
          </div>

          {error ? <div className="mx-4 mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

          <div className="min-h-0 flex-1 overflow-auto border-t border-border minari-scrollbar">
            <Table className="min-w-[1500px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Entreprise</TableHead>
                  <TableHead>Fonction</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Dernier appel</TableHead>
                  <TableHead>Rappel prévu</TableHead>
                  <TableHead>Localisation</TableHead>
                  <TableHead>Commercial</TableHead>
                  <TableHead>Dernière activité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={10} className="h-64 text-center"><Loader2 className="mx-auto animate-spin text-primary" /></TableCell></TableRow>
                ) : filtered.map(contact => {
                  const p = contact.properties;
                  const phone = p.phone || p.mobilephone;
                  const nextFollowup = p.date_prochaine_relance || p.date_recyclage;
                  return (
                    <TableRow key={contact.id} className="cursor-pointer" onClick={() => router.push(`/contacts/${contact.id}`)}>
                      <TableCell>
                        <div className="flex items-center gap-2.5 font-medium">
                          <Avatar className="h-8 w-8"><AvatarFallback className="text-[10px]">{initials(p.firstname, p.lastname)}</AvatarFallback></Avatar>
                          <div className="min-w-0"><div className="truncate font-medium">{contactName(p)}</div><div className="text-[11px] text-muted-foreground">{p.hs_object_source_label || "HubSpot"}</div></div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{p.company || <span className="text-muted-foreground">Non renseignée</span>}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.jobtitle || "—"}</TableCell>
                      <TableCell>{phone ? <a href={`tel:${phone}`} onClick={event => event.stopPropagation()} className="inline-flex items-center gap-1.5 text-sm hover:text-primary"><Phone size={13} /> {phone}</a> : "—"}</TableCell>
                      <TableCell>{p.email ? <a href={`mailto:${p.email}`} onClick={event => event.stopPropagation()} className="inline-flex items-center gap-1.5 text-sm hover:text-primary"><Mail size={13} /> {p.email}</a> : "—"}</TableCell>
                      <TableCell><Badge variant="outline">{callStatus(p.statut_de_lappel)}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{nextFollowup ? formatDate(nextFollowup) : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><MapPin size={12} />{contactLocation(p)}</span></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.hubspot_owner_id ? ownerNames[p.hubspot_owner_id] || "Commercial" : "Non assigné"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(p.hs_last_sales_activity_timestamp || p.notes_last_contacted)}</TableCell>
                    </TableRow>
                  );
                })}
                {!loading && !filtered.length ? <TableRow><TableCell colSpan={10} className="h-40 text-center text-muted-foreground">Aucun contact pour ces filtres.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
