"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, GitBranch, Loader2, MessageSquareText, ShieldQuestion, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CallScriptLibrary } from "@/components/call-script-library";
import type { SalesCallScript, ScriptFlowNode } from "@/lib/call-scripts";

type ScriptStats = {
  steps: number;
  questions: number;
  branches: number;
  exits: number;
};

function stats(script?: SalesCallScript): ScriptStats {
  const flow = script?.flow || [];
  return {
    steps: flow.length,
    questions: flow.filter(node => node.type === "question").length,
    branches: flow.reduce((sum, node) => sum + (node.answers?.length || 0), 0),
    exits: flow.filter(node => node.type === "close").length,
  };
}

function nodeTypeLabel(node: ScriptFlowNode) {
  if (node.type === "question") return "Question";
  if (node.type === "close") return "Sortie";
  return "Argument";
}

export function SalesScriptsWorkspace() {
  const [scripts, setScripts] = useState<SalesCallScript[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/call-scripts", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Impossible de charger les scripts commerciaux");
        const loaded = (payload.results || []) as SalesCallScript[];
        setScripts(loaded);
        setCanManage(Boolean(payload.canManage));
        setSelectedId(loaded.find(item => item.is_default)?.id || loaded[0]?.id || "");
      })
      .catch(cause => {
        if ((cause as Error).name !== "AbortError") setError(cause instanceof Error ? cause.message : "Erreur de chargement");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const selected = useMemo(
    () => scripts.find(item => item.id === selectedId) || scripts.find(item => item.is_default) || scripts[0],
    [scripts, selectedId],
  );
  const selectedStats = useMemo(() => stats(selected), [selected]);

  function handleSaved(script: SalesCallScript) {
    setScripts(current => {
      const others = current
        .filter(item => item.id !== script.id)
        .map(item => script.is_default ? { ...item, is_default: false } : item);
      return [script, ...others];
    });
    setSelectedId(script.id);
  }

  const activeCount = scripts.filter(item => item.is_active).length;
  const totalSteps = scripts.reduce((sum, item) => sum + (item.flow?.length || 0), 0);
  const totalBranches = scripts.reduce((sum, item) => sum + (item.flow || []).reduce((branchSum, node) => branchSum + (node.answers?.length || 0), 0), 0);

  return (
    <div className="page-shell min-h-screen overflow-y-auto px-4 py-5 sm:px-6 lg:px-7">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-primary"><BookOpen size={13} /> Playbook commercial</div>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">Scripts commerciaux</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Centralisez ici toute la logique commerciale : questions, réponses, branches SI → ALORS, objections, qualification et sorties. Les fiches Entreprises ne contiennent plus la gestion des scripts.</p>
          </div>
          {scripts.length ? (
            <CallScriptLibrary scripts={scripts} selectedId={selectedId} canManage={canManage} onSelect={setSelectedId} onSaved={handleSaved} />
          ) : null}
        </header>

        {error ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-4"><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Scripts</div><div className="mt-1 text-2xl font-bold">{scripts.length}</div><div className="text-[11px] text-muted-foreground">{activeCount} actif{activeCount > 1 ? "s" : ""}</div></Card>
          <Card className="p-4"><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Étapes</div><div className="mt-1 text-2xl font-bold">{totalSteps}</div><div className="text-[11px] text-muted-foreground">Questions, arguments et sorties</div></Card>
          <Card className="p-4"><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Branches</div><div className="mt-1 text-2xl font-bold">{totalBranches}</div><div className="text-[11px] text-muted-foreground">Décisions SI → ALORS</div></Card>
          <Card className="p-4"><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Script par défaut</div><div className="mt-1 truncate text-base font-bold">{scripts.find(item => item.is_default)?.name || "—"}</div><div className="text-[11px] text-muted-foreground">Utilisé pendant les sessions d’appels</div></Card>
        </div>

        {loading ? (
          <Card className="grid min-h-[360px] place-items-center"><Loader2 className="animate-spin text-primary" /></Card>
        ) : scripts.length ? (
          <div className="grid gap-4 lg:grid-cols-[310px_minmax(0,1fr)]">
            <Card className="h-fit p-3">
              <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Bibliothèque</div>
              <div className="space-y-2">
                {scripts.map(script => {
                  const scriptStats = stats(script);
                  const active = script.id === selected?.id;
                  return (
                    <button
                      type="button"
                      key={script.id}
                      onClick={() => setSelectedId(script.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${active ? "border-primary/35 bg-primary/[0.045]" : "border-border bg-card hover:bg-muted/40"}`}
                    >
                      <div className="flex items-start justify-between gap-2"><span className="text-sm font-bold">{script.name}</span>{script.is_default ? <Badge className="text-[9px]">Défaut</Badge> : null}</div>
                      <div className="mt-1.5 text-[11px] text-muted-foreground">{script.segment}</div>
                      <div className="mt-2 flex flex-wrap gap-1"><Badge variant="outline" className="text-[9px]">{scriptStats.steps} étapes</Badge><Badge variant="outline" className="text-[9px]">{scriptStats.branches} branches</Badge>{!script.is_active ? <Badge variant="secondary" className="text-[9px]">Inactif</Badge> : null}</div>
                    </button>
                  );
                })}
              </div>
            </Card>

            {selected ? (
              <div className="space-y-4">
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{selected.segment}</Badge>{selected.is_default ? <Badge>Script par défaut</Badge> : null}{selected.is_active ? <Badge variant="secondary">Actif</Badge> : <Badge variant="outline">Inactif</Badge>}</div>
                      <h2 className="mt-2 font-display text-xl font-bold">{selected.name}</h2>
                      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{selected.description || "Aucune description renseignée."}</p>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="rounded-lg bg-muted/45 px-3 py-2"><div className="text-lg font-bold">{selectedStats.steps}</div><div className="text-[9px] uppercase text-muted-foreground">Étapes</div></div>
                      <div className="rounded-lg bg-muted/45 px-3 py-2"><div className="text-lg font-bold">{selectedStats.questions}</div><div className="text-[9px] uppercase text-muted-foreground">Questions</div></div>
                      <div className="rounded-lg bg-muted/45 px-3 py-2"><div className="text-lg font-bold">{selectedStats.branches}</div><div className="text-[9px] uppercase text-muted-foreground">Branches</div></div>
                      <div className="rounded-lg bg-muted/45 px-3 py-2"><div className="text-lg font-bold">{selectedStats.exits}</div><div className="text-[9px] uppercase text-muted-foreground">Sorties</div></div>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div><div className="flex items-center gap-2 font-display text-base font-bold"><GitBranch size={16} className="text-primary" /> Carte complète du flux</div><div className="mt-1 text-[11px] text-muted-foreground">Toutes les branches restent visibles ici afin d’enrichir le playbook sans passer par une fiche prospect.</div></div>
                    {canManage ? <span className="text-[11px] text-muted-foreground">Utilise le bouton <strong>Scripts</strong> en haut pour modifier le flux.</span> : null}
                  </div>

                  <div className="space-y-3">
                    {(selected.flow || []).map((node, index) => (
                      <div key={node.id} className="rounded-xl border border-border bg-card p-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="h-6 w-6 justify-center rounded-full p-0 text-[10px]">{index + 1}</Badge>
                          <Badge variant="outline" className="text-[9px]">{nodeTypeLabel(node)}</Badge>
                          <div className="text-sm font-bold">{node.title}</div>
                          <code className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">{node.id}</code>
                        </div>
                        <div className="mt-2 rounded-lg bg-muted/35 p-3 text-xs leading-5">{node.text}</div>
                        {node.type === "question" && node.answers?.length ? (
                          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {node.answers.map(answer => {
                              const target = selected.flow?.find(item => item.id === answer.next_id);
                              return <div key={answer.id} className="rounded-lg border border-primary/15 bg-primary/[0.025] p-2.5"><div className="flex items-center gap-1.5 text-[11px] font-semibold"><Badge variant="secondary" className="text-[8px]">SI</Badge>{answer.label}</div><div className="mt-1.5 text-[10px] text-muted-foreground"><strong className="text-primary">ALORS</strong> → {target?.title || answer.next_id || "Fin"}</div></div>;
                            })}
                          </div>
                        ) : null}
                        {node.type === "message" && node.next_id ? <div className="mt-2 text-[10px] text-muted-foreground"><strong className="text-primary">PUIS</strong> → {selected.flow?.find(item => item.id === node.next_id)?.title || node.next_id}</div> : null}
                        {node.type === "close" ? <div className="mt-2 flex items-center gap-2 text-[11px]"><CheckCircle2 size={13} className="text-primary" /><strong>Résultat :</strong> {node.outcome || "Fin du flux"}</div> : null}
                      </div>
                    ))}
                    {!selected.flow?.length ? <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Aucun flux conditionnel n’est encore configuré pour ce script.</div> : null}
                  </div>
                </Card>

                <div className="grid gap-4 xl:grid-cols-2">
                  <Card className="p-4">
                    <div className="flex items-center gap-2 font-display text-sm font-bold"><ShieldQuestion size={15} className="text-primary" /> Qualification</div>
                    <div className="mt-3 space-y-2">{(selected.qualification_rules || []).map(rule => <div key={rule} className="rounded-lg border border-border bg-muted/25 p-2.5 text-xs leading-5">{rule}</div>)}{!selected.qualification_rules?.length ? <div className="text-xs text-muted-foreground">Aucune règle renseignée.</div> : null}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 font-display text-sm font-bold"><Sparkles size={15} className="text-primary" /> Objections & réponses</div>
                    <div className="mt-3 space-y-2">{(selected.objections || []).map(objection => <div key={objection} className="rounded-lg border border-border bg-muted/25 p-2.5 text-xs leading-5">{objection}</div>)}{!selected.objections?.length ? <div className="text-xs text-muted-foreground">Aucune objection renseignée.</div> : null}</div>
                  </Card>
                </div>

                <Card className="p-4">
                  <div className="flex items-center gap-2 font-display text-sm font-bold"><MessageSquareText size={15} className="text-primary" /> Blocs réutilisables</div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-3">
                    <div className="rounded-xl border border-border p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Introduction</div><div className="mt-2 text-xs leading-5">{selected.introduction}</div></div>
                    <div className="rounded-xl border border-border p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Proposition de valeur</div><div className="mt-2 text-xs leading-5">{selected.value_proposition}</div></div>
                    <div className="rounded-xl border border-border p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Closing</div><div className="mt-2 text-xs leading-5">{selected.closing}</div></div>
                  </div>
                </Card>
              </div>
            ) : null}
          </div>
        ) : (
          <Card className="p-10 text-center">
            <BookOpen className="mx-auto text-muted-foreground" />
            <div className="mt-3 font-semibold">Aucun script commercial</div>
            <div className="mt-1 text-sm text-muted-foreground">Crée le premier playbook depuis cette catégorie.</div>
            {canManage ? <div className="mt-4"><CallScriptLibrary scripts={[]} selectedId="" canManage={canManage} onSelect={setSelectedId} onSaved={handleSaved} /></div> : null}
          </Card>
        )}
      </div>
    </div>
  );
}
