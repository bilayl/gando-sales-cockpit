"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AlertTriangle, ArrowUpRight, Target, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type ActualRow = {
  month: string
  partial: boolean
  cautions: number
  tdvCents: number
  revenueCents: number
  insuranceCostCents: number
  partnerCostCents: number
  contributionCents: number
  lossProxyCents: number
  mau: number
  cautionsPerMau: number | null
  revenuePerCautionCents: number | null
  contributionPerCautionCents: number | null
  retentionRate: number | null
}

type ForecastRow = {
  month: string
  baseCautions: number
  lowCautions: number
  highCautions: number
  tdvCents: number
  revenueCents: number
  contributionCents: number
  projectedMau: number | null
}

type Intelligence = {
  actual: ActualRow[]
  forecast: {
    method: string
    historyPoints: number
    r2: number
    rmseCautions: number
    confidence: "low" | "medium" | "high"
    next90Days: ForecastRow[]
    currentMonthRunRateCautions: number
    trailing: {
      avgTdvPerCautionCents: number
      avgRevenuePerCautionCents: number
      measuredContributionPerCautionCents: number
      cautionsPerMau: number
      partnerYield: number
      insuranceRateBps: number
    }
  }
  drivers: {
    usageReference: number
    plusOneMau: {
      extraCautionsPerMonth: number
      extraRevenueCentsPerMonth: number
      extraContributionCentsPerMonth: number
    }
    plusOneCautionPerMau: {
      extraCautionsPerMonth: number
      extraRevenueCentsPerMonth: number
      extraContributionCentsPerMonth: number
    }
  }
  investment: {
    paidScaleReady: boolean
    blockers: string[]
    cacCents: number | null
    acquiredRentersLast3CompletedMonths: number
    acquisitionCostCentsLast3CompletedMonths: number
    measuredContributionPerMauCents: number
    paybackMonths: number | null
    priority: { code: string; title: string; rationale: string }
  }
  caveats: string[]
}

type TooltipPayload = { name?: string; value?: number | string; dataKey?: string; color?: string }
type TooltipProps = { active?: boolean; payload?: TooltipPayload[]; label?: string; valueFormatter?: (value: number, dataKey?: string) => string }

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number)
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" }).format(new Date(Date.UTC(year, month - 1, 1)))
}
function euroCents(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: digits }).format(value / 100)
}
function euro(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: digits }).format(value)
}
function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)
}
function decimal(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(value)
}
function percent(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: digits }).format(value)
}

