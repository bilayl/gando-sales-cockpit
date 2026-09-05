"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type Scorecard = {
  period: { currentMonth: string; previousMonth: string }
  cautions: { current: number; previous: number; mom: number | null; tdvCents: number }
  mau: { current: number; cautionsPerMau: number | null }
  contribution: {
    perCautionCents: number | null
    measuredContributionCents: number | null
    grossRevenueCents: number
    partnerCostCents: number
    insuranceCostCents: number | null
    complete: boolean
    missing: string[]
  }
  loss: { rate: number | null; amountCents: number; basis: string; isProxy: boolean }
  source: { lastSyncedAt: string | null }
}

function euroCents(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value / 100)
}
function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)
}
function decimal(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}
function percent(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}
function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number)
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export function KpiCeoScorecard() {
  const [data, setData] = useState<Scorecard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/kpi/ceo-scorecard", { cache: "no-store" })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || "Impossible de charger le CEO scorecard.")
        setData(body)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossible de charger le CEO scorecard.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <Skeleton className="mb-5 h-[220px] w-full rounded-xl" />
  if (error) return <div className="mb-5 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error}</div>
  if (!data) return null

  const cards = [
    {
      label: "CAUTIONS",
      value: integer(data.cautions.current),
      detail: data.cautions.mom == null ? "MoM non calculable" : `${data.cautions.mom >= 0 ? "+" : ""}${percent(data.cautions.mom)} MoM`,
      sub: `${euroCents(data.cautions.tdvCents, 0)} de volume ce mois`,
    },
    {
      label: "MAU",
      value: integer(data.mau.current),
      detail: `${decimal(data.mau.cautionsPerMau)} cautions / MAU`,
      sub: "Loueurs ayant une caution payée ce mois",
    },
    {
      label: "MARGE CONTRIBUTIVE",
      value: data.contribution.perCautionCents == null ? "À fiabiliser" : `${euroCents(data.contribution.perCautionCents)} / caution`,
      detail: data.contribution.complete ? "Coûts variables complets" : "Contribution mesurée, encore partielle",
      sub: data.contribution.complete ? "" : `Manque : ${data.contribution.missing.join(" + ")}`,
    },
    {
      label: "LOSS RATE",
      value: percent(data.loss.rate, 2),
      detail: data.loss.isProxy ? "Proxy actuel" : "Taux de perte réel",
      sub: `${euroCents(data.loss.amountCents)} · ${data.loss.basis}`,
    },
  ]

  return (
    <Card className="mb-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-primary">CEO SCORECARD</div>
          <div className="mt-0.5 text-sm font-semibold capitalize">{monthLabel(data.period.currentMonth)}</div>
        </div>
        <Badge variant="outline" className="h-6 text-[10px]">Résultats, pas activité commerciale</Badge>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, index) => (
          <div key={card.label} className={`px-4 py-4 ${index ? "border-t border-border md:border-l md:border-t-0" : ""} ${index >= 2 ? "md:border-t xl:border-t-0" : ""}`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{card.label}</div>
            <div className="mt-2 text-[25px] font-semibold tracking-[-0.04em] tabular-nums">{card.value}</div>
            <div className="mt-1 text-[11px] font-semibold text-foreground/80">{card.detail}</div>
            <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{card.sub}</div>
          </div>
        ))}
      </div>
      {!data.contribution.complete || data.loss.isProxy ? (
        <div className="border-t border-border bg-muted/10 px-4 py-2 text-[10px] text-muted-foreground">
          Fiabilité CFO : la marge contributive deviendra complète dès que les coûts PSP et les pertes finales/recouvrements seront reliés. Le Loss Rate affiché utilise pour l’instant les garanties activées comme proxy de perte.
        </div>
      ) : null}
    </Card>
  )
}
