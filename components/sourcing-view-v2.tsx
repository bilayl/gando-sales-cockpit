"use client";

import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe2,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserRound,
  Users,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TERRITORIES = [
  "France métropolitaine",
  "Guadeloupe",
  "Martinique",
  "Guyane",
  "La Réunion",
  "Mayotte",
];

const SOURCES = [
  "Leboncoin",
  "Facebook public",
  "Instagram public",
  "Google",
  "sites web de loueurs",
  "annuaires professionnels",
];

type ProspectContact = {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  confidence?: number;
  sourceProvider?: string;
};

type Prospect = {
  companyName: string;
  legalName?: string;
  siren?: string;
  siret?: string;
  city?: string;
  postalCode?: string;
  address?: string;
  territory?: string;
  country?: string;
  website?: string;
  domain?: string;
  phone?: string;
  publicBusinessEmail?: string;
  sourceUrls?: string[];
  sourceTypes?: string[];
  sourceProviders?: string[];
  evidence?: string;
  confidence?: number;
  gandoScore?: number;
  qualificationReason?: string;
  contacts?: ProspectContact[];
  inpiStatus?: string;
  inpiVerified?: boolean;
};

type RunRef = {
  runId: string;
  datasetId?: string;
  territory?: string;
  status?: string;
  pending?: boolean;
};

type SearchResult = {
  searchId?: string;
  searchedAt?: string;
  candidatesFound?: number;
  uniqueCandidates?: number;
  hubspotCompaniesChecked?: number;
  excludedFromHubspot?: number;
  newProspects?: number;
  prospects?: Prospect[];
  sources?: {
    openrouter?: { candidates?: number; status?: string };
    apify?: {
      configured?: boolean;
      actorId?: string;
      rawItems?: number;
      candidates?: number;
      runs?: RunRef[];
    };
  } | null;
  sourceErrors?: Array<{ source?: string; error?: string }>;
  inpi?: { configured?: boolean; verified?: number; notFound?: number; errors?: number } | null;
};

