"use client"

import { Flame, MessageSquareText, Snowflake, Target } from "lucide-react"
import type { CallObjectionCoach } from "@/lib/call-objection-coach"
import { Badge } from "@/components/ui/badge"

export function CallObjectionCoachPanel({ coach, compact = false }: { coach: CallObjectionCoach; compact?: boolean }) {
  const warm = coach.signalsAnalyzed > 0 || Boolean(coach.latestCall)
  const primary = coach.insights[0]

  const context = primary?.evidence || (warm
    ? "Un historique existe déjà dans HubSpot. Repars du dernier échange avant de présenter Gando."
    : "Aucun échange commercial exploitable détecté : traite cet appel comme un premier contact.")

  const recommended = primary?.recommendedResponse || (warm
    ? "Commence par rappeler le contexte connu, vérifie ce qui a évolué, puis cherche une prochaine étape concrète plutôt que de refaire le pitch depuis zéro."
    : "Fais une accroche courte, qualifie comment la caution est gérée aujourd’hui et identifie une friction réelle avant de présenter Gando.")

  const nextQuestion = primary?.nextQuestion || (warm
    ? "Depuis notre dernier échange, qu’est-ce qui a évolué de votre côté et quelle serait la prochaine étape logique ?"
    : "Comment gérez-vous aujourd’hui la caution, et dans quels cas cela crée le plus de friction pour vos clients ou vos équipes ?")

  return (
    <section className={`rounded-xl border ${warm ? "border-amber-500/25 bg-amber-500/[0.04]" : "border-sky-500/20 bg-sky-500/[0.035]"} ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {warm ? <Flame className="h-4 w-4 text-amber-600" /> : <Snowflake className="h-4 w-4 text-sky-600" />}
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Brief avant appel</div>
          </div>
          <div className="mt-1 text-sm font-semibold">{warm ? "Warm call · reprendre la relation" : "Cold call · premier contact"}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={warm ? "border-amber-500/30 text-amber-700 dark:text-amber-300" : "border-sky-500/30 text-sky-700 dark:text-sky-300"}>{warm ? "WARM" : "COLD"}</Badge>
          <Badge variant="secondary">{coach.signalsAnalyzed} signal{coach.signalsAnalyzed > 1 ? "aux" : ""} CRM</Badge>
        </div>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "" : "lg:grid-cols-3"}`}>
        <div className="rounded-lg border border-border/80 bg-background/70 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground"><MessageSquareText size={12} /> Ce qu’on sait</div>
          <div className="mt-2 text-xs leading-5 text-foreground/90">{context}</div>
        </div>
        <div className="rounded-lg border border-border/80 bg-background/70 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground"><Target size={12} /> Ce que tu dois faire</div>
          <div className="mt-2 text-xs leading-5 text-foreground/90">{recommended}</div>
        </div>
        <div className="rounded-lg border border-border/80 bg-background/70 p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Question à poser</div>
          <div className="mt-2 text-xs font-medium leading-5 text-foreground">{nextQuestion}</div>
        </div>
      </div>

      {coach.insights.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {coach.insights.slice(0, 4).map(insight => (
            <Badge key={insight.id} variant="outline" className="font-medium">{insight.title}</Badge>
          ))}
        </div>
      ) : null}
    </section>
  )
}
