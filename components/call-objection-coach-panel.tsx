"use client"

import {
  ArrowRight,
  CircleAlert,
  Flame,
  MessageCircleQuestion,
  MessageSquareText,
  Snowflake,
  Target,
} from "lucide-react"
import type { CallObjectionCoach } from "@/lib/call-objection-coach"
import { Badge } from "@/components/ui/badge"

function cleanLatestSignal(transcript: string) {
  const first = transcript.split(/\n\n+/).find(Boolean)?.trim() || ""
  if (!first) return ""
  return first.replace(/^\[[^\]]+\]\s*/, "").trim()
}

function clip(value: string, max = 260) {
  const clean = value.replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1).trim()}…`
}

function objectiveFor(id: string | undefined, warm: boolean) {
  if (id === "price") return "Quantifier le coût réel de la friction avant de reparler tarif, puis obtenir une prochaine étape datée."
  if (id === "existing_solution") return "Identifier précisément où la solution actuelle échoue et obtenir l’accord pour tester Gando sur ces cas."
  if (id === "risk") return "Comprendre le niveau de garantie attendu et valider qu’un test Gando peut couvrir ce besoin sans blocage de fonds."
  if (id === "integration") return "Qualifier l’ERP / PSP et obtenir un accord pour un test léger avant toute intégration lourde."
  if (id === "timing") return "Transformer le “plus tard” en déclencheur précis et en date de reprise concrète."
  if (id === "decision_maker") return "Identifier le vrai décideur et obtenir une introduction ou un rendez-vous à plusieurs."
  if (id === "customer_friction") return "Quantifier combien de locations sont touchées par la caution et obtenir un test sur un périmètre concret."
  if (id === "no_need") return "Vérifier rapidement s’il existe une douleur réelle. S’il n’y en a pas, sortir proprement du lead."
  return warm
    ? "Reprendre exactement là où la relation s’est arrêtée et obtenir une prochaine étape concrète et datée."
    : "Comprendre comment la caution est gérée, faire émerger une friction réelle et obtenir un rendez-vous si le besoin existe."
}

function nextStepFor(id: string | undefined, warm: boolean) {
  if (id === "decision_maker") return "Un rendez-vous avec le décideur ou une introduction directe."
  if (id === "timing") return "Une date de rappel + l’événement précis qui rendra le sujet prioritaire."
  if (id === "integration") return "Le nom de l’ERP / PSP, le référent technique et l’accord pour un test sans développement lourd."
  if (id === "customer_friction" || id === "existing_solution") return "Un test ciblé sur une agence, une catégorie ou les cas où la caution actuelle pose problème."
  if (id === "risk") return "Un rendez-vous de validation du parcours d’encaissement / garantie avec la bonne personne."
  if (id === "price") return "Un rendez-vous de comparaison économique sur des volumes réels, pas une discussion tarifaire abstraite."
  if (id === "no_need") return "Soit un problème concret à creuser, soit une disqualification claire du lead."
  return warm ? "Une prochaine étape datée : rendez-vous, test, introduction décideur ou relance précise." : "Un rendez-vous de 20 minutes avec la personne qui décide du parcours de caution."
}

export function CallObjectionCoachPanel({ coach, compact = false }: { coach: CallObjectionCoach; compact?: boolean }) {
  const warm = coach.signalsAnalyzed > 0 || Boolean(coach.latestCall)
  const primary = coach.insights[0]
  const latestSignal = cleanLatestSignal(coach.transcript)

  const context = clip(primary?.evidence || latestSignal || (warm
    ? "Un historique existe dans HubSpot, mais aucun point précis n’a été détecté automatiquement. Relis le dernier échange avant de composer."
    : "Aucun échange commercial exploitable détecté : traite cet appel comme un premier contact."))

  const objective = objectiveFor(primary?.id, warm)
  const nextStep = nextStepFor(primary?.id, warm)

  const opening = warm
    ? primary
      ? `« Bonjour, je vous rappelle au sujet de Gando. Lors de notre dernier échange, le point principal était ${primary.title.toLowerCase()}. Je voulais voir ce qui a évolué depuis et où vous en êtes aujourd’hui. »`
      : "« Bonjour, je vous rappelle au sujet de Gando. Je reprends notre dernier échange pour voir où vous en êtes aujourd’hui et si le sujet est toujours d’actualité. »"
    : "« Bonjour, je vous appelle rapidement car nous aidons des loueurs à éviter de bloquer la caution client tout en gardant une garantie d’encaissement. Comment vous gérez la caution aujourd’hui ? »"

  const questions = Array.from(new Set([
    primary?.nextQuestion || (warm
      ? "Depuis notre dernier échange, qu’est-ce qui a évolué de votre côté ?"
      : "Comment gérez-vous aujourd’hui la caution et quel montant demandez-vous le plus souvent ?"),
    primary?.id === "customer_friction"
      ? "Sur un mois normal, combien de locations sont réellement touchées par ce problème ?"
      : "Dans quels cas votre système actuel de caution crée le plus de friction ou de traitement manuel ?",
    primary?.id === "decision_maker"
      ? "Qui doit être convaincu avec vous pour pouvoir lancer un test ?"
      : "Si l’intérêt est confirmé, qui doit valider un test ou un changement de parcours chez vous ?",
  ])).slice(0, 3)

  const objectionTitle = primary?.title || "Aucune objection explicite détectée"
  const objectionResponse = primary?.recommendedResponse || "N’invente pas d’objection. Qualifie d’abord le fonctionnement actuel, la fréquence des problèmes et leur impact avant de présenter la solution."
  const vigilance = warm
    ? "Ne refais pas le pitch depuis zéro. Cite le contexte existant dans les 20 premières secondes."
    : "Ne déroule pas toute la présentation Gando avant d’avoir identifié une douleur concrète."

  return (
    <section className={`rounded-xl border ${warm ? "border-amber-500/25 bg-amber-500/[0.04]" : "border-sky-500/20 bg-sky-500/[0.035]"} ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {warm ? <Flame className="h-4 w-4 text-amber-600" /> : <Snowflake className="h-4 w-4 text-sky-600" />}
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Brief avant appel · à lire avant de composer</div>
          </div>
          <div className="mt-1 text-sm font-semibold">{warm ? "Warm call · reprendre la relation, pas le pitch" : "Cold call · qualifier avant de présenter"}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={warm ? "border-amber-500/30 text-amber-700 dark:text-amber-300" : "border-sky-500/30 text-sky-700 dark:text-sky-300"}>{warm ? "WARM" : "COLD"}</Badge>
          <Badge variant="secondary">{coach.signalsAnalyzed} signal{coach.signalsAnalyzed > 1 ? "aux" : ""} CRM</Badge>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-primary/20 bg-primary/[0.055] p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-primary"><Target size={12} /> Objectif de cet appel</div>
        <div className="mt-1.5 text-sm font-semibold leading-5">{objective}</div>
      </div>

      <div className={`mt-3 grid gap-3 ${compact ? "" : "lg:grid-cols-3"}`}>
        <div className="rounded-lg border border-border/80 bg-background/75 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground"><MessageSquareText size={12} /> Dernier contexte utile</div>
          <div className="mt-2 text-xs leading-5 text-foreground/90">{context}</div>
          {coach.insights.length > 1 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {coach.insights.slice(0, 4).map(insight => <Badge key={insight.id} variant="outline" className="text-[10px] font-medium">{insight.title}</Badge>)}
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-border/80 bg-background/75 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground"><ArrowRight size={12} /> Ouverture suggérée</div>
          <div className="mt-2 text-xs font-medium leading-5 text-foreground">{opening}</div>
        </div>

        <div className="rounded-lg border border-border/80 bg-background/75 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground"><MessageCircleQuestion size={12} /> 3 questions prioritaires</div>
          <ol className="mt-2 space-y-1.5 text-xs leading-5 text-foreground/90">
            {questions.map((question, index) => (
              <li key={question} className="flex gap-2"><span className="font-bold text-primary">{index + 1}.</span><span>{question}</span></li>
            ))}
          </ol>
        </div>
      </div>

      <div className={`mt-3 grid gap-3 ${compact ? "" : "lg:grid-cols-2"}`}>
        <div className="rounded-lg border border-border/80 bg-background/75 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground"><CircleAlert size={12} /> Objection probable · réponse</div>
          <div className="mt-2 text-xs font-semibold">{objectionTitle}</div>
          <div className="mt-1 text-xs leading-5 text-foreground/85">{objectionResponse}</div>
        </div>

        <div className="rounded-lg border border-border/80 bg-background/75 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground"><Target size={12} /> Sortie à obtenir</div>
          <div className="mt-2 text-xs font-semibold leading-5">{nextStep}</div>
          <div className="mt-2 border-t border-border/70 pt-2 text-[11px] leading-4 text-muted-foreground"><strong className="text-foreground">Vigilance :</strong> {vigilance}</div>
        </div>
      </div>
    </section>
  )
}
