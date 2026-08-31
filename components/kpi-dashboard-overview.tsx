"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CheckCircle2, CircleDollarSign, Database, Target, UsersRound } from "lucide-react"
import { Badge } from "@/components/kpi-shadcn/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/kpi-shadcn/ui/card"
import { Progress } from "@/components/kpi-shadcn/ui/progress"
import { Skeleton } from "@/components/kpi-shadcn/ui/skeleton"
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
function ratio(top: number, bottom: number) { return bottom > 0 ? top / bottom : null }

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 py-6">
      <div className="space-y-2 px-4 lg:px-6"><Skeleton className="h-4 w-28" /><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-full max-w-xl" /></div>
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2">{[0, 1, 2, 3].map(item => <Skeleton key={item} className="h-44 rounded-xl" />)}</div>
      <div className="grid gap-4 px-4 lg:px-6 @5xl/main:grid-cols-[minmax(0,1.6fr)_360px]"><Skeleton className="h-[420px] rounded-xl" /><Skeleton className="h-[420px] rounded-xl" /></div>
    </div>
  )
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
        const [coreBody, valueBody, campaignBody] = await Promise.all([coreResponse.json(), valueResponse.json(), campaignResponse.json()])
        if (!coreResponse.ok) throw new Error(coreBody.error || "Impossible de charger les KPI.")
        if (!valueResponse.ok) throw new Error(valueBody.error || "Impossible de charger le funnel.")
        if (!campaignResponse.ok) throw new Error(campaignBody.error || "Impossible de charger les campagnes.")
        setCoreRows(Array.isArray(coreBody.rows) ? coreBody.rows : [])
        setValueRows(Array.isArray(valueBody.rows) ? valueBody.rows : [])
        setCampaignRows(Array.isArray(campaignBody.rows) ? campaignBody.rows : [])
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossible de charger le dashboard KPI.")
      } finally { setLoading(false) }
    })()
  }, [])

  const summary = useMemo(() => buildKpiDashboardSummary(coreRows, valueRows, campaignRows), [coreRows, valueRows, campaignRows])
  if (loading) return <DashboardSkeleton />
  if (error) return <div className="m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive lg:m-6">{error}</div>
  if (!summary) return <div className="p-12 text-center text-sm text-muted-foreground">Aucune donnée KPI disponible.</div>

  const coverageAverage = (summary.coverage.revenue + summary.coverage.tdv + summary.coverage.deposits + summary.coverage.activeRenters) / (summary.coverage.total * 4)

  return (
    <div id="kpi-dashboard" className="flex min-w-0 scroll-mt-20 flex-col gap-6 py-6">
      <div className="flex flex-col gap-4 px-4 lg:px-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">Depuis le début</Badge><span className="text-xs text-muted-foreground">{summary.firstLabel} → {summary.lastLabel}</span></div>
          <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pilotage business Gando</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Volume, usage, revenu, cash et conversion dans une seule lecture.</p></div>
        </div>
        <Card className="w-full shadow-none md:w-72">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 font-medium"><Database className="size-3.5 text-primary" /> Qualité des données</span><span className="font-mono tabular-nums">{percent(coverageAverage, 0)}</span></div>
            <Progress value={coverageAverage * 100} className="h-1.5" />
            <p className="text-[11px] text-muted-foreground">Complétude moyenne des métriques clés sur {summary.spanMonths} mois.</p>
          </CardContent>
        </Card>
      </div>

      <KpiSectionCards summary={summary} />

      <div className="grid min-w-0 gap-4 px-4 lg:px-6 @5xl/main:grid-cols-[minmax(0,1.6fr)_360px]">
        <KpiChartAreaInteractive data={summary.points} />
        <Card id="kpi-funnel" className="scroll-mt-20 shadow-sm">
          <CardHeader className="border-b"><CardTitle className="text-base">Value funnel</CardTitle><CardDescription>Du prospect à la première caution activée.</CardDescription></CardHeader>
          <CardContent className="space-y-1 pt-4">
            {[
              { label: "Prospects contactés", value: summary.prospects, next: ratio(summary.meetings, summary.prospects), icon: UsersRound },
              { label: "Rendez-vous", value: summary.meetings, next: ratio(summary.rentersActivated, summary.meetings), icon: Target },
              { label: "Loueurs activés", value: summary.rentersActivated, next: ratio(summary.firstDepositRenters, summary.rentersActivated), icon: CheckCircle2 },
              { label: "1re caution", value: summary.firstDepositRenters, next: null, icon: CircleDollarSign },
            ].map((step, index, all) => {
              const Icon = step.icon
              return <div key={step.label} className="relative flex gap-3 rounded-lg px-2 py-3 hover:bg-muted/50"><div className="grid size-9 shrink-0 place-items-center rounded-md border bg-background"><Icon className="size-4 text-primary" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><div className="text-xs text-muted-foreground">{step.label}</div><div className="mt-0.5 text-xl font-semibold tabular-nums">{integer(step.value)}</div></div>{step.next != null ? <Badge variant="secondary" className="font-mono tabular-nums">{percent(step.next)}</Badge> : null}</div>{index < all.length - 1 ? <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground"><ArrowRight className="size-3" /> conversion vers l’étape suivante</div> : null}</div></div>
            })}
          </CardContent>
        </Card>
      </div>

      <div id="kpi-finance" className="grid scroll-mt-20 gap-4 px-4 lg:px-6 @3xl/main:grid-cols-3">
        {[
          { label: "Cash collecté", value: euro(summary.cashCollected), detail: `${percent(summary.collectionRate)} du CA signé · ${euro(summary.signedRevenue)} signé` },
          { label: "Marge nette", value: euro(summary.netMargin), detail: `Taux de marge consolidé ${percent(summary.marginRate)}` },
          { label: "ROAS cash", value: summary.cashRoas == null ? "—" : `${summary.cashRoas.toFixed(1)}×`, detail: `${euro(summary.campaignSpend)} dépensés → ${euro(summary.campaignCash)} encaissés` },
        ].map(item => <Card key={item.label} className="shadow-sm"><CardHeader className="pb-3"><CardDescription>{item.label}</CardDescription><CardTitle className="text-2xl tabular-nums">{item.value}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{item.detail}</CardContent></Card>)}
      </div>

      <div className="px-4 lg:px-6"><KpiDataTable data={summary.points} /></div>
    </div>
  )
}
