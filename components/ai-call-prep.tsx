"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BrainCircuit, CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Objection = {
  objection: string;
  response: string;
  basis: "historique" | "probable";
};

type Prep = {
  summary: string;
  objective: string;
  whyNow: string;
  opening: string;
  keyFacts: string[];
  discoveryQuestions: string[];
  objections: Objection[];
  missingInformation: string[];
};

type Props = {
  context: any;
  contactId?: string;
  companyId?: string;
  compact?: boolean;
};

export function AiCallPrep({ context, contactId, companyId, compact = false }: Props) {
  const [prep, setPrep] = useState<Prep | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const identity = contactId || companyId || "unknown";

  useEffect(() => {
    setPrep(null);
    setError("");
  }, [identity]);

  async function generate() {
    if (!context || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/call-prep", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context }),
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Impossible de préparer l’appel");
      setPrep(payload.prep as Prep);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de préparer l’appel");
    } finally {
      setLoading(false);
    }
  }

  if (!prep) {
    return (
      <section className="rounded-xl border border-primary/20 bg-primary/[0.035] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><BrainCircuit size={16} /></span>
              <div>
                <div className="text-sm font-semibold">Assistant d’appel SDR</div>
                <div className="text-xs text-muted-foreground">Résumé du lead, objectif, ouverture, questions et objections adaptées au CRM.</div>
              </div>
            </div>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => void generate()} disabled={!context || loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? "Analyse du lead…" : "Préparer mon appel"}
          </Button>
        </div>
        {error ? <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-primary/20 bg-primary/[0.025] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge className="gap-1"><Sparkles size={11} /> Préparation IA</Badge>
          <span className="text-xs text-muted-foreground">Générée depuis le contexte CRM disponible</span>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => void generate()} disabled={loading}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Régénérer
        </Button>
      </div>

      <div className={`grid gap-3 ${compact ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Résumé du lead</div>
          <p className="mt-1.5 text-sm leading-6">{prep.summary}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Objectif de l’appel</div>
          <p className="mt-1.5 text-sm font-medium leading-6">{prep.objective}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Pourquoi maintenant</div>
          <p className="mt-1.5 text-sm leading-6">{prep.whyNow}</p>
        </div>
      </div>

      <div className="rounded-xl border border-primary/25 bg-background p-4">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary"><BrainCircuit size={13} /> Ouverture recommandée · 20–30 sec</div>
        <p className="mt-2 text-sm font-medium leading-6">“{prep.opening}”</p>
      </div>

      <div className={`grid gap-4 ${compact ? "lg:grid-cols-2" : "xl:grid-cols-2"}`}>
        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Questions à poser</div>
          <div className="space-y-2">
            {prep.discoveryQuestions.map((question, index) => (
              <div key={`${index}-${question}`} className="flex gap-2 rounded-lg border border-border bg-card p-3 text-sm leading-5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{index + 1}</span>
                <span>{question}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Objections à préparer</div>
          <div className="space-y-2">
            {prep.objections.map((item, index) => (
              <div key={`${index}-${item.objection}`} className="rounded-lg border border-border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{item.objection}</span>
                  <Badge variant={item.basis === "historique" ? "default" : "outline"} className="text-[9px]">{item.basis === "historique" ? "Déjà exprimée" : "Probable"}</Badge>
                </div>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{item.response}</p>
              </div>
            ))}
            {!prep.objections.length ? <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">Aucune objection suffisamment documentée ou pertinente à anticiper.</div> : null}
          </div>
        </div>
      </div>

      {(prep.keyFacts.length || prep.missingInformation.length) ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {prep.keyFacts.length ? (
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"><CheckCircle2 size={12} /> Faits à retenir</div>
              <ul className="mt-2 space-y-1.5 text-xs leading-5">{prep.keyFacts.map((fact, index) => <li key={`${index}-${fact}`}>• {fact}</li>)}</ul>
            </div>
          ) : null}
          {prep.missingInformation.length ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"><AlertTriangle size={12} /> À qualifier pendant l’appel</div>
              <ul className="mt-2 space-y-1.5 text-xs leading-5">{prep.missingInformation.map((item, index) => <li key={`${index}-${item}`}>• {item}</li>)}</ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
