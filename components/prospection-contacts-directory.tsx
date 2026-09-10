"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, Mail, Phone, RefreshCw, Search, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchAllPagedResults } from "@/lib/fetch-all-paged-results";
import { formatDate, initials } from "@/lib/utils";

type Contact = { id: string; properties: Record<string, string | null | undefined> };

type Owner = { id: string; firstName?: string; lastName?: string; email?: string };

function contactName(properties: Contact["properties"]) {
  return [properties.firstname, properties.lastname].filter(Boolean).join(" ") || properties.email || properties.phone || "Contact sans nom";
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

export function ProspectionContactsDirectory() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [contactPayload, ownerResponse] = await Promise.all([
        fetchAllPagedResults<Contact>("/api/contacts"),
        fetch("/api/owners", { cache: "no-store" }),
      ]);
      setContacts(contactPayload.results);
      setTotal(contactPayload.total);
      if (contactPayload.truncated) setError("Le volume est très important : seuls les 10 000 premiers contacts ont été chargés.");
      if (ownerResponse.ok) {
        const ownerPayload = await ownerResponse.json();
        setOwners(ownerPayload.results || []);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger les contacts");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

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

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr-FR");
    if (!needle) return contacts;
    return contacts.filter(contact => {
      const p = contact.properties;
      return [p.firstname, p.lastname, p.email, p.phone, p.mobilephone, p.company, p.jobtitle]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("fr-FR")
        .includes(needle);
    });
  }, [contacts, query]);

  return (
    <div className="page-shell flex h-screen flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border bg-card px-5 py-3 lg:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Prospection · Contacts</span>
              <span className="text-[10px] text-muted-foreground">{total} contacts enregistrés</span>
            </div>
            <p className="mt-0.5 text-sm font-semibold text-foreground">Les contacts restent accessibles dans Prospection, mais le prospect commercial reste l’entreprise.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
              <Button asChild size="sm" variant="ghost" className="h-8 gap-1.5 rounded-md px-3"><Link href="/prospection"><Building2 size={14} /> Entreprises</Link></Button>
              <Button size="sm" variant="secondary" className="h-8 gap-1.5 rounded-md px-3"><Users size={14} /> Contacts</Button>
            </div>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => void sync()} disabled={syncing}>
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {syncing ? "Synchronisation…" : "Synchroniser"}
            </Button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden p-4 lg:px-6 lg:py-5">
        <Card className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nom, entreprise, téléphone, email…" className="h-9 w-[320px] max-w-full pl-9" />
            </div>
            <span className="text-[11px] text-muted-foreground">Répertoire de personnes rattachées aux comptes. Aucun pipeline lead parallèle.</span>
            <Badge variant="secondary" className="ml-auto">{filtered.length} visibles</Badge>
          </div>

          {error ? <div className="mx-4 mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

          <div className="min-h-0 flex-1 overflow-auto minari-scrollbar">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Entreprise</TableHead>
                  <TableHead>Fonction</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Dernier résultat</TableHead>
                  <TableHead>Commercial</TableHead>
                  <TableHead>Dernière activité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="h-64 text-center"><Loader2 className="mx-auto animate-spin text-primary" /></TableCell></TableRow>
                ) : filtered.map(contact => {
                  const p = contact.properties;
                  const phone = p.phone || p.mobilephone;
                  return (
                    <TableRow key={contact.id} className="cursor-pointer hover:bg-muted/30">
                      <TableCell>
                        <Link href={`/contacts/${contact.id}`} className="flex items-center gap-2.5 font-medium hover:text-primary">
                          <Avatar className="h-8 w-8"><AvatarFallback className="text-[10px]">{initials(p.firstname, p.lastname)}</AvatarFallback></Avatar>
                          <span>{contactName(p)}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{p.company || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.jobtitle || "—"}</TableCell>
                      <TableCell>{phone ? <a href={`tel:${phone}`} onClick={event => event.stopPropagation()} className="inline-flex items-center gap-1.5 text-sm hover:text-primary"><Phone size={13} /> {phone}</a> : "—"}</TableCell>
                      <TableCell>{p.email ? <a href={`mailto:${p.email}`} onClick={event => event.stopPropagation()} className="inline-flex items-center gap-1.5 text-sm hover:text-primary"><Mail size={13} /> {p.email}</a> : "—"}</TableCell>
                      <TableCell><Badge variant="outline">{callStatus(p.statut_de_lappel)}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.hubspot_owner_id ? ownerNames[p.hubspot_owner_id] || "Commercial" : "Non assigné"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(p.hs_last_sales_activity_timestamp)}</TableCell>
                    </TableRow>
                  );
                })}
                {!loading && !filtered.length ? <TableRow><TableCell colSpan={8} className="h-40 text-center text-muted-foreground">Aucun contact pour cette recherche.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
