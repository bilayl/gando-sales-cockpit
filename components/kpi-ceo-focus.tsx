"use client"

import { useMemo } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { useKpiScorecard } from "@/hooks/queries/use-kpis"

type Signal = { level: "critical" | "important" | "healthy"; title: string; text: string }

function euroCents(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / 100)
}
function decimal(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}
function percent(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: digits }).format(value)
}

const LEVEL_META = {
  critical: { dot: "bg-red-500", label: "CRITIQUE", border: "border-red-200 dark:border-red-900/50" },
  important: { dot: "bg-amber-500", label: "IMPORTANT", border: "border-amber-200 dark:border-amber-900/50" },
  healthy: { dot: "bg-emerald-500", label: "SAIN", border: "border-emerald-200 dark:border-emerald-900/50" },
}

export function KpiCeoFocus() {
  const { data, isPending, error } = useKpiScorecard();

  const signals = useMemo<Signal[]>(() => {
    if (!data) return []
    const result: Signal[] = []

    if (data.cautions.mom != null && data.cautions.mom >= 0.1) {
      result.push({ level: "healthy", title: "Croissance", text: `${data.cautions.current} cautions MTD, ${percent(data.cautions.mom)} vs même période M-1.` })
    } else if (data.cautions.mom != null && data.cautions.mom < 0) {
      result.push({ level: "important", title: "Croissance", text: `Le volume de cautions recule de ${percent(Math.abs(data.cautions.mom))} à période comparable.` })
    } else {
      result.push({ level: "important", title: "Croissance", text: "La croissance n’est pas encore assez nette pour conclure à une accélération." })
    }

    if (data.mau.cautionsPerMau != null && data.mau.cautionsPerMau >= 3.5) {
      result.push({ level: "healthy", title: "Usage", text: `${decimal(data.mau.cautionsPerMau)} cautions / MAU : le niveau d’usage atteint le repère de 3,5.` })
    } else {
      result.push({ level: "important", title: "Usage", text: `${decimal(data.mau.cautionsPerMau)} cautions / MAU : augmenter la fréquence d’usage reste un levier direct de croissance.` })
    }

    if (!data.contribution.complete) {
      result.push({ level: "critical", title: "Marge", text: `La contribution mesurée est de ${euroCents(data.contribution.perCautionCents)} / caution, mais ${data.contribution.missing.join(" + ")} manquent encore.` })
    } else if ((data.contribution.perCautionCents || 0) <= 0) {
      result.push({ level: "critical", title: "Marge", text: "La marge contributive par caution est nulle ou négative." })
    } else {
      result.push({ level: "healthy", title: "Marge", text: `${euroCents(data.contribution.perCautionCents)} de marge contributive complète par caution.` })
    }

    if (data.loss.rate != null && data.loss.rate > 0.04) {
      result.push({ level: "critical", title: "Risque", text: `Loss Rate ${percent(data.loss.rate, 2)} : au-dessus du seuil de 4 %.` })
    } else if (data.loss.rate != null && data.loss.rate > 0.017) {
      result.push({ level: "important", title: "Risque", text: `Loss Rate ${percent(data.loss.rate, 2)} : au-dessus de la cible 1,7 %.${data.loss.isProxy ? " Le chiffre reste un proxy." : ""}` })
    } else {
      result.push({ level: "healthy", title: "Risque", text: `Loss Rate ${percent(data.loss.rate, 2)} sous la cible 1,7 %.${data.loss.isProxy ? " À confirmer avec la perte nette finale." : ""}` })
    }

    return result
  }, [data])

  if (isPending) return <Skeleton className="h-[180px] w-full rounded-xl" />
  if (error || !data) return <div className="rounded-lg bg-destructive/7 px-3 py-2.5 text-xs text-destructive">{error instanceof Error ? error.message : "Lecture CEO indisponible"}</div>

  const priority = signals.find(signal => signal.level === "critical") || signals.find(signal => signal.level === "important") || signals[0]

  return (
    <section className="min-w-0">
      <div className="mb-3 text-xs font-medium text-muted-foreground">Signaux de pilotage</div>
      <div className="divide-y divide-border/45 border-y border-border/45">
        {signals.map(signal => {
          const meta = LEVEL_META[signal.level];
          return (
            <div key={signal.title} className="grid gap-2 py-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-start">
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.11em] text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                {signal.title}
              </div>
              <div className="text-xs leading-5 text-foreground/80">{signal.text}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg bg-muted/40 px-3.5 py-3">
        <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Priorité CEO</div>
        <div className="mt-1 text-sm font-semibold">{priority.title}</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{priority.text}</p>
      </div>
    </section>
  )}
