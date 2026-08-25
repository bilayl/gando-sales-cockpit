"use client";

import { useEffect, useState } from "react";
import { Bot, Flame, Loader2, MessageSquareQuote, RefreshCw, Search, Send, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Prospect = {
  companyId?: string | null;
  company: string;
  domain?: string | null;
  status?: string | null;
  score: number;
  reason?: string | null;
  said?: string;
  at?: string | null;
  overdueTasks?: number;
};

type Snapshot = {
  metrics: { calls: number; prospectsTouched: number; hotProspects: number; overdueTasks: number };
  prospects: Prospect[];
};

const PRESETS = [
  { label: "Brief du jour", question: "Fais-moi le brief commercial d’aujourd’hui : qui a été contacté, qu’est-ce qui ressort et qui faut-il suivre ?", icon: Sparkles },
  { label: "Prospects chauds", question: "Quels sont les prospects les plus chauds aujourd’hui et pourquoi ?", icon: Flame },
  { label: "Ce qu’ils ont dit", question: "Résume ce que les prospects ont réellement dit aujourd’hui, avec les signaux d’intérêt et objections.", icon: MessageSquareQuote },
  { label: "Objections", question: "Quelles objections commerciales reviennent dans les appels récents et comment les traiter ?", icon: Search },
];

function fmt(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function AISalesView() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [configured, setConfigured] = useState(false);
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [scope, setScope] = useState<"today" | "recent">("today");

  async function load(nextScope = scope) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/ai-sales?scope=${nextScope}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossible de charger le brief");
      setSnapshot(payload.snapshot);
      setConfigured(Boolean(payload.configured));
      setModel(String(payload.model || ""));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(scope); }, [scope]);

  async function ask(value?: string) {
    const q = (value || question).trim();
    if (!q || asking) return;
    setQuestion(q);
    setAsking(true);
    setError("");
    try {
      const response = await fetch("/api/ai-sales", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, scope }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "OpenRouter n’a pas pu répondre");
      setSnapshot(payload.snapshot);
      setConfigured(Boolean(payload.configured));
      setModel(String(payload.model || model));
      setAnswer(payload.configured
        ? payload.answer
        : "Le moteur de recherche Sales est actif, mais OpenRouter n’est pas encore authentifié. Ajoutez OPENROUTER_API_KEY dans les variables Vercel pour activer l’analyse IA.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur OpenRouter");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="page-shell min-h-screen p-5 lg:p-7">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"><Bot size={15} /> OpenRouter × Gando</div>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">IA Sales</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Recherche dans les prospects, statuts, tâches et transcriptions d’appels pour comprendre ce qui se passe réellement sur le terrain.</p>
            {model ? <div className="mt-2"><Badge variant="outline" className="text-[10px]">Modèle : {model}</Badge></div> : null}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border bg-card p-0.5">
              <Button size="sm" variant={scope === "today" ? "secondary" : "ghost"} onClick={() => setScope("today")}>Aujourd’hui</Button>
              <Button size="sm" variant={scope === "recent" ? "secondary" : "ghost"} onClick={() => setScope("recent")}>Récent</Button>
            </div>
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualiser</Button>
          </div>
        </div>

        {!configured && !loading ? (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            <strong>OpenRouter est intégré côté code.</strong> Il reste à ajouter <code className="rounded bg-background/70 px-1.5 py-0.5">OPENROUTER_API_KEY</code> dans Vercel pour activer les réponses IA. Le modèle peut être changé avec <code className="rounded bg-background/70 px-1.5 py-0.5">OPENROUTER_MODEL</code>.
          </div>
        ) : null}

        {error ? <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Appels", snapshot?.metrics.calls ?? 0],
            ["Prospects touchés", snapshot?.metrics.prospectsTouched ?? 0],
            ["Prospects à suivre", snapshot?.metrics.hotProspects ?? 0],
            ["Tâches en retard", snapshot?.metrics.overdueTasks ?? 0],
          ].map(([label, value]) => (
            <Card key={String(label)} className="p-4"><div className="text-xs font-semibold text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-bold">{loading ? "—" : value}</div></Card>
          ))}
        </div>

        <Card className="p-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(({ label, question: preset, icon: Icon }) => <Button key={label} size="sm" variant="outline" onClick={() => void ask(preset)} disabled={asking}><Icon size={14} /> {label}</Button>)}
          </div>
          <div className="mt-3 flex gap-2">
            <Input value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void ask(); }} placeholder="Ex. Qu’a dit Atawa aujourd’hui ? Quels prospects ont une objection sur le prix ?" />
            <Button onClick={() => void ask()} disabled={!question.trim() || asking}>{asking ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Analyser</Button>
          </div>
          {answer ? <div className="mt-4 whitespace-pre-wrap rounded-xl border border-primary/15 bg-primary/[0.035] p-4 text-sm leading-6">{answer}</div> : null}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3"><div className="font-semibold">Prospects remontés par les données</div><div className="text-xs text-muted-foreground">Les extraits ci-dessous viennent des transcriptions réelles, pas d’une génération IA.</div></div>
          <div className="divide-y divide-border">
            {loading ? <div className="grid h-40 place-items-center"><Loader2 className="animate-spin text-primary" /></div> : snapshot?.prospects?.length ? snapshot.prospects.map((prospect, index) => (
              <div key={`${prospect.companyId || prospect.company}-${index}`} className="grid gap-3 px-4 py-4 lg:grid-cols-[240px_170px_1fr]">
                <div className="min-w-0"><div className="truncate font-semibold">{prospect.company}</div><div className="truncate text-xs text-muted-foreground">{prospect.domain || fmt(prospect.at)}</div></div>
                <div className="flex flex-wrap content-start gap-1.5"><Badge variant="outline">{prospect.status || "Non qualifié"}</Badge>{prospect.score ? <Badge variant="secondary">Score {prospect.score}</Badge> : null}</div>
                <div><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Ce qui a été dit</div><p className="mt-1 text-sm leading-5 text-muted-foreground">{prospect.said || "Aucun extrait exploitable."}</p>{prospect.reason ? <p className="mt-2 text-xs font-medium text-primary">{prospect.reason}</p> : null}</div>
              </div>
            )) : <div className="px-4 py-10 text-center text-sm text-muted-foreground">Aucune transcription trouvée sur cette période.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
