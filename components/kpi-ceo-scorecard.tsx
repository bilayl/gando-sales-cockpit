"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type Scorecard = {
  period: {
    currentMonth: string
    previousMonth: string
    comparisonMode?: string
    comparisonThroughDay?: number
  }
  cautions: { current: number; previous: number; total: number; mom: number | null; tdvCents: number; totalTdvCents: number }
  mau: { current: number; cautionsPerMau: number | null; activatedEver: number; cautionsPerActivatedEver: number | null }
  guarantee: {
    providedCents: number
    totalProvidedCents: number
    averagePerCautionCents: number | null
    totalAveragePerCautionCents: number | null
    insuranceRateBps: number
    insuranceCostCents: number
    totalInsuranceCostCents: number
    grossRevenueYield: number | null
    totalGrossRevenueYield: number | null
    measuredContributionYield: number | null
    totalMeasuredContributionYield: number | null
  }
  contribution: {
    perCautionCents: number | null
    measuredContributionCents: number
    grossRevenueCents: number
    grossRevenuePerCautionCents: number | null
    partnerCostCents: number
    partnerCostPerCautionCents: number | null
    insuranceCostCents: number
    insuranceCostPerCautionCents: number | null
    totalPerCautionCents: number | null
    totalMeasuredContributionCents: number
    totalGrossRevenueCents: number
    totalGrossRevenuePerCautionCents: number | null
    totalPartnerCostCents: number
    totalPartnerCostPerCautionCents: number | null
    totalInsuranceCostCents: number
    totalInsuranceCostPerCautionCents: number | null
    complete: boolean
    missing: string[]
  }
  loss: { currentRate: number | null; currentAmountCents: number; rate: number | null; amountCents: number; basis: string; isProxy: boolean }
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
function percentBps(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / 100)} %`
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

  if (loading) return <Skeleton className="mb-5 h-[270px] w-full rounded-xl" />
  if (error) return <div className="mb-5 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error}</div>
  if (!data) return null

  const comparisonLabel = data.period.comparisonMode === "same_elapsed_period_previous_month"
    ? "vs même période M-1"
    : "MoM"

  const cards = [
    {
      label: "CAUTIONS",
      currentValue: integer(data.cautions.current),
      currentDetail: data.cautions.mom == null ? "Comparaison non calculable" : `${data.cautions.mom >= 0 ? "+" : ""}${percent(data.cautions.mom)} ${comparisonLabel}`,
      currentSub: `${euroCents(data.cautions.tdvCents, 0)} garantis · ${euroCents(data.guarantee.averagePerCautionCents, 0)} / caution`,
      lifetimeValue: integer(data.cautions.total),
      lifetimeDetail: `${euroCents(data.cautions.totalTdvCents, 0)} garantis depuis le début`,
      lifetimeSub: `${euroCents(data.guarantee.totalAveragePerCautionCents, 0)} / caution en moyenne`,
    },
    {
      label: "MAU / LOUEURS ACTIVÉS",
      currentValue: integer(data.mau.current),
      currentDetail: `${decimal(data.mau.cautionsPerMau)} cautions / MAU`,
      currentSub: "Loueurs actifs sur le mois en cours",
      lifetimeValue: integer(data.mau.activatedEver),
      lifetimeDetail: `${decimal(data.mau.cautionsPerActivatedEver)} cautions / loueur activé`,
      lifetimeSub: "Loueurs ayant déjà activé au moins une caution",
    },
    {
      label: "MARGE CONTRIBUTIVE",
      currentValue: data.contribution.perCautionCents == null ? "À fiabiliser" : `${euroCents(data.contribution.perCautionCents)} / caution`,
      currentDetail: `${euroCents(data.contribution.measuredContributionCents)} mesurés ce mois`,
      currentSub: "Avant PSP + perte nette Gando",
      lifetimeValue: data.contribution.totalPerCautionCents == null ? "À fiabiliser" : `${euroCents(data.contribution.totalPerCautionCents)} / caution`,
      lifetimeDetail: `${euroCents(data.contribution.totalMeasuredContributionCents)} cumulés`,
      lifetimeSub: "Avant PSP + perte nette Gando",
    },
    {
      label: data.loss.isProxy ? "RISQUE ACTIVÉ" : "LOSS RATE NET",
      currentValue: percent(data.loss.currentRate, 2),
      currentDetail: `${euroCents(data.loss.currentAmountCents)} ce mois`,
      currentSub: data.loss.isProxy ? "Garanties Gando activées / volume garanti" : "Perte nette Gando / volume garanti",
      lifetimeValue: percent(data.loss.rate, 2),
      lifetimeDetail: `${euroCents(data.loss.amountCents)} depuis le début`,
      lifetimeSub: data.loss.isProxy ? "Ce ratio n’est pas encore la perte économique finale de Gando" : data.loss.basis,
    },
  ]

  const economics = [
    { label: "Gross Revenue", month: data.contribution.grossRevenueCents, total: data.contribution.totalGrossRevenueCents },
    { label: "Coût assurance", month: data.guarantee.insuranceCostCents, total: data.guarantee.totalInsuranceCostCents },
    { label: "Commissions partenaires", month: data.contribution.partnerCostCents, total: data.contribution.totalPartnerCostCents },
    { label: "Marge mesurée", month: data.contribution.measuredContributionCents, total: data.contribution.totalMeasuredContributionCents },
  ]

  return (
    <Card className="mb-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-primary">CEO SCORECARD</div>
          <div className="mt-0.5 text-sm font-semibold capitalize">{monthLabel(data.period.currentMonth)} · mois actuel + depuis le début</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="h-6 text-[10px]">Assurance : {percentBps(data.guarantee.insuranceRateBps)} depuis sept. 2026</Badge>
          <Badge variant="outline" className="h-6 text-[10px]">Résultats, pas activité commerciale</Badge>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, index) => (
          <div key={card.label} className={`${index ? "border-t border-border md:border-l md:border-t-0" : ""} ${index >= 2 ? "md:border-t xl:border-t-0" : ""}`}>
            <div className="px-4 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{card.label}</div>
              <div className="mt-3 text-[9px] font-bold uppercase tracking-[0.12em] text-primary">Ce mois</div>
              <div className="mt-1 text-[25px] font-semibold tracking-[-0.04em] tabular-nums">{card.currentValue}</div>
              <div className="mt-1 text-[11px] font-semibold text-foreground/80">{card.currentDetail}</div>
              <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{card.currentSub}</div>
            </div>
            <div className="border-t border-border bg-muted/10 px-4 py-3">
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Depuis le début</div>
              <div className="mt-1 text-[18px] font-semibold tracking-[-0.03em] tabular-nums">{card.lifetimeValue}</div>
              <div className="mt-1 text-[10px] font-semibold text-foreground/75">{card.lifetimeDetail}</div>
              <div className="mt-0.5 text-[9px] leading-relaxed text-muted-foreground">{card.lifetimeSub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid border-t border-border sm:grid-cols-2 lg:grid-cols-4">
        {economics.map((item, index) => (
          <div key={item.label} className={`px-4 py-3 ${index ? "border-t border-border sm:border-l sm:border-t-0" : ""} ${index >= 2 ? "sm:border-t lg:border-t-0" : ""}`}>
            <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{item.label}</div>
            <div className="mt-1 text-xs font-semibold tabular-nums">{euroCents(item.month)} <span className="font-normal text-muted-foreground">ce mois</span></div>
            <div className="mt-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">{euroCents(item.total)} depuis le début</div>
          </div>
        ))}
      </div>

      {!data.contribution.complete || data.loss.isProxy ? (
        <div className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          Fiabilité CFO : la marge reste mesurée avant PSP et perte nette Gando après récupération. Le ratio de risque affiché reste un proxy basé sur les garanties Gando activées tant que les pertes clôturées ne sont pas reliées.
        </div>
      ) : null}
    </Card>
  )
}