function ChartTooltip({ active, payload, label, valueFormatter }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-[150px] rounded-lg border border-border bg-card p-2.5 text-[10px] shadow-lg">
      <div className="mb-1.5 font-bold capitalize">{label ? monthLabel(label) : ""}</div>
      <div className="space-y-1">
        {payload.filter(item => item.value != null).map((item, index) => {
          const numeric = Number(item.value)
          return (
            <div key={`${item.dataKey || item.name}-${index}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: item.color || "var(--muted-foreground)" }} />
                {item.name}
              </span>
              <span className="font-semibold tabular-nums">
                {Number.isFinite(numeric) ? (valueFormatter ? valueFormatter(numeric, item.dataKey) : decimal(numeric)) : item.value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground/70">{title}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</div>
      </div>
      <div className="h-[280px] px-2 pb-3 pt-4">{children}</div>
    </Card>
  )
}

const confidenceMeta = {
  low: { label: "Confiance faible", className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200" },
  medium: { label: "Confiance moyenne", className: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-200" },
  high: { label: "Confiance élevée", className: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200" },
}

export function KpiDecisionIntelligence({ variant = "ceo" }: { variant?: "ceo" | "growth" | "economics" }) {
  const [data, setData] = useState<Intelligence | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/kpi/decision-intelligence", { cache: "no-store" })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || "Impossible de charger les tendances KPI.")
        setData(body)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossible de charger les tendances KPI.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const trajectory = useMemo(() => {
    if (!data) return []
    const rows = data.actual.map(row => ({
      month: row.month,
      actual: row.cautions,
      forecast: row.partial ? data.forecast.currentMonthRunRateCautions : null,
      low: null as number | null,
      high: null as number | null,
      partial: row.partial,
    }))
    for (const row of data.forecast.next90Days) {
      rows.push({ month: row.month, actual: null as unknown as number, forecast: row.baseCautions, low: row.lowCautions, high: row.highCautions, partial: false })
    }
    return rows
  }, [data])

  if (loading) return <Skeleton className="h-[620px] w-full rounded-xl" />
  if (error || !data) return <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error || "Tendances indisponibles"}</div>

  const confidence = confidenceMeta[data.forecast.confidence]
  const next90 = data.forecast.next90Days.reduce((sum, row) => sum + row.baseCautions, 0)
  const next90Revenue = data.forecast.next90Days.reduce((sum, row) => sum + row.revenueCents, 0)
  const next90Contribution = data.forecast.next90Days.reduce((sum, row) => sum + row.contributionCents, 0)
  const latestActual = data.actual.at(-1)

  const trajectoryChart = (
    <ChartCard title="Trajectoire des cautions" subtitle="Historique réel + run-rate du mois + tendance 90 jours calculée sur les 6 derniers mois complets.">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trajectory} margin={{ top: 6, right: 16, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line type="monotone" dataKey="actual" name="Cautions réelles" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
          <Line type="monotone" dataKey="forecast" name="Prévision / run-rate" stroke="var(--chart-3)" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 2.5 }} connectNulls />
          <Line type="monotone" dataKey="low" name="Scénario bas" stroke="var(--chart-5)" strokeWidth={1} strokeDasharray="2 5" dot={false} connectNulls />
          <Line type="monotone" dataKey="high" name="Scénario haut" stroke="var(--chart-2)" strokeWidth={1} strokeDasharray="2 5" dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )

  const usageChart = (
    <ChartCard title="MAU × fréquence" subtitle="Le moteur produit : plus de loueurs actifs et plus de cautions par loueur.">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.actual} margin={{ top: 6, right: 2, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line yAxisId="left" type="monotone" dataKey="mau" name="MAU" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 2.5 }} />
          <Line yAxisId="right" type="monotone" dataKey="cautionsPerMau" name="Cautions / MAU" stroke="var(--chart-4)" strokeWidth={2} dot={{ r: 2.5 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )

  const economicsChart = (
    <ChartCard title="Revenu & contribution" subtitle="La contribution reste mesurée avant PSP et perte nette finale tant que ces coûts ne sont pas reliés.">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.actual.map(row => ({ ...row, revenueEuro: row.revenueCents / 100, contributionEuro: row.contributionCents / 100 }))} margin={{ top: 6, right: 16, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={value => `${Math.round(Number(value))}€`} />
          <Tooltip content={<ChartTooltip valueFormatter={value => euro(value)} />} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line type="monotone" dataKey="revenueEuro" name="Gross Revenue" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 2.5 }} />
          <Line type="monotone" dataKey="contributionEuro" name="Contribution mesurée" stroke="var(--chart-3)" strokeWidth={2.5} dot={{ r: 2.5 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )

  const retentionChart = (
    <ChartCard title="Rétention des loueurs actifs" subtitle="Part des MAU du mois précédent qui réactivent au moins une caution le mois suivant.">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.actual.map(row => ({ ...row, retentionPct: row.retentionRate == null ? null : row.retentionRate * 100 }))} margin={{ top: 6, right: 16, bottom: 0, left: -10 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={value => `${value}%`} />
          <Tooltip content={<ChartTooltip valueFormatter={value => `${decimal(value, 0)} %`} />} />
          <Line type="monotone" dataKey="retentionPct" name="Rétention M+1" stroke="var(--chart-5)" strokeWidth={2.5} dot={{ r: 2.5 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )

  if (variant === "growth") {
    return (
      <div className="grid gap-5 xl:grid-cols-2">
        {trajectoryChart}
        {usageChart}
        {retentionChart}
      </div>
    )
  }

  if (variant === "economics") {
    return (
      <div className="space-y-5">
        {economicsChart}
        <Card className="grid overflow-hidden sm:grid-cols-3">
          <div className="px-4 py-4">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Revenu / caution récent</div>
            <div className="mt-2 text-xl font-semibold tabular-nums">{euroCents(data.forecast.trailing.avgRevenuePerCautionCents, 2)}</div>
          </div>
          <div className="border-t border-border px-4 py-4 sm:border-l sm:border-t-0">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Contribution / caution future</div>
            <div className="mt-2 text-xl font-semibold tabular-nums">{euroCents(data.forecast.trailing.measuredContributionPerCautionCents, 2)}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">Après assurance + partenaires, avant PSP + perte nette.</div>
          </div>
          <div className="border-t border-border px-4 py-4 sm:border-l sm:border-t-0">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Garantie moyenne récente</div>
            <div className="mt-2 text-xl font-semibold tabular-nums">{euroCents(data.forecast.trailing.avgTdvPerCautionCents, 0)}</div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-primary/20">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-primary/[0.025] px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-primary"><Target size={13} /> Allocation du prochain euro</div>
            <div className="mt-1 text-base font-bold">{data.investment.priority.title}</div>
            <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">{data.investment.priority.rationale}</p>
          </div>
          <Badge variant="outline" className={confidence.className}>{confidence.label} · R² {decimal(data.forecast.r2, 2)}</Badge>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4">
          <div className="px-4 py-4">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground"><TrendingUp size={12} /> 90 jours</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{integer(next90)} cautions</div>
            <div className="mt-1 text-[10px] text-muted-foreground">≈ {euroCents(next90Revenue)} de revenu · {euroCents(next90Contribution)} de contribution mesurée</div>
          </div>
          <div className="border-t border-border px-4 py-4 sm:border-l sm:border-t-0">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Valeur de +1 MAU</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">+{euroCents(data.drivers.plusOneMau.extraContributionCentsPerMonth)} / mois</div>
            <div className="mt-1 text-[10px] text-muted-foreground">≈ +{decimal(data.drivers.plusOneMau.extraCautionsPerMonth)} caution(s) / mois au rythme récent</div>
          </div>
          <div className="border-t border-border px-4 py-4 sm:border-l xl:border-t-0">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Valeur de +1 caution / MAU</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">+{euroCents(data.drivers.plusOneCautionPerMau.extraContributionCentsPerMonth)} / mois</div>
            <div className="mt-1 text-[10px] text-muted-foreground">+{integer(data.drivers.plusOneCautionPerMau.extraCautionsPerMonth)} cautions au niveau de MAU actuel</div>
          </div>
          <div className="border-t border-border px-4 py-4 sm:border-l xl:border-t-0">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Acquisition paid</div>
            <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
              {data.investment.paidScaleReady ? <ArrowUpRight size={18} className="text-emerald-600" /> : <AlertTriangle size={18} className="text-amber-600" />}
              {data.investment.paidScaleReady ? "Scalable" : "Pas encore pilotable"}
            </div>
            <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              {data.investment.cacCents == null ? "CAC actif non mesuré." : `CAC ${euroCents(data.investment.cacCents)} · payback ${decimal(data.investment.paybackMonths)} mois.`}
            </div>
          </div>
        </div>

        {!data.investment.paidScaleReady ? (
          <div className="border-t border-border bg-amber-50/60 px-4 py-2.5 text-[10px] text-amber-900 dark:bg-amber-950/15 dark:text-amber-200">
            <span className="font-bold">Avant d’augmenter fortement un budget paid :</span> {data.investment.blockers.join(" · ")}.
          </div>
        ) : null}
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        {trajectoryChart}
        {usageChart}
        {economicsChart}
        {retentionChart}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {data.forecast.next90Days.map(row => (
          <Card key={row.month} className="p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground capitalize">Prévision {monthLabel(row.month)}</div>
            <div className="mt-2 text-xl font-semibold tabular-nums">{integer(row.baseCautions)} cautions</div>
            <div className="mt-1 text-[10px] text-muted-foreground">Fourchette {integer(row.lowCautions)}–{integer(row.highCautions)} · {euroCents(row.tdvCents)} garantis</div>
            <div className="mt-2 border-t border-border pt-2 text-[10px] text-muted-foreground">{euroCents(row.revenueCents)} revenu · {euroCents(row.contributionCents)} contribution mesurée</div>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-muted/20 px-4 py-2.5 text-[10px] leading-relaxed text-muted-foreground">
        Run-rate du mois actuel : {integer(data.forecast.currentMonthRunRateCautions)} cautions si le rythme quotidien se maintient. Prévision 90 jours calculée sur les {integer(data.forecast.historyPoints)} derniers mois complets ; erreur historique moyenne ≈ {decimal(data.forecast.rmseCautions)} cautions. {latestActual?.partial ? "Le mois actuel est volontairement exclu de la régression." : ""}
      </div>
    </div>
  )
}
