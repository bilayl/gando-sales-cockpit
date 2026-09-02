"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock3, Database } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/kpi-shadcn/ui/progress"
import { KpiChartAreaInteractive } from "@/components/kpi-chart-area-interactive"
import { KpiDataTable } from "@/components/kpi-data-table"
import { KpiSectionCards } from "@/components/kpi-section-cards"
import {
  buildKpiDashboardSummary,
  type CampaignKpiRow,
  type CoreKpiRow,
  type ValueKpiRow,
} from "@/lib/kpi-dashboard"

type DealVelocitySnapshot = {
  source?: "hubspot" | "stored" | string
  retrievedAt?: string | null
  currentMonthKey?: string | null
  currentMonthClosing?: {
    avgClosingDays: number | null
    medianClosingDays: number | null
    closedWonCount: number
  } | null
  currentOpenPipeline?: {
    avgDealAgeDays: number | null
    oldestOpenDealDays: number | null
    openDealsCount: number
    dealsOver40Days: number
  } | null
  error?: string
}

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
function days(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} j`
}
function ratio(top: number, bottom: number) { return bottom > 0 ? top / bottom : null }

function DashboardSkeleton() {
  return (
    <div className="p-4 lg:px-6 lg:py-5">
      <Skeleton className="h-[680px] w-full rounded-xl" />
    </div>
  )
}

export function KpiDashboardOverview() {
  const [coreRows, setCoreRows] = useState<CoreKpiRow[]>([])
  const [valueRows, setValueRows] = useState<ValueKpiRow[]>([])
  const [campaignRows, setCampaignRows] = useState<CampaignKpiRow[]>([])
  const [dealVelocity, setDealVelocity] = useState<DealVelocitySnapshot | null>(null)
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
        setDealVelocity(valueBody.dealVelocity && typeof valueBody.dealVelocity === "object" ? valueBody.dealVelocity : null)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossible de charger le dashboard KPI.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const summary = useMemo(() => buildKpiDashboardSummary(coreRows, valueRows, campaignRows), [coreRows, valueRows, campaignRows])
  if (loading) return <DashboardSkeleton />
  if (error) return <div className="m-4 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive lg:m-6">{error}</div>
  if (!summary) return <div className="p-12 text-center text-xs text-muted-foreground">Aucune donnée KPI disponible.</div>

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
    { label: "Marge nette", value: euro(summary.netMargin), detail: `Taux de marge ${percent(summary.marginRate)}` },
    { label: "ROI cash acquisition", value: percent(summary.cashRoi), detail: `${euro(summary.campaignTotalCost)} de coûts complets · ROAS ${summary.cashRoas == null ? "—" : `${summary.cashRoas.toFixed(1)}×`}` },
  ]

  const closing = dealVelocity?.currentMonthClosing ?? null
  const openPipeline = dealVelocity?.currentOpenPipeline ?? null
  const staleShare = openPipeline && openPipeline.openDealsCount > 0
    ? openPipeline.dealsOver40Days / openPipeline.openDealsCount
    : null
  const dealDurationMetrics = [
    { label: "Closing moyen", value: days(closing?.avgClosingDays), detail: `${integer(closing?.closedWonCount)} deal(s) gagnés ce mois` },
    { label: "Closing médian", value: days(closing?.medianClosingDays), detail: "Moins sensible aux deals très longs" },
    { label: "Âge moyen des deals ouverts", value: days(openPipeline?.avgDealAgeDays), detail: `${integer(openPipeline?.openDealsCount)} deals ouverts` },
    { label: "Plus vieux deal ouvert", value: days(openPipeline?.oldestOpenDealDays), detail: "À challenger en priorité" },
    { label: "Deals > 40 jours", value: integer(openPipeline?.dealsOver40Days), detail: staleShare == null ? "—" : `${percent(staleShare)} du pipeline ouvert` },
  ]
  const velocityUpdatedAt = dealVelocity?.retrievedAt
    ? new Date(dealVelocity.retrievedAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : null

  return (
    <div id="kpi-dashboard" className="min-w-0 p-4 lg:px-6 lg:py-5">
      <Card className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Badge variant="outline" className="h-6 text-[10px] font-semibold">Depuis le début</Badge>
            <span className="truncate text-[11px] text-muted-foreground">{summary.firstLabel} → {summary.lastLabel}</span>
          </div>
          <div className="flex min-w-[220px] items-center gap-2">
            <Database className="size-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Complétude des données</span>
                <span className="font-semibold tabular-nums text-foreground">{percent(coverageAverage, 0)}</span>
              </div>
              <Progress value={coverageAverage * 100} className="h-1" />
            </div>
          </div>
        </div>

        <KpiSectionCards summary={summary} />

        <div className="grid min-w-0 border-b border-border xl:grid-cols-[minmax(0,1.7fr)_340px]">
          <div className="min-w-0 xl:border-r xl:border-border">
            <KpiChartAreaInteractive data={summary.points} />
          </div>
          <section id="kpi-funnel" className="min-w-0 bg-card">
            <div className="border-b border-border px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Conversion</div>
              <div className="mt-0.5 text-sm font-semibold text-foreground">Value funnel</div>
            </div>
            <div>
              {funnel.map((step, index) => (
                <div key={step.label} className={`flex items-center justify-between gap-3 px-4 py-3 ${index ? "border-t border-border" : ""}`}>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-medium text-muted-foreground">{step.label}</div>
                    <div className="mt-0.5 text-lg font-semibold tracking-[-0.02em] tabular-nums">{integer(step.value)}</div>
                  </div>
                  {step.conversion != null ? (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold tabular-nums">{percent(step.conversion)}</Badge>
                  ) : <span className="text-[10px] font-medium text-muted-foreground/50">Entrée</span>}
                </div>
              ))}
            </div>
          </section>
        </div>

        <section id="kpi-finance" className="border-b border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Finance</div>
            <div className="mt-0.5 text-sm font-semibold text-foreground">Cash & efficacité</div>
          </div>
          <div className="grid sm:grid-cols-3">
            {finance.map((item, index) => (
              <div key={item.label} className={`px-4 py-4 ${index ? "border-t border-border sm:border-l sm:border-t-0" : ""}`}>
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">{item.label}</div>
                <div className="mt-2 text-[22px] font-semibold tracking-[-0.03em] tabular-nums">{item.value}</div>
                <div className="mt-1.5 text-[11px] font-medium text-muted-foreground">{item.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="kpi-deal-duration" className="border-b border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Vélocité commerciale</div>
              <div className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Clock3 className="size-3.5 text-muted-foreground" />
                Durée des deals
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={dealVelocity?.source === "hubspot" ? "secondary" : "outline"} className="h-5 px-1.5 text-[10px] font-semibold">
                {dealVelocity?.source === "hubspot" ? "HubSpot live" : "Données enregistrées"}
              </Badge>
              {velocityUpdatedAt ? <span className="text-[10px] text-muted-foreground">Maj {velocityUpdatedAt}</span> : null}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5">
            {dealDurationMetrics.map((item, index) => (
              <div key={item.label} className={`px-4 py-4 ${index ? "border-t border-border sm:border-l sm:border-t-0" : ""} ${index >= 2 ? "sm:border-t lg:border-t-0" : ""}`}>
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">{item.label}</div>
                <div className="mt-2 text-[22px] font-semibold tracking-[-0.03em] tabular-nums">{item.value}</div>
                <div className="mt-1.5 text-[11px] font-medium text-muted-foreground">{item.detail}</div>
              </div>
            ))}
          </div>
          {dealVelocity?.error ? <div className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">HubSpot indisponible : {dealVelocity.error}</div> : null}
        </section>

        <KpiDataTable data={summary.points} />
      </Card>
    </div>
  )
}
