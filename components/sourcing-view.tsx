"use client";

import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Database,
  ExternalLink,
  Globe2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { useMemo, useState } from "react";
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

type Prospect = {
  companyName: string;
  city?: string;
  territory?: string;
  country?: string;
  website?: string;
  domain?: string;
  phone?: string;
  publicBusinessEmail?: string;
  sourceUrls?: string[];
  sourceTypes?: string[];
  evidence?: string;
  confidence?: number;
  gandoScore?: number;
  qualificationReason?: string;
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
  excluded?: Array<{ companyName: string; hubspotCompanyId?: string; reason?: string }>;
};

function keyFor(prospect: Prospect) {
  return [prospect.companyName, prospect.domain || prospect.website || "", prospect.phone || ""].join("|");
}

function scoreTone(score?: number) {
  const value = Number(score || 0);
  if (value >= 80) return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (value >= 60) return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-border bg-muted text-muted-foreground";
}

function confidenceLabel(confidence?: number) {
  return `${Math.round(Number(confidence || 0) * 100)}% confiance`;
}

export function SourcingView() {
  const [query, setQuery] = useState("");
  const [territories, setTerritories] = useState<string[]>([...TERRITORIES]);
  const [sources, setSources] = useState<string[]>([...SOURCES]);
  const [limit, setLimit] = useState(20);
  const [minConfidence, setMinConfidence] = useState(0.7);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  const prospects = result?.prospects || [];
  const selectedProspects = useMemo(
    () => prospects.filter(prospect => selected.has(keyFor(prospect)) && !imported.has(keyFor(prospect))),
    [prospects, selected, imported],
  );

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

  async function runSearch() {
    setSearching(true);
    setError("");
    setResult(null);
    setSelected(new Set());
    setImported(new Set());
    try {
      const response = await fetch("/api/enrichment/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: query.trim(), territories, sources, limit, minConfidence }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "La recherche de nouveaux loueurs a échoué.");
      setResult(payload);
      toast.success(`${Number(payload.newProspects || 0)} nouvelle(s) entreprise(s) trouvée(s).`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Recherche impossible";
      setError(message);
      toast.error(message);
    } finally {
      setSearching(false);
    }
  }

  async function importSelected() {
    if (!selectedProspects.length) return;
    setImporting(true);
    setError("");
    try {
      const response = await fetch("/api/enrichment/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prospects: selectedProspects }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "L'import HubSpot a échoué.");

      const importedNames = new Set((payload.imported || []).map((item: any) => String(item.companyName || "").toLowerCase()));
      const importedKeys = selectedProspects
        .filter(prospect => importedNames.has(prospect.companyName.toLowerCase()))
        .map(keyFor);
      setImported(current => new Set([...current, ...importedKeys]));
      setSelected(current => {
        const next = new Set(current);
        importedKeys.forEach(key => next.delete(key));
        return next;
      });
      toast.success(`${Number(payload.importedCount || 0)} entreprise(s) ajoutée(s) à HubSpot.`);
      if (Number(payload.skippedCount || 0) > 0) toast.info(`${payload.skippedCount} doublon(s) ignoré(s) au moment de l'import.`);
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

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-background minari-scrollbar">
      <div className="border-b border-border bg-card px-5 py-5 lg:px-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
              <Sparkles size={14} /> Acquisition
            </div>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight">Sourcing de nouvelles entreprises</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Lance une recherche web depuis le backend d’enrichissement Gando. Les entreprises déjà présentes dans HubSpot sont exclues avant affichage.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5"><ShieldCheck size={13} className="text-emerald-500" /> Anti-doublon HubSpot</Badge>
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5"><Database size={13} /> Source : enrichment backend</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:p-7 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-border bg-card p-4 shadow-sm xl:sticky xl:top-5">
          <div className="flex items-center gap-2"><Search size={16} className="text-primary" /><h2 className="font-semibold">Nouvelle recherche</h2></div>

          <div className="mt-5">
            <label className="text-xs font-semibold text-muted-foreground">Recherche / ciblage</label>
            <textarea
              value={query}
              onChange={event => setQuery(event.target.value)}
              rows={4}
              placeholder="Ex. loueurs indépendants d’utilitaires, flotte de 15+ véhicules, sans solution de caution digitale…"
              className="mt-1.5 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between"><label className="text-xs font-semibold text-muted-foreground">Territoires</label><button onClick={() => setTerritories(territories.length === TERRITORIES.length ? [] : [...TERRITORIES])} className="text-[11px] font-semibold text-primary hover:underline">{territories.length === TERRITORIES.length ? "Tout retirer" : "Tout sélectionner"}</button></div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TERRITORIES.map(territory => <button key={territory} type="button" onClick={() => toggleValue(territory, territories, setTerritories)} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${territories.includes(territory) ? "border-primary/30 bg-accent text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{territory}</button>)}
            </div>
          </div>

          <div className="mt-5">
            <label className="text-xs font-semibold text-muted-foreground">Sources publiques</label>
            <div className="mt-2 grid gap-1.5">
              {SOURCES.map(source => (
                <label key={source} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-xs hover:bg-muted/50">
                  <input type="checkbox" checked={sources.includes(source)} onChange={() => toggleValue(source, sources, setSources)} className="h-3.5 w-3.5 accent-[hsl(var(--primary))]" />
                  <span className="font-medium">{source}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-muted-foreground">Résultats max.</label><Input type="number" min={1} max={50} value={limit} onChange={event => setLimit(Math.min(50, Math.max(1, Number(event.target.value) || 1)))} className="mt-1.5" /></div>
            <div><label className="text-xs font-semibold text-muted-foreground">Confiance min.</label><select value={minConfidence} onChange={event => setMinConfidence(Number(event.target.value))} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value={0.6}>60 %</option><option value={0.7}>70 %</option><option value={0.8}>80 %</option><option value={0.9}>90 %</option></select></div>
          </div>

          <Button className="mt-5 w-full" onClick={() => void runSearch()} disabled={searching || !territories.length || !sources.length}>
            {searching ? <><Loader2 size={15} className="animate-spin" /> Recherche web en cours…</> : <><Search size={15} /> Trouver de nouveaux loueurs</>}
          </Button>
          <p className="mt-2 text-center text-[10px] leading-4 text-muted-foreground">Recherche manuelle uniquement. Aucun sourcing automatique n’est lancé en arrière-plan.</p>
        </aside>

        <main className="min-w-0 space-y-4">
          {error ? <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}

          {result ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  [result.candidatesFound || 0, "Candidats trouvés"],
                  [result.excludedFromHubspot || 0, "Déjà dans HubSpot"],
                  [result.newProspects || 0, "Nouvelles entreprises"],
                  [result.hubspotCompaniesChecked || 0, "Entreprises comparées"],
                ].map(([value, label]) => <div key={String(label)} className="rounded-xl border border-border bg-card p-4"><div className="text-2xl font-bold tracking-tight">{value}</div><div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div></div>)}
              </div>

              <div className="rounded-xl border border-border bg-card shadow-sm">
                <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><h2 className="font-semibold">Prospects disponibles</h2><p className="mt-0.5 text-xs text-muted-foreground">Sélectionne uniquement les entreprises que tu veux créer dans HubSpot.</p></div>
                  <div className="flex flex-wrap gap-2">
                    {prospects.length ? <Button variant="outline" size="sm" onClick={() => setSelected(allSelected ? new Set() : new Set(allSelectable.map(keyFor)))}>{allSelected ? "Tout désélectionner" : "Tout sélectionner"}</Button> : null}
                    <Button size="sm" onClick={() => void importSelected()} disabled={!selectedProspects.length || importing}>
                      {importing ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                      Importer {selectedProspects.length ? `(${selectedProspects.length})` : "dans HubSpot"}
                    </Button>
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {prospects.map(prospect => {
                    const key = keyFor(prospect);
                    const isImported = imported.has(key);
                    const isSelected = selected.has(key);
                    return (
                      <article key={key} className={`p-4 transition ${isSelected ? "bg-accent/25" : ""}`}>
                        <div className="flex items-start gap-3">
                          <input type="checkbox" disabled={isImported} checked={isSelected && !isImported} onChange={() => toggleProspect(prospect)} className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0"><div className="flex items-center gap-2"><Building2 size={16} className="shrink-0 text-primary" /><h3 className="truncate font-semibold">{prospect.companyName}</h3>{isImported ? <Badge className="gap-1 bg-emerald-600"><CheckCircle2 size={11} /> Importée</Badge> : null}</div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">{prospect.city || prospect.territory ? <span className="inline-flex items-center gap-1"><MapPin size={11} /> {[prospect.city, prospect.territory].filter(Boolean).join(" · ")}</span> : null}{prospect.phone ? <a href={`tel:${prospect.phone}`} className="inline-flex items-center gap-1 hover:text-primary"><Phone size={11} /> {prospect.phone}</a> : null}{prospect.publicBusinessEmail ? <a href={`mailto:${prospect.publicBusinessEmail}`} className="inline-flex items-center gap-1 hover:text-primary"><Mail size={11} /> {prospect.publicBusinessEmail}</a> : null}</div></div>
                              <div className="flex gap-1.5"><Badge variant="outline" className={scoreTone(prospect.gandoScore)}>Score {Math.round(Number(prospect.gandoScore || 0))}</Badge><Badge variant="outline">{confidenceLabel(prospect.confidence)}</Badge></div>
                            </div>

                            {prospect.qualificationReason ? <p className="mt-3 text-sm leading-5">{prospect.qualificationReason}</p> : null}
                            {prospect.evidence ? <div className="mt-2 rounded-lg bg-muted/55 px-3 py-2 text-xs leading-5 text-muted-foreground"><span className="font-semibold text-foreground">Preuve : </span>{prospect.evidence}</div> : null}

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {prospect.website ? <a href={prospect.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted"><Globe2 size={11} /> Site officiel <ExternalLink size={10} /></a> : null}
                              {(prospect.sourceUrls || []).slice(0, 4).map((url, index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="inline-flex max-w-[220px] items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"><span className="truncate">Source {index + 1}</span><ExternalLink size={10} className="shrink-0" /></a>)}
                              {(prospect.sourceTypes || []).map(source => <Badge key={source} variant="secondary" className="text-[10px]">{source}</Badge>)}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}

                  {!prospects.length ? <div className="grid min-h-56 place-items-center p-6 text-center"><div><ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" /><h3 className="mt-3 font-semibold">Aucune nouvelle entreprise</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">Les résultats trouvés étaient soit déjà présents dans HubSpot, soit sous le seuil de confiance. Essaie d’élargir le ciblage.</p></div></div> : null}
                </div>
              </div>

              {imported.size ? <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3"><div className="flex items-center gap-2 text-sm"><CheckCircle2 size={16} className="text-emerald-500" /><span><strong>{imported.size}</strong> entreprise(s) synchronisée(s) dans HubSpot et ajoutée(s) à la file À travailler.</span></div><Button asChild variant="outline" size="sm"><Link href="/prospection">Voir la prospection</Link></Button></div> : null}
            </>
          ) : (
            <div className="grid min-h-[520px] place-items-center rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
              <div className="max-w-lg"><div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-accent text-primary"><Search size={22} /></div><h2 className="mt-4 text-lg font-semibold">Trouve les prochains comptes à appeler</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Le backend Gando recherche des loueurs professionnels sur les sources publiques, normalise les résultats, puis élimine les entreprises déjà présentes dans HubSpot avant de te les proposer.</p></div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
