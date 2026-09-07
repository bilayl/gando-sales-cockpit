"use client"

import { BrainCircuit, MessageSquareQuote, RotateCw, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { CallObjectionCoach } from "@/lib/call-objection-coach"

export function CallObjectionCoachPanel({ coach, compact = false }: { coach: CallObjectionCoach; compact?: boolean }) {
  if (!coach.signalsAnalyzed) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-3 text-xs text-muted-foreground">
        Aucune note ou synthèse d’appel exploitable pour le moment. Le script s’enrichira automatiquement avec les prochains échanges enregistrés.
      </div>
    )
  }

  return (
    <section className="rounded-2xl border border-primary/20 bg-primary/[0.025] p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold"><BrainCircuit size={15} className="text-primary" /> Mémoire commerciale & objections</div>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">Le Cockpit relit les notes et synthèses des appels précédents pour préparer le SDR avant de répondre.</p>
        </div>
        <Badge variant="outline" className="text-[9px]">{coach.signalsAnalyzed} signal{coach.signalsAnalyzed > 1 ? "s" : ""} analysé{coach.signalsAnalyzed > 1 ? "s" : ""}</Badge>
      </div>

      {coach.insights.length ? (
        <div className={`mt-3 grid gap-2 ${compact ? "xl:grid-cols-2" : "xl:grid-cols-2"}`}>
          {coach.insights.map(insight => (
            <article key={insight.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[9px]">OBJECTION DÉTECTÉE</Badge>
                <div className="text-xs font-bold">{insight.title}</div>
                <span className="ml-auto text-[9px] uppercase tracking-wide text-muted-foreground">{insight.source === "calls" ? "Appel" : insight.source === "notes" ? "Note" : "CRM"}</span>
              </div>

              <div className="mt-2 rounded-lg bg-muted/45 p-2.5 text-[10px] leading-4 text-muted-foreground">
                <div className="mb-1 flex items-center gap-1 font-bold uppercase tracking-wide text-foreground/70"><MessageSquareQuote size={11} /> Historique</div>
                “{insight.evidence}”
              </div>

              <div className="mt-2 text-[10px] leading-4">
                <span className="font-bold">Ce que ça signifie : </span>{insight.explanation}
              </div>
              <div className="mt-2 rounded-lg border border-primary/15 bg-primary/[0.035] p-2.5 text-[10px] leading-4">
                <div className="mb-1 flex items-center gap-1 font-bold text-primary"><ShieldCheck size={11} /> Comment répondre</div>
                {insight.recommendedResponse}
              </div>
              <div className="mt-2 flex gap-2 rounded-lg border border-border p-2.5 text-[10px] leading-4">
                <RotateCw size={12} className="mt-0.5 shrink-0 text-primary" />
                <div><span className="font-bold">Question de rebond : </span>“{insight.nextQuestion}”</div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-border bg-card p-3 text-xs leading-5 text-muted-foreground">
          Aucun motif d’objection récurrent n’a encore été détecté. Le SDR peut utiliser le flux normalement et continuer à documenter les réponses dans les notes d’appel.
        </div>
      )}
    </section>
  )
}
