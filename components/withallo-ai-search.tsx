"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Search, Sparkles } from "lucide-react";

type SearchResult = {
  id: string; title: string; contactName: string | null; contactNumber: string | null;
  startedAt: string | null; summary: string | null; transcript: string | null; actions: string[];
};

export function WithAlloAiSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    if (loading || query.trim().length < 3) return;
    setLoading(true); setError(""); setSearched(false);
    try {
      const response = await fetch("/api/withallo/ai/search?q=" + encodeURIComponent(query.trim()), {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Recherche Allo impossible");
      setResults(Array.isArray(data.results) ? data.results : []);
      setSearched(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Recherche Allo indisponible.");
    } finally { setLoading(false); }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-primary"/> Recherche dans l'IA Allo</div>
      <p className="mt-1 text-xs text-muted-foreground">Retrouvez un échange, une objection ou une décision dans les comptes rendus et les transcriptions. Seuls les appels autorisés sont affichés.</p>
      <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={event => { event.preventDefault(); void search(); }}>
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="absolute left-3 top-2.5 text-muted-foreground"/>
          <input value={query} onChange={event => setQuery(event.target.value)}
            aria-label="Mots-clés à rechercher dans les appels Allo"
            placeholder="Ex. caution trop chère, intégration, devis, renouvellement…"
            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring"/>
        </div>
        <button type="submit" disabled={loading || query.trim().length < 3}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50">
          {loading ? <Loader2 size={14} className="animate-spin"/> : <Search size={14}/>}
          Rechercher
        </button>
      </form>
      {error ? <p role="alert" className="mt-3 text-xs text-destructive">{error}</p> : null}
      {searched ? <div className="mt-4 space-y-2">
        <p className="text-[11px] text-muted-foreground">{results.length} appel(s) trouvé(s) dans les résultats autorisés.</p>
        {results.map(result => (
          <article key={result.id} className="rounded-lg border border-border/70 bg-background p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold">{result.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {result.contactName || result.contactNumber || "Contact"} · {result.startedAt ? new Date(result.startedAt).toLocaleString("fr-FR") : "Date inconnue"}
                </p>
              </div>
              <Link href={"/phone?call=" + encodeURIComponent(result.id)} className="text-[11px] font-semibold text-primary hover:underline">Ouvrir l'appel</Link>
            </div>
            {result.summary ? <p className="mt-2 line-clamp-5 whitespace-pre-wrap break-words text-xs leading-5">{result.summary}</p>
              : result.transcript ? <p className="mt-2 line-clamp-4 whitespace-pre-wrap break-words text-xs leading-5">{result.transcript}</p>
              : <p className="mt-2 text-xs text-muted-foreground">Aucun contenu textuel disponible pour cet appel.</p>}
            {result.actions.length ? <p className="mt-2 text-[11px] text-muted-foreground">Actions Allo : {result.actions.slice(0, 3).join(" · ")}</p> : null}
          </article>
        ))}
        {!results.length ? <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">Aucun appel autorisé trouvé pour ces mots-clés. Essayez une expression plus courte.</p> : null}
      </div> : null}
    </section>
  );
}