function normalize(value = "") {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function normalizedDomain(value = "") {
  if (!value) return "";
  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return value.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

function keyFor(prospect: Prospect) {
  const domain = normalizedDomain(prospect.domain || prospect.website || "");
  return domain || `${normalize(prospect.companyName)}|${normalize(prospect.city || "")}`;
}

function contactKey(contact: ProspectContact) {
  return (contact.email || "").toLowerCase()
    || (contact.linkedinUrl || "").toLowerCase()
    || `${normalize(contact.fullName || `${contact.firstName || ""} ${contact.lastName || ""}`)}|${normalize(contact.jobTitle || "")}`;
}

function mergeContacts(left: ProspectContact[] = [], right: ProspectContact[] = []) {
  const byKey = new Map<string, ProspectContact>();
  for (const contact of [...left, ...right]) {
    const key = contactKey(contact);
    if (!key) continue;
    const previous = byKey.get(key) || {};
    byKey.set(key, {
      ...previous,
      ...contact,
      firstName: contact.firstName || previous.firstName,
      lastName: contact.lastName || previous.lastName,
      fullName: contact.fullName || previous.fullName,
      email: contact.email || previous.email,
      phone: contact.phone || previous.phone,
      jobTitle: contact.jobTitle || previous.jobTitle,
      linkedinUrl: contact.linkedinUrl || previous.linkedinUrl,
      confidence: Math.max(Number(contact.confidence) || 0, Number(previous.confidence) || 0),
    });
  }
  return [...byKey.values()].sort((a, b) => (Number(b.confidence) || 0) - (Number(a.confidence) || 0));
}

function mergeProspect(left: Prospect, right: Prospect): Prospect {
  return {
    ...left,
    ...right,
    companyName: right.companyName || left.companyName,
    legalName: right.legalName || left.legalName,
    siren: right.siren || left.siren,
    siret: right.siret || left.siret,
    phone: right.phone || left.phone,
    website: right.website || left.website,
    domain: right.domain || left.domain,
    city: right.city || left.city,
    postalCode: right.postalCode || left.postalCode,
    address: right.address || left.address,
    publicBusinessEmail: right.publicBusinessEmail || left.publicBusinessEmail,
    contacts: mergeContacts(left.contacts, right.contacts),
    sourceUrls: [...new Set([...(left.sourceUrls || []), ...(right.sourceUrls || [])])],
    sourceTypes: [...new Set([...(left.sourceTypes || []), ...(right.sourceTypes || [])])],
    sourceProviders: [...new Set([...(left.sourceProviders || []), ...(right.sourceProviders || [])])],
    confidence: Math.max(Number(left.confidence) || 0, Number(right.confidence) || 0),
    gandoScore: Math.max(Number(left.gandoScore) || 0, Number(right.gandoScore) || 0),
  };
}

function mergeResults(base: SearchResult, incoming: SearchResult): SearchResult {
  const map = new Map<string, Prospect>();
  for (const prospect of base.prospects || []) map.set(keyFor(prospect), prospect);
  for (const prospect of incoming.prospects || []) {
    const key = keyFor(prospect);
    const previous = map.get(key);
    map.set(key, previous ? mergeProspect(previous, prospect) : prospect);
  }
  const prospects = [...map.values()].sort((a, b) => (Number(b.gandoScore) || 0) - (Number(a.gandoScore) || 0));
  return {
    ...base,
    ...incoming,
    candidatesFound: Math.max(Number(base.candidatesFound) || 0, Number(incoming.candidatesFound) || 0),
    uniqueCandidates: Math.max(Number(base.uniqueCandidates) || 0, prospects.length),
    newProspects: prospects.length,
    prospects,
    sources: incoming.sources || base.sources,
    sourceErrors: [...(base.sourceErrors || []), ...(incoming.sourceErrors || [])],
  };
}

function delay(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function contactName(contact: ProspectContact) {
  return contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email || "Contact professionnel";
}

function confidenceLabel(confidence?: number) {
  return `${Math.round(Number(confidence || 0) * 100)}%`;
}

export function SourcingViewV2() {
  const [query, setQuery] = useState("");
  const [territories, setTerritories] = useState<string[]>([...TERRITORIES]);
  const [sources, setSources] = useState<string[]>([...SOURCES]);
  const [limit, setLimit] = useState(20);
  const [minConfidence, setMinConfidence] = useState(0.65);
  const [searching, setSearching] = useState(false);
  const [deepSearching, setDeepSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const searchGeneration = useRef(0);

  const prospects = result?.prospects || [];
  const selectedProspects = useMemo(
    () => prospects.filter(prospect => selected.has(keyFor(prospect)) && !imported.has(keyFor(prospect))),
    [prospects, selected, imported],
  );
  const totalContacts = useMemo(() => prospects.reduce((sum, prospect) => sum + (prospect.contacts?.length || 0), 0), [prospects]);
  const prospectsWithPhone = useMemo(() => prospects.filter(prospect => prospect.phone || prospect.contacts?.some(contact => contact.phone)).length, [prospects]);

  function toggleValue(value: string, values: string[], setter: (next: string[]) => void) {
    setter(values.includes(value) ? values.filter(item => item !== value) : [...values, value]);
  }

  function toggleProspect(prospect: Prospect) {
    const key = keyFor(prospect);
    setSelected(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleExpanded(prospect: Prospect) {
    const key = keyFor(prospect);
    setExpanded(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function callSearch(body: Record<string, unknown>) {
    const response = await fetch("/api/enrichment/search-v2", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "La recherche de nouveaux loueurs a échoué.");
    return payload as SearchResult;
  }

  async function continueApify(initial: SearchResult, generation: number) {
    let current = initial;
    let runs = (current.sources?.apify?.runs || []).filter(run => run.runId);
    if (!runs.some(run => run.pending)) return;

    setDeepSearching(true);
    try {
      for (let attempt = 0; attempt < 10 && runs.some(run => run.pending); attempt += 1) {
        await delay(attempt < 2 ? 3_000 : 5_000);
        if (searchGeneration.current !== generation) return;
        const incoming = await callSearch({
          apifyRunRefs: runs,
          territories,
          limit,
          minConfidence,
          apifyLimit: Math.max(limit * 3, 60),
          apifyContactsPerCompany: 3,
        });
        current = mergeResults(current, incoming);
        setResult(current);
        runs = (incoming.sources?.apify?.runs || runs).filter(run => run.runId);
      }
    } catch (cause) {
      console.error("Apify progressive enrichment:", cause);
    } finally {
      if (searchGeneration.current === generation) setDeepSearching(false);
    }
  }

  async function runSearch() {
    const generation = ++searchGeneration.current;
    setSearching(true);
    setDeepSearching(false);
    setError("");
    setResult(null);
    setSelected(new Set());
    setExpanded(new Set());
    setImported(new Set());
    try {
      const payload = await callSearch({
        query: query.trim(),
        territories,
        sources,
        limit,
        minConfidence,
        apifyLimit: Math.max(limit * 3, 60),
        apifyContactsPerCompany: 3,
      });
      setResult(payload);
      toast.success(`${Number(payload.newProspects || 0)} nouvelle(s) entreprise(s) trouvée(s).`);
      void continueApify(payload, generation);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Recherche impossible";
      setError(message);
      toast.error(message);
    } finally {
      if (searchGeneration.current === generation) setSearching(false);
    }
  }

  async function importSelected() {
    if (!selectedProspects.length) return;
    setImporting(true);
    setError("");
    try {
      const response = await fetch("/api/enrichment/import-v2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prospects: selectedProspects, maxContactsPerCompany: 5 }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "L'import HubSpot a échoué.");

      const processedNames = new Set((payload.imported || []).map((item: any) => String(item.companyName || "").toLowerCase()));
      const importedKeys = selectedProspects.filter(prospect => processedNames.has(prospect.companyName.toLowerCase())).map(keyFor);
      setImported(current => new Set([...current, ...importedKeys]));
      setSelected(current => {
        const next = new Set(current);
        importedKeys.forEach(key => next.delete(key));
        return next;
      });

      const companiesCreated = Number(payload.importedCount || 0);
      const companiesExisting = Number(payload.existingCompaniesCount || 0);
      const contactsCreated = Number(payload.contactsCreatedCount || 0);
      const contactsReused = Number(payload.contactsReusedCount || 0);
      toast.success(`${companiesCreated} entreprise(s) créée(s) · ${companiesExisting} existante(s) enrichie(s) · ${contactsCreated} contact(s) créé(s) · ${contactsReused} associé(s).`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Import impossible";
      setError(message);
      toast.error(message);
    } finally {
      setImporting(false);
    }
  }

  const allSelectable = prospects.filter(prospect => !imported.has(keyFor(prospect)));
  const allSelected = Boolean(allSelectable.length) && allSelectable.every(prospect => selected.has(keyFor(prospect)));
  const apifyConfigured = result?.sources?.apify?.configured;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-background minari-scrollbar">
      <div className="border-b border-border bg-card px-5 py-5 lg:px-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"><Sparkles size={14} /> Acquisition enrichie</div>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight">Sourcing entreprises + décideurs</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">OpenRouter découvre les sociétés, Apify complète Google Maps et les décideurs, INPI vérifie l’entreprise, puis HubSpot élimine les doublons.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1.5"><ShieldCheck size={13} className="text-emerald-500" /> INPI + anti-doublon</Badge>
            <Badge variant="outline" className="gap-1.5"><Sparkles size={13} /> Apify {apifyConfigured === false ? "non configuré" : "contacts + rôles"}</Badge>
            {deepSearching ? <Badge className="gap-1.5"><Loader2 size={12} className="animate-spin" /> Enrichissement Apify en cours</Badge> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:p-7 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-border bg-card p-4 shadow-sm xl:sticky xl:top-5">
          <div className="flex items-center gap-2"><Search size={16} className="text-primary" /><h2 className="font-semibold">Nouvelle recherche</h2></div>
          <div className="mt-5">
            <label className="text-xs font-semibold text-muted-foreground">Recherche / ciblage</label>
            <textarea value={query} onChange={event => setQuery(event.target.value)} rows={4} placeholder="Ex. loueurs indépendants d’utilitaires, flotte 15+ véhicules…" className="mt-1.5 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" />
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between"><label className="text-xs font-semibold text-muted-foreground">Territoires</label><button onClick={() => setTerritories(territories.length === TERRITORIES.length ? [] : [...TERRITORIES])} className="text-[11px] font-semibold text-primary hover:underline">{territories.length === TERRITORIES.length ? "Tout retirer" : "Tout sélectionner"}</button></div>
            <div className="mt-2 flex flex-wrap gap-1.5">{TERRITORIES.map(territory => <button key={territory} type="button" onClick={() => toggleValue(territory, territories, setTerritories)} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${territories.includes(territory) ? "border-primary/30 bg-accent text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{territory}</button>)}</div>
          </div>
          <div className="mt-5">
            <label className="text-xs font-semibold text-muted-foreground">Sources publiques</label>
            <div className="mt-2 grid gap-1.5">{SOURCES.map(source => <label key={source} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-xs hover:bg-muted/50"><input type="checkbox" checked={sources.includes(source)} onChange={() => toggleValue(source, sources, setSources)} className="h-3.5 w-3.5 accent-[hsl(var(--primary))]" /><span className="font-medium">{source}</span></label>)}</div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-muted-foreground">Résultats max.</label><Input type="number" min={1} max={50} value={limit} onChange={event => setLimit(Math.min(50, Math.max(1, Number(event.target.value) || 1)))} className="mt-1.5" /></div>
            <div><label className="text-xs font-semibold text-muted-foreground">Confiance min.</label><select value={minConfidence} onChange={event => setMinConfidence(Number(event.target.value))} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value={0.6}>60 %</option><option value={0.65}>65 %</option><option value={0.7}>70 %</option><option value={0.8}>80 %</option><option value={0.9}>90 %</option></select></div>
          </div>
          <Button className="mt-5 w-full" onClick={() => void runSearch()} disabled={searching || !territories.length || !sources.length}>{searching ? <><Loader2 size={15} className="animate-spin" /> Recherche initiale…</> : <><Search size={15} /> Trouver entreprises + contacts</>}</Button>
          <p className="mt-2 text-center text-[10px] leading-4 text-muted-foreground">Les résultats apparaissent d’abord, puis Apify complète automatiquement téléphones, emails, rôles et LinkedIn.</p>
        </aside>

        <main className="min-w-0 space-y-4">
          {error ? <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}
          {result ? <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                [prospects.length, "Entreprises nouvelles"],
                [totalContacts, "Contacts trouvés"],
                [prospectsWithPhone, "Avec téléphone"],
                [result.excludedFromHubspot || 0, "Déjà dans HubSpot"],
              ].map(([value, label]) => <div key={String(label)} className="rounded-xl border border-border bg-card p-4"><div className="text-2xl font-bold tracking-tight">{value}</div><div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div></div>)}
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h2 className="font-semibold">Entreprises qualifiées</h2><p className="mt-0.5 text-xs text-muted-foreground">Les décideurs sont imbriqués sous leur entreprise pour garder une logique company-first.</p></div>
                <div className="flex flex-wrap gap-2">
                  {prospects.length ? <Button variant="outline" size="sm" onClick={() => setSelected(allSelected ? new Set() : new Set(allSelectable.map(keyFor)))}>{allSelected ? "Tout désélectionner" : "Tout sélectionner"}</Button> : null}
                  <Button size="sm" onClick={() => void importSelected()} disabled={!selectedProspects.length || importing}>{importing ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />} Importer entreprise + contacts {selectedProspects.length ? `(${selectedProspects.length})` : ""}</Button>
                </div>
              </div>

              <div className="divide-y divide-border">
                {prospects.map(prospect => {
                  const key = keyFor(prospect);
                  const isImported = imported.has(key);
                  const isSelected = selected.has(key);
                  const isExpanded = expanded.has(key);
                  const contacts = prospect.contacts || [];
                  return <article key={key} className={`p-4 transition ${isSelected ? "bg-accent/20" : ""}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" disabled={isImported} checked={isSelected && !isImported} onChange={() => toggleProspect(prospect)} className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2"><Building2 size={16} className="text-primary" /><h3 className="font-semibold">{prospect.companyName}</h3>{isImported ? <Badge className="gap-1 bg-emerald-600"><CheckCircle2 size={11} /> Importée</Badge> : null}{prospect.inpiVerified ? <Badge variant="outline" className="gap-1 text-[10px]"><ShieldCheck size={10} className="text-emerald-500" /> INPI</Badge> : null}</div>
                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              {prospect.city || prospect.territory ? <span className="inline-flex items-center gap-1"><MapPin size={11} /> {[prospect.city, prospect.territory].filter(Boolean).join(" · ")}</span> : null}
                              {prospect.phone ? <a href={`tel:${prospect.phone}`} className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"><Phone size={11} /> {prospect.phone}</a> : <span className="inline-flex items-center gap-1 opacity-70"><Phone size={11} /> Téléphone entreprise non trouvé</span>}
                              {prospect.publicBusinessEmail ? <a href={`mailto:${prospect.publicBusinessEmail}`} className="inline-flex items-center gap-1 hover:text-primary"><Mail size={11} /> {prospect.publicBusinessEmail}</a> : null}
                              {prospect.website ? <a href={prospect.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary"><Globe2 size={11} /> {normalizedDomain(prospect.website)}</a> : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2"><Badge variant="outline">Score {Math.round(Number(prospect.gandoScore || 0))}</Badge><Badge variant="outline">{confidenceLabel(prospect.confidence)}</Badge></div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {(prospect.sourceProviders || []).map(provider => <Badge key={provider} variant="outline" className="text-[10px] capitalize">{provider}</Badge>)}
                          <Badge variant="outline" className="gap-1 text-[10px]"><Users size={10} /> {contacts.length} contact{contacts.length > 1 ? "s" : ""}</Badge>
                          {contacts.length ? <button onClick={() => toggleExpanded(prospect)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">{isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {isExpanded ? "Masquer les décideurs" : "Voir les décideurs"}</button> : deepSearching ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 size={11} className="animate-spin" /> Recherche de décideurs…</span> : null}
                        </div>

                        {isExpanded && contacts.length ? <div className="mt-3 grid gap-2 lg:grid-cols-2">
                          {contacts.map(contact => <div key={contactKey(contact)} className="rounded-lg border border-border bg-background p-3">
                            <div className="flex items-start gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><UserRound size={14} /></span><div className="min-w-0 flex-1"><div className="font-semibold text-sm">{contactName(contact)}</div><div className="mt-0.5 text-xs font-medium text-primary">{contact.jobTitle || "Rôle non identifié"}</div></div></div>
                            <div className="mt-2.5 space-y-1.5 text-xs">
                              {contact.phone ? <a href={`tel:${contact.phone}`} className="flex items-center gap-2 font-medium hover:text-primary"><Phone size={11} /> {contact.phone}</a> : null}
                              {contact.email ? <a href={`mailto:${contact.email}`} className="flex items-center gap-2 hover:text-primary"><Mail size={11} /> <span className="truncate">{contact.email}</span></a> : null}
                              {contact.linkedinUrl ? <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-primary"><Linkedin size={11} /> LinkedIn <ExternalLink size={9} /></a> : null}
                            </div>
                          </div>)}
                        </div> : null}

                        {prospect.qualificationReason ? <p className="mt-3 text-xs leading-5 text-muted-foreground">{prospect.qualificationReason}</p> : null}
                      </div>
                    </div>
                  </article>;
                })}
                {!prospects.length ? <div className="p-8 text-center text-sm text-muted-foreground">Aucune nouvelle entreprise ne correspond aux critères après vérification HubSpot.</div> : null}
              </div>
            </div>
          </> : <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center"><Sparkles className="mx-auto text-primary" /><h2 className="mt-3 font-semibold">Lancez un sourcing enrichi</h2><p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">Les fiches afficheront les coordonnées de l’entreprise puis les décideurs avec leur rôle, téléphone, email et LinkedIn quand disponibles.</p></div>}
        </main>
      </div>
    </div>
  );
}
