"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type Scorecard = {
  cautions: { current: number }
  guarantee: {
    providedCents: number
    averagePerCautionCents: number | null
    insuranceRateBps: number
    insuranceEffectiveFrom: string
    insuredGuaranteeCents: number
    insuranceCostCents: number
    grossRevenueYield: number | null
    measuredContributionYield: number | null
  }
  contribution: {
    perCautionCents: number | null
    measuredContributionCents: number | null
    grossRevenueCents: number
    grossRevenuePerCautionCents: number | null
    partnerCostCents: number
    partnerCostPerCautionCents: number | null
    insuranceCostCents: number
    insuranceCostPerCautionCents: number | null
    complete: boolean
    missing: string[]
  }
  loss: { rate: number | null; amountCents: number; basis: string; isProxy: boolean }
}

type Live = {
  core: {
    guaranteeProvidedCents: number
    paidCaptures: number
    paidCaptureAmountCents: number
    acceptedGuarantees: number
  }
  economics: {
    insuranceRateBps: number
    insuranceEffectiveFrom: string
    insuredGuaranteeCents: number
    insuranceTotalCents: number
    partnerCostCents: number
    measuredContributionCents: number
  }
}

function euroCents(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value / 100)
}
function percent(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}
function percentBps(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / 100)} %`
}
function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)
}

export function KpiEconomicsRisk() {
  const [scorecard, setScorecard] = useState<Scorecard | null>(null)
  const [live, setLive] = useState<Live | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    void (async () => {
      try {
        const [scoreResponse, liveResponse] = await Promise.all([
          fetch("/api/kpi/ceo-scorecard", { cache: "no-store" }),
          fetch("/api/kpi/live-business", { cache: "no-store" }),
        ])
        const [scoreBody, liveBody] = await Promise.all([scoreResponse.json(), liveResponse.json()])
        if (!scoreResponse.ok) throw new Error(scoreBody.error || "Impossible de charger l’économie.")
        if (!liveResponse.ok) throw new Error(liveBody.error || "Impossible de charger le risque.")
        setScorecard(scoreBody)
        setLive(liveBody)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossible de charger les KPI économiques.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <Skeleton className="h-[650px] w-full rounded-xl" />
  if (error || !scorecard || !live) return <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error || "Données indisponibles"}</div>

  const waterfall = [
    { label: "Gross Revenue", value: scorecard.contribution.grossRevenueCents, detail: `${euroCents(scorecard.contribution.grossRevenuePerCautionCents)} / caution` },
    { label: "− Assurance", value: -scorecard.contribution.insuranceCostCents, detail: `${percentBps(scorecard.guarantee.insuranceRateBps)} du volume assuré` },
    { label: "− Partenaires", value: -scorecard.contribution.partnerCostCents, detail: `${euroCents(scorecard.contribution.partnerCostPerCautionCents)} / caution` },
    { label: "= Contribution mesurée", value: scorecard.contribution.measuredContributionCents, detail: `${euroCents(scorecard.contribution.perCautionCents)} / caution` },
  ]

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Économie unitaire · mois en cours</div>
            <div className="mt-0.5 text-sm font-semibold">Que gagne réellement Gando sur une caution ?</div>
          </div>
          <Badge variant={scorecard.contribution.complete ? "secondary" : "outline"} className="h-6 text-[10px]">
            {scorecard.contribution.complete ? "Marge complète" : "Marge encore partielle"}
          </Badge>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4">
          <div className="px-4 py-4">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Garantie fournie</div>
            <div className="mt-2 text-[24px] font-semibold tabular-nums">{euroCents(scorecard.guarantee.providedCents, 0)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{integer(scorecard.cautions.current)} cautions · moyenne {euroCents(scorecard.guarantee.averagePerCautionCents, 0)}</div>
          </div>
          <div className="border-t border-border px-4 py-4 sm:border-l sm:border-t-0">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Gross Revenue</div>
            <div className="mt-2 text-[24px] font-semibold tabular-nums">{euroCents(scorecard.contribution.grossRevenueCents)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Yield {percent(scorecard.guarantee.grossRevenueYield)}</div>
          </div>
          <div className="border-t border-border px-4 py-4 sm:border-l xl:border-t-0">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Contribution mesurée</div>
            <div className="mt-2 text-[24px] font-semibold tabular-nums">{euroCents(scorecard.contribution.measuredContributionCents)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{euroCents(scorecard.contribution.perCautionCents)} / caution</div>
          </div>
          <div className="border-t border-border px-4 py-4 sm:border-l xl:border-t-0">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Contribution / volume</div>
            <div className="mt-2 text-[24px] font-semibold tabular-nums">{percent(scorecard.guarantee.measuredContributionYield)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Avant PSP et perte finale nette</div>
          </div>
        </div>

        <div className="border-t border-border">
          {waterfall.map((item, index) => (
            <div key={item.label} className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0">
              <div>
                <div className={`text-xs ${index === waterfall.length - 1 ? "font-bold" : "font-semibold"}`}>{item.label}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{item.detail}</div>
              </div>
              <div className={`text-sm tabular-nums ${index === waterfall.length - 1 ? "font-bold" : "font-semibold"}`}>
                {item.value < 0 ? `− ${euroCents(Math.abs(item.value))}` : euroCents(item.value)}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border bg-muted/10 px-4 py-2.5 text-[10px] text-muted-foreground">
          Assurance : {percentBps(scorecard.guarantee.insuranceRateBps)} uniquement sur les cautions payées à partir du {new Date(`${scorecard.guarantee.insuranceEffectiveFrom}T00:00:00Z`).toLocaleDateString("fr-FR")}. Aucun coût assurance n’est imputé avant septembre 2026.
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Risque</div>
          <div className="mt-0.5 text-sm font-semibold">Exposition, encaissements et pertes</div>
        </div>
        <div className="grid md:grid-cols-4">
          <div className="px-4 py-4">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Garantie cumulée</div>
            <div className="mt-2 text-xl font-semibold tabular-nums">{euroCents(live.core.guaranteeProvidedCents, 0)}</div>
          </div>
          <div className="border-t border-border px-4 py-4 md:border-l md:border-t-0">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Encaissements récupérés</div>
            <div className="mt-2 text-xl font-semibold tabular-nums">{euroCents(live.core.paidCaptureAmountCents)}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">{integer(live.core.paidCaptures)} encaissement(s) payé(s)</div>
          </div>
          <div className="border-t border-border px-4 py-4 md:border-l md:border-t-0">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Loss Rate</div>
            <div className="mt-2 text-xl font-semibold tabular-nums">{percent(scorecard.loss.rate)}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">{scorecard.loss.isProxy ? "Proxy garanties activées" : "Perte nette réelle"}</div>
          </div>
          <div className="border-t border-border px-4 py-4 md:border-l md:border-t-0">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Montant en perte proxy</div>
            <div className="mt-2 text-xl font-semibold tabular-nums">{euroCents(scorecard.loss.amountCents)}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">À remplacer par perte finale nette après recouvrement.</div>
          </div>
        </div>
      </Card>

      {!scorecard.contribution.complete ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
          <span className="font-bold">À fiabiliser en priorité :</span> {scorecard.contribution.missing.join(" + ")}. Tant que ces coûts ne sont pas reliés, la contribution affichée n’est pas la marge nette finale.
        </div>
      ) : null}
    </div>
  )
}
