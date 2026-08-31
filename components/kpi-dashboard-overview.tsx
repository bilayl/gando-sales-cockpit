"use client"

import { useEffect, useMemo, useState } from "react"
import { Database } from "lucide-react"
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
    <div className="flex flex-col gap-4 py-4">
      <div className="flex items-center justify-between px-4 lg:px-5"><div className="space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-64" /></div><Skeleton className="h-7 w-36" /></div>
      <div className="px-4 lg:px-5"><Skeleton className="h-28 w-full rounded-lg" /></div>
      <div className="grid gap-4 px-4 lg:px-5 @5xl/main:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.65fr)]"><Skeleton className="h-[330px] rounded-lg" /><Skeleton className="h-[330px] rounded-lg" /></div>
      <div className="px-4 lg:px-5"><Skeleton className="h-44 rounded-lg" /></div>
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
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const summary = useMemo(() => buildKpiDashboardSummary(coreRows, valueRows, campaignRows), [coreRows, valueRows, campaignRows])
  if (loading) return <DashboardSkeleton />
  if (error) return <div className="m-4 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-[12px] text-destructive lg:m-5">{error}</div>
  if (!summary) return <div className="p-12 text-center text-[12px] text-muted-foreground">Aucune donnée KPI disponible.</div>

  const coverageDenominator = summary.coverage.total * 4
  const coverageAverage = coverageDenominator > 0
    ? (summary.coverage.revenue + summary.coverage.tdv + summary.coverage.deposits + summary.coverage.activeRenters) / coverageDenominator
    : 0

  const funnel = [
    { label: "Prospects contactés", value: summary.prospects, conversion: null as number | null },
    { label: "Rendez-vous", value: summary.meetings, conversion: ratio(summary.meetings, summary.prospects) },
    { label: "Loueurs activés", value: summary.rentersActivated, conversion: ratio(summary.rentersActivated, summary.meetings) },
    { label: "1re caution", value: summary.firstDepositRenters, conversion: ratio(summary.firstDepositRenters, summary.rentersActivated) },
  ]

  const finance = [
    { label: "Cash collecté", value: euro(summary.cashCollected), detail: `${percent(summary.collectionRate)} du CA signé` },
    { label: "Marge nette", value: euro(summary.netMargin), detail: `Marge ${percent(summary.marginRate)}` },
    { label: "ROAS cash", value: summary.cashRoas == null ? "—" : `${summary.cashRoas.toFixed(1)}×`, detail: `${euro(summary.campaignSpend)} de spend` },
  ]

  return (
    <div id="kpi-dashboard" className="flex min-w-0 flex-col gap-4 py-4">
      <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between lg:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-[17px] font-semibold tracking-[-0.02em]">Vue d’ensemble</h1>
            <Badge variant="outline" className="h-5 rounded-[5px] px-1.5 text-[10px] font-normal text-muted-foreground shadow-none">{summary.firstLabel} → {summary.lastLabel}</Badge>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Les principaux drivers business de Gando, depuis le début de l’activité.</p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-[225px]">
          <Database className="size-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground"><span>Qualité des données</span><span className="font-medium tabular-nums text-foreground">{percent(coverageAverage, 0)}</span></div>
            <Progress value={coverageAverage * 100} className="h-1" />
          </div>
        </div>
      </div>

      <KpiSectionCards summary={summary} />

      <div className="grid min-w-0 gap-4 px-4 lg:px-5 @5xl/main:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.65fr)]">
        <KpiChartAreaInteractive data={summary.points} />

        <Card id="kpi-funnel" className="overflow-hidden rounded-lg border-border shadow-none">
          <CardHeader className="space-y-0.5 border-b border-border px-4 py-3">
            <CardTitle className="text-[13px] font-medium">Value funnel</CardTitle>
            <CardDescription className="text-[11px]">Du prospect à la première caution.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {funnel.map((step, index) => (
              <div key={step.label} className={`flex items-center justify-between gap-3 px-4 py-3 ${index ? "border-t border-border" : ""}`}>
                <div className="min-w-0">
                  <div className="truncate text-[11px] text-muted-foreground">{step.label}</div>
                  <div className="mt-0.5 text-[18px] font-semibold tracking-[-0.02em] tabular-nums">{integer(step.value)}</div>
                </div>
                {step.conversion != null ? (
                  <Badge variant="secondary" className="h-5 rounded-[5px] px-1.5 text-[10px] font-medium tabular-nums shadow-none">{percent(step.conversion)}</Badge>
                ) : <span className="text-[10px] text-muted-foreground/45">Entrée</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div id="kpi-finance" className="px-4 lg:px-5">
        <Card className="overflow-hidden rounded-lg border-border shadow-none">
          <CardHeader className="space-y-0.5 border-b border-border px-4 py-3">
            <CardTitle className="text-[13px] font-medium">Finance & efficacité</CardTitle>
            <CardDescription className="text-[11px]">Cash, marge et efficacité des campagnes consolidés.</CardDescription>
          </CardHeader>
          <CardContent className="grid p-0 sm:grid-cols-3">
            {finance.map((item, index) => (
              <div key={item.label} className={`px-4 py-4 ${index ? "border-t border-border sm:border-l sm:border-t-0" : ""}`}>
                <div className="text-[11px] text-muted-foreground">{item.label}</div>
                <div className="mt-2 text-[22px] font-semibold tracking-[-0.03em] tabular-nums">{item.value}</div>
                <div className="mt-1.5 text-[10px] text-muted-foreground/75">{item.detail}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-5">
        <KpiDataTable data={summary.points} />
      </div>
    </div>
  )
}
