"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, GitBranch, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { renderScriptFlow, type SalesCallScript, type ScriptContact } from "@/lib/call-scripts";

type Props = {
  script: SalesCallScript;
  contact: ScriptContact;
};

type HistoryItem = {
  nodeId: string;
  answer?: string;
};

export function CallScriptFlow({ script, contact }: Props) {
  const flow = useMemo(() => renderScriptFlow(script, contact), [script, contact]);
  const nodeById = useMemo(() => new Map(flow.map(node => [node.id, node])), [flow]);
  const startId = flow[0]?.id || "";
  const [currentId, setCurrentId] = useState(startId);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setCurrentId(startId);
    setHistory([]);
  }, [script.id, contact.id, startId]);

  const current = nodeById.get(currentId) || flow[0];
  const visitedIds = new Set(history.map(item => item.nodeId));

  function go(nextId?: string | null, answer?: string) {
    if (!current || !nextId || !nodeById.has(nextId)) return;
    setHistory(items => [...items, { nodeId: current.id, answer }]);
    setCurrentId(nextId);
  }

  function back() {
    setHistory(items => {
      if (!items.length) return items;
      const previous = items[items.length - 1];
      setCurrentId(previous.nodeId);
      return items.slice(0, -1);
    });
  }

  function restart() {
    setCurrentId(startId);
    setHistory([]);
  }

  if (!current) {
    return <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">Aucun flux conditionnel configuré.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge className="gap-1"><GitBranch size={12} /> Flux question → réponse</Badge>
          <span className="text-xs text-muted-foreground">Chaque réponse choisit automatiquement la prochaine étape.</span>
        </div>
        <div className="flex gap-1.5">
          <Button type="button" size="sm" variant="ghost" className="h-8 gap-1" disabled={!history.length} onClick={back}><ArrowLeft size={13} /> Retour</Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 gap-1" onClick={restart}><RotateCcw size={13} /> Recommencer</Button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 minari-scrollbar">
        {flow.map((node, index) => {
          const active = node.id === current.id;
          const visited = visitedIds.has(node.id);
          return (
            <div key={node.id} className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] ${active ? "border-primary bg-primary text-primary-foreground" : visited ? "border-primary/25 bg-primary/[0.04] text-primary" : "border-border bg-card text-muted-foreground"}`}>
              <span>{index + 1}</span><span>{node.title}</span>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-primary/20 bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">{current.type === "question" ? "Question" : current.type === "close" ? "Sortie" : "Argument / transition"}</div>
            <h3 className="mt-1 font-display text-base font-bold">{current.title}</h3>
          </div>
          <Badge variant="outline">Étape {Math.max(1, flow.findIndex(node => node.id === current.id) + 1)} / {flow.length}</Badge>
        </div>

        <div className="mt-4 rounded-xl bg-muted/45 p-4 text-sm font-medium leading-6">“{current.text}”</div>

        {current.type === "question" ? (
          <div className="mt-4 grid gap-2 lg:grid-cols-2">
            {(current.answers || []).map(answer => {
              const next = nodeById.get(answer.next_id);
              return (
                <button
                  type="button"
                  key={answer.id}
                  onClick={() => go(answer.next_id, answer.label)}
                  className="group rounded-xl border border-border bg-background p-3 text-left transition hover:border-primary/35 hover:bg-primary/[0.025]"
                >
                  <div className="flex items-center gap-2 text-xs font-bold"><Badge variant="secondary" className="text-[9px]">SI</Badge><span>{answer.label}</span></div>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className="font-bold text-primary">ALORS</span><ArrowRight size={11} />{next?.title || "Étape suivante"}</div>
                </button>
              );
            })}
            {!current.answers?.length ? <div className="text-xs text-muted-foreground">Aucune réponse configurée pour cette question.</div> : null}
          </div>
        ) : current.type === "close" ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.035] p-3">
            <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-primary" /><span className="text-xs font-semibold">Résultat conseillé</span></div>
            <Badge>{current.outcome || "FIN DU FLUX"}</Badge>
          </div>
        ) : (
          <div className="mt-4 flex justify-end">
            <Button type="button" size="sm" className="gap-1.5" onClick={() => go(current.next_id)} disabled={!current.next_id}><span>Continuer</span><ArrowRight size={13} /></Button>
          </div>
        )}
      </div>

      {history.length ? (
        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Chemin suivi</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {history.map((item, index) => {
              const node = nodeById.get(item.nodeId);
              return <Badge key={`${item.nodeId}-${index}`} variant="outline" className="text-[9px]">{node?.title || item.nodeId}{item.answer ? ` → ${item.answer}` : ""}</Badge>;
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
