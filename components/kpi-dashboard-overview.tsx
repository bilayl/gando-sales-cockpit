"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CheckCircle2, CircleDollarSign, Database, Target, UsersRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { KpiChartAreaInteractive } from "@/components/kpi-chart-area-interactive"
import { KpiDataTable } from "@/components/kpi-data-table"
import { KpiSectionCards } from "@/components/kpi-section-cards"
import {
  buildKpiDashboardSummary,
  type CampaignKpiRow,
  type CoreKpiRow,
  type ValueKpiRow,
} from "@/lib/kpi-dashboard"

function euro(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: digits }).format(value)
}

function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)
}

function percent(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: digits }).format(value)
}

function ratio(top: number, bottom: number) {
  return bottom > 0 ? top / bottom : null
}

export function KpiDashboardOverview() {
  const [coreRows, setCoreRows] = useState<CoreKpiRow[]>([])
  const [valueRows, setValueRows] = useState<ValueKpiRow[]>([])
  const [campaignRows, setCampaignRows] = useState<CampaignKpiRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    void (async () => {
      try {
        const [coreResponse, valueResponse, campaignResponse] = await Promise.all([
          fetch("/api/kpi", { cache: "no-store" }),
          fetch("/api/kpi/value-funnel", { cache: "no-store" }),
          fetch("/api/kpi/campaigns", { cache: "no-store" }),
        ])
        const [coreBody, valueBody, campaignBody] = await Promise.all([
          coreResponse.json(), valueResponse.json(), campaignResponse.json(),
        ])
        if (!coreResponse.ok) throw new Error(coreBody.error || "Impossible de charger les KPI.")
        if (!valueResponse.ok) throw new Error(valueBody.error || "Impossible de charger le funnel.")
        if (!campaignResponse.ok) throw new Error(campaignBody.error || "Impossible de charger les campagnes.")
        setCoreRows(Array.isArray(coreBody.rows) ? coreBody.rows : [])
        setValueRows(Array.isArray(valueBody.rows) ? valueBody.rows : [])
        setCampaignRows(Array.isArray(campaignBody.rows) ? campaignBody.rows : [])
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossible de charger le dashboard KPI.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const summary = useMemo(
    () => buildKpiDashboardSummary(coreRows, valueRows, campaignRows),
    [coreRows, valueRows, campaignRows],
  )

  if (loading) return <div className="px-4 py-16 text-center text-sm text-muted-foreground lg:px-6">Chargement du dashboard KPI…</div>
  if (error) return <div className="mx-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive lg:mx-6">{error}</div>
  if (!summary) return <div className="px-4 py-16 text-center text-sm text-muted-foreground lg:px-6">Aucune donnée KPI disponible.</div>

  const coverageAverage = (
    summary.coverage.revenue + summary.coverage.tdv + summary.coverage.deposits + summary.coverage.activeRenters
  ) / (summary.coverage.total * 4)

  return (
    <div id="kpi-dashboard" className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex flex-col gap-2 px-4 lg:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Depuis le début</Badge>
              <span className="text-xs text-muted-foreground">{summary.firstLabel} → {summary.lastLabel}</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] sm:text-3xl">Vue de pilotage Gando</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Une lecture simple : volume → usage → revenu → cash. Les ratios sont calculés automatiquement à partir des données réelles.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm">
            <Database className="h-4 w-4 text-primary" />
            <span>Qualité des données</span>
            <Badge variant="secondary">{percent(coverageAverage, 0)}</Badge>
          </div>
        </div>
      </div>

      <KpiSectionCards summary={summary} />

      <div className="grid gap-4 px-4 lg:px-6 @5xl/main:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.7fr)]">
        <KpiChartAreaInteractive data={summary.points} />

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/70">
            <CardTitle className="text-base">Value funnel</CardTitle>
            <CardDescription>Du prospect au loueur qui active sa première caution.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            {[
              { label: "Prospects contactés", value: summary.prospects, next: ratio(summary.meetings, summary.prospects), icon: UsersRound },
              { label: "Rendez-vous", value: summary.meetings, next: ratio(summary.rentersActivated, summary.meetings), icon: Target },
              { label: "Loueurs activés", value: summary.rentersActivated, next: ratio(summary.firstDepositRenters, summary.rentersActivated), icon: CheckCircle2 },
              { label: "1re caution", value: summary.firstDepositRenters, next: null, icon: CircleDollarSign },
            ].map((step, index, all) => {
              const Icon = step.icon
              return (
                <div key={step.label} className="relative flex gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground">{step.label}</div>
                        <div className="mt-0.5 text-xl font-bold tracking-[-0.03em]">{integer(step.value)}</div>
                      </div>
                      {step.next != null ? <Badge variant="outline">{percent(step.next)}</Badge> : null}
                    </div>
                    {index < all.length - 1 ? <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"><ArrowRight className="h-3 w-3" /> conversion vers l’étape suivante</div> : null}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 px-4 lg:px-6 @5xl/main:grid-cols-3">
        <Card className="border-border/80 shadow-sm">
          <CardHeader><CardDescription>Cash collecté</CardDescription><CardTitle className="text-2xl">{euro(summary.cashCollected)}</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground">{percent(summary.collectionRate)} du CA signé ({euro(summary.signedRevenue)})</CardContent>
        </Card>
        <Card className="border-border/80 shadow-sm">
          <CardHeader><CardDescription>Marge nette renseignée</CardDescription><CardTitle className="text-2xl">{euro(summary.netMargin)}</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground">Taux de marge consolidé {percent(summary.marginRate)}</CardContent>
        </Card>
        <Card className="border-border/80 shadow-sm">
          <CardHeader><CardDescription>ROAS cash campagnes</CardDescription><CardTitle className="text-2xl">{summary.cashRoas == null ? "—" : `${summary.cashRoas.toFixed(1)}×`}</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground">{euro(summary.campaignSpend)} dépensés → {euro(summary.campaignCash)} encaissés</CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <KpiDataTable data={summary.points} />
      </div>
    </div>
  )
}
