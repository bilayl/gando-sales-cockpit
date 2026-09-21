"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";
import { Building2, ListFilter, Loader2, Mail, MapPin, Phone, RefreshCw, Search, Table2, UserRound, UserRoundCheck, UserRoundX } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useContacts,
  useOwners,
  useSegments,
  useSyncCrm,
  type Contact,
} from "@/hooks/queries/use-prospection-data";
import { formatDate, initials } from "@/lib/utils";

type DirectoryFilter = "CALLABLE" | "FOLLOW_UP" | "LINKED" | "UNLINKED" | "ALL";

const FOLLOW_UP_STATUSES = new Set(["a_rappeler", "a_une_date_ulterieure", "interesse_mais", "en_attente_decision"]);

function contactName(properties: Contact["properties"]) {
  return [properties.firstname, properties.lastname].filter(Boolean).join(" ")
    || properties.email
    || properties.phone
    || properties.mobilephone
    || "Contact sans nom";
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
  const [segmentId, setSegmentId] = useQueryState("segment", parseAsString.withDefault(""));
  const [query, setQuery] = useQueryState("q", parseAsString.withDefault(""));
  const [ownerFilter, setOwnerFilter] = useQueryState("owner", parseAsString.withDefault(""));
  const [callFilter, setCallFilter] = useQueryState("call", parseAsString.withDefault(""));
  const [directoryFilter, setDirectoryFilter] = useQueryState(
    "type",
    parseAsStringEnum<DirectoryFilter>(["CALLABLE", "FOLLOW_UP", "LINKED", "UNLINKED", "ALL"]).withDefault("ALL"),
  );

  const contactsQuery = useContacts(segmentId || undefined);
  const segmentsQuery = useSegments();
  const ownersQuery = useOwners();
  const syncMutation = useSyncCrm();

  const contacts = contactsQuery.data?.results || [];
  const total = contactsQuery.data?.total || 0;
  const owners = ownersQuery.data || [];
  const lists = useMemo(
    () => (segmentsQuery.data || []).filter(item => item.objectTypeId === "0-1"),
    [segmentsQuery.data],
  );

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
  const loading = contactsQuery.isLoading || segmentsQuery.isLoading || ownersQuery.isLoading;
  const error = contactsQuery.error?.message
    || segmentsQuery.error?.message
    || ownersQuery.error?.message
    || syncMutation.error?.message
    || (contactsQuery.data?.truncated ? "Le volume est très important : seuls les 10 000 premiers contacts ont été chargés." : "");

  return (
    <div className="page-shell min-h-[calc(100svh-3rem)] min-w-0 overflow-hidden">
      <div className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-[1500px] flex-col px-3 py-5 sm:px-5 lg:px-7">
        <PageHeader
          eyebrow="CRM"
          title="Contacts"
          description="Les personnes à joindre, reliées à la même source de vérité entreprise."
          actions={
            <>
              <Select value={segmentId || "__all__"} onValueChange={value => void setSegmentId(value === "__all__" ? "" : value)}>
                <SelectTrigger className="h-8 w-[210px] border-border/70 bg-background text-xs"><SelectValue placeholder="Segment" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous les contacts</SelectItem>
                  {lists.map(list => (
                    <SelectItem key={list.listId} value={list.listId}>{list.name}{list.size !== undefined ? ` · ${list.size}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs"><a href="/segments"><ListFilter size={14} /> Segments</a></Button>
            </>
          }
        />

        <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-card/35">
          <section className="border-b border-border/60">
            <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-medium">Répertoire</h2>
                  {currentList ? <Badge variant="outline" className="max-w-[240px] truncate">{currentList.name}</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {counts.CALLABLE} joignables · {counts.FOLLOW_UP} à rappeler · {counts.UNLINKED} sans entreprise
                </p>
              </div>
              <Badge variant="secondary" className="gap-1.5 font-medium"><UserRoundCheck size={13} /> {filtered.length} visibles</Badge>
            </div>

            <div className="grid grid-cols-2 border-t border-border/60 sm:grid-cols-3 lg:grid-cols-5">
              {directoryFilters.map(item => {
                const Icon = item.icon;
                const active = directoryFilter === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => void setDirectoryFilter(item.value)}
                    className={`flex min-w-0 items-center gap-2.5 border-r border-border/50 px-3 py-3 text-left transition last:border-r-0 hover:bg-muted/35 ${active ? "bg-muted/50" : ""}`}
                  >
                    <Icon className={`size-4 shrink-0 ${active ? "text-foreground" : "text-muted-foreground"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={`truncate text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{item.label}</span>
                        <span className="text-xs font-semibold tabular-nums">{counts[item.value]}</span>
                      </span>
                      <span className="hidden truncate text-[10px] text-muted-foreground xl:block">{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2.5 sm:px-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><Table2 size={13} /> Base contacts</div>

            <Select value={ownerFilter || "__all__"} onValueChange={value => void setOwnerFilter(value === "__all__" ? "" : value)}>
              <SelectTrigger className="h-8 w-full border-border/70 bg-background text-xs sm:w-[170px]"><SelectValue placeholder="Commercial" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous les commerciaux</SelectItem>
                {owners.map(owner => <SelectItem key={owner.id} value={owner.id}>{ownerNames[owner.id]}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={callFilter || "__all__"} onValueChange={value => void setCallFilter(value === "__all__" ? "" : value)}>
              <SelectTrigger className="h-8 w-full border-border/70 bg-background text-xs sm:w-[160px]"><SelectValue placeholder="Dernier appel" /></SelectTrigger>
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

            <div className="relative min-w-0 flex-1 sm:flex-none">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={event => void setQuery(event.target.value)}
                placeholder="Contact, entreprise, email…"
                className="h-8 w-full border-border/70 bg-background pl-9 text-xs sm:w-56"
              />
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              {syncMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Synchroniser
            </Button>
            <span className="ml-auto hidden text-[11px] text-muted-foreground xl:inline">{total} contacts</span>
          </div>

          {error ? <div className="mx-4 mt-3 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div> : null}

          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto border-t border-border/60 minari-scrollbar">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead className="hidden xl:table-cell">Entreprise</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Fonction</TableHead>
                  <TableHead className="hidden lg:table-cell">Téléphone</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Email</TableHead>
                  <TableHead className="w-[140px]">Dernier appel</TableHead>
                  <TableHead className="hidden w-[145px] lg:table-cell">Rappel prévu</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Localisation</TableHead>
                  <TableHead className="hidden xl:table-cell">Commercial</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Dernière activité</TableHead>
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
                        <div className="flex min-w-0 items-center gap-2.5 font-medium">
                          <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="text-[10px]">{initials(p.firstname, p.lastname)}</AvatarFallback></Avatar>
                          <div className="min-w-0"><div className="truncate font-medium">{contactName(p)}</div><div className="truncate text-[11px] text-muted-foreground">{p.hs_object_source_label || "HubSpot"}</div></div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden truncate text-sm xl:table-cell">{p.company || <span className="text-muted-foreground">Non renseignée</span>}</TableCell>
                      <TableCell className="hidden truncate text-sm text-muted-foreground 2xl:table-cell">{p.jobtitle || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell">{phone ? <a href={`tel:${phone}`} onClick={event => event.stopPropagation()} className="inline-flex items-center gap-1.5 truncate text-sm hover:text-primary"><Phone size={13} /> {phone}</a> : "—"}</TableCell>
                      <TableCell className="hidden 2xl:table-cell">{p.email ? <a href={`mailto:${p.email}`} onClick={event => event.stopPropagation()} className="inline-flex items-center gap-1.5 truncate text-sm hover:text-primary"><Mail size={13} /> {p.email}</a> : "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="max-w-full truncate">{callStatus(p.statut_de_lappel)}</Badge></TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">{nextFollowup ? formatDate(nextFollowup) : "—"}</TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground 2xl:table-cell"><span className="inline-flex items-center gap-1.5"><MapPin size={12} />{contactLocation(p)}</span></TableCell>
                      <TableCell className="hidden truncate text-xs text-muted-foreground xl:table-cell">{p.hubspot_owner_id ? ownerNames[p.hubspot_owner_id] || "Commercial" : "Non assigné"}</TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground 2xl:table-cell">{formatDate(p.hs_last_sales_activity_timestamp || p.notes_last_contacted)}</TableCell>
                    </TableRow>
                  );
                })}
                {!loading && !filtered.length ? <TableRow><TableCell colSpan={10} className="h-40 text-center text-muted-foreground">Aucun contact pour ces filtres.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
