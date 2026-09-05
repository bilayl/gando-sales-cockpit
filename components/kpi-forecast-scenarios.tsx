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

type ActualRow = { month: string; partial: boolean; cautions: number }
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
type Data = {
  actual: ActualRow[]
  forecast: {
    historyPoints: number
    r2: number
    rmseCautions: number
    confidence: "low" | "medium" | "high"
    next90Days: ForecastRow[]
    currentMonthRunRateCautions: number
  }
  drivers: {
    plusOneMau: { extraCautionsPerMonth: number; extraRevenueCentsPerMonth: number; extraContributionCentsPerMonth: number }
    plusOneCautionPerMau: { extraCautionsPerMonth: number; extraRevenueCentsPerMonth: number; extraContributionCentsPerMonth: number }
  }
  investment: {
    paidScaleReady: boolean
    blockers: string[]
    cacCents: number | null
    paybackMonths: number | null
    priority: { title: string; rationale: string }
  }
  caveats: string[]
}

type TooltipItem = { name?: string; value?: number | string; color?: string }
function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number)
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" }).format(new Date(Date.UTC(year, month - 1, 1)))
}
function euroCents(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: digits }).format(value / 100)
}
function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)
}
function decimal(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(value)
}
function ForecastTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-[145px] rounded-lg border border-border bg-card p-2.5 text-[10px] shadow-lg">
      <div className="mb-1.5 font-bold capitalize">{label ? monthLabel(label) : ""}</div>
      <div className="space-y-1">
        {payload.filter(item => item.value != null).map((item, index) => (
          <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: item.color || "var(--muted-foreground)" }} />{item.name}</span>
            <span className="font-semibold tabular-nums">{integer(Number(item.value))}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const confidenceMeta = {
  low: { label: "Confiance faible", className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200" },
  medium: { label: "Confiance moyenne", className: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-200" },
  high: { label: "Confiance élevée", className: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200" },
}

export function KpiForecastScenarios() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/kpi/decision-intelligence", { cache: "no-store" })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || "Impossible de charger les prévisions.")
        setData(body)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossible de charger les prévisions.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const trajectory = useMemo(() => {
    if (!data) return []
    const actualRows = data.actual.map(row => ({
      month: row.month,
      actual: row.cautions,
      base: row.partial ? data.forecast.currentMonthRunRateCautions : null,
      low: null as number | null,
      high: null as number | null,
    }))
    for (const row of data.forecast.next90Days) {
      actualRows.push({ month: row.month, actual: null as unknown as number, base: row.baseCautions, low: row.lowCautions, high: row.highCautions })
    }
    return actualRows
  }, [data])

  if (loading) return <Skeleton className="h-[760px] w-full rounded-xl" />
  if (error || !data) return <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error || "Prévisions indisponibles"}</div>

  const confidence = confidenceMeta[data.forecast.confidence]
  const next90Cautions = data.forecast.next90Days.reduce((sum, row) => sum + row.baseCautions, 0)
  const next90Revenue = data.forecast.next90Days.reduce((sum, row) => sum + row.revenueCents, 0)
  const next90Contribution = data.forecast.next90Days.reduce((sum, row) => sum + row.contributionCents, 0)
  const next90Tdv = data.forecast.next90Days.reduce((sum, row) => sum + row.tdvCents, 0)

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-primary/20">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-primary/[0.025] px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-primary"><TrendingUp size={13} /> Trajectoire 90 jours</div>
            <div className="mt-1 text-base font-bold">Scénario central basé sur la tendance récente</div>
            <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">Prévision séparée des KPI réels. Elle sert à dimensionner les décisions, pas à remplacer l’historique.</p>
          </div>
          <Badge variant="outline" className={confidence.className}>{confidence.label} · R² {decimal(data.forecast.r2, 2)}</Badge>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4">
          <div className="px-4 py-4"><div className="text-[10px] font-bold uppercase text-muted-foreground">Cautions prévues 90 j</div><div className="mt-2 text-2xl font-semibold tabular-nums">{integer(next90Cautions)}</div></div>
          <div className="border-t border-border px-4 py-4 sm:border-l sm:border-t-0"><div className="text-[10px] font-bold uppercase text-muted-foreground">Garantie prévue</div><div className="mt-2 text-2xl font-semibold tabular-nums">{euroCents(next90Tdv)}</div></div>
          <div className="border-t border-border px-4 py-4 sm:border-l xl:border-t-0"><div className="text-[10px] font-bold uppercase text-muted-foreground">Gross Revenue prévu</div><div className="mt-2 text-2xl font-semibold tabular-nums">{euroCents(next90Revenue)}</div></div>
          <div className="border-t border-border px-4 py-4 sm:border-l xl:border-t-0"><div className="text-[10px] font-bold uppercase text-muted-foreground">Contribution mesurée prévue</div><div className="mt-2 text-2xl font-semibold tabular-nums">{euroCents(next90Contribution)}</div><div className="mt-1 text-[10px] text-muted-foreground">Avant PSP + perte nette Gando.</div></div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground/70">Prévision des cautions</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">Réel jusqu’à aujourd’hui, run-rate du mois en cours, puis scénario bas / central / haut.</div>
        </div>
        <div className="h-[340px] px-2 pb-3 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trajectory} margin={{ top: 6, right: 16, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ForecastTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="actual" name="Réel" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
              <Line type="monotone" dataKey="base" name="Scénario central" stroke="var(--chart-3)" strokeWidth={2.2} strokeDasharray="6 4" dot={{ r: 2.5 }} connectNulls />
              <Line type="monotone" dataKey="low" name="Scénario bas" stroke="var(--chart-5)" strokeWidth={1.3} strokeDasharray="2 5" dot={false} connectNulls />
              <Line type="monotone" dataKey="high" name="Scénario haut" stroke="var(--chart-2)" strokeWidth={1.3} strokeDasharray="2 5" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {data.forecast.next90Days.map(row => (
          <Card key={row.month} className="p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground capitalize">{monthLabel(row.month)}</div>
            <div className="mt-2 text-xl font-semibold tabular-nums">{integer(row.baseCautions)} cautions</div>
            <div className="mt-1 text-[10px] text-muted-foreground">Fourchette {integer(row.lowCautions)}–{integer(row.highCautions)} · {euroCents(row.tdvCents)} garantis</div>
            <div className="mt-2 border-t border-border pt-2 text-[10px] text-muted-foreground">{euroCents(row.revenueCents)} revenu · {euroCents(row.contributionCents)} contribution mesurée · {integer(row.projectedMau)} MAU projetés</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.11em] text-primary"><Target size={13} /> Scénarios de levier</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">Ce qui change la trajectoire si on améliore un levier, sans confondre cela avec une prévision certaine.</div>
        </div>
        <div className="grid md:grid-cols-3">
          <div className="px-4 py-4">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">+1 MAU</div>
            <div className="mt-2 text-xl font-semibold tabular-nums">+{euroCents(data.drivers.plusOneMau.extraContributionCentsPerMonth)} / mois</div>
            <div className="mt-1 text-[10px] text-muted-foreground">≈ +{decimal(data.drivers.plusOneMau.extraCautionsPerMonth)} caution(s) · +{euroCents(data.drivers.plusOneMau.extraRevenueCentsPerMonth)} de revenu.</div>
          </div>
          <div className="border-t border-border px-4 py-4 md:border-l md:border-t-0">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">+1 caution / MAU</div>
            <div className="mt-2 text-xl font-semibold tabular-nums">+{euroCents(data.drivers.plusOneCautionPerMau.extraContributionCentsPerMonth)} / mois</div>
            <div className="mt-1 text-[10px] text-muted-foreground">+{integer(data.drivers.plusOneCautionPerMau.extraCautionsPerMonth)} cautions · +{euroCents(data.drivers.plusOneCautionPerMau.extraRevenueCentsPerMonth)} de revenu.</div>
          </div>
          <div className="border-t border-border px-4 py-4 md:border-l md:border-t-0">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Scale acquisition paid</div>
            <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
              {data.investment.paidScaleReady ? <ArrowUpRight size={18} className="text-emerald-600" /> : <AlertTriangle size={18} className="text-amber-600" />}
              {data.investment.paidScaleReady ? "Pilotable" : "À ne pas scaler encore"}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">{data.investment.cacCents == null ? "CAC actif non mesuré." : `CAC ${euroCents(data.investment.cacCents)} · payback ${decimal(data.investment.paybackMonths)} mois.`}</div>
          </div>
        </div>
      </Card>

      <Card className="border-primary/20 bg-primary/[0.025] px-4 py-3">
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-primary">Décision suggérée</div>
        <div className="mt-1 text-sm font-semibold">{data.investment.priority.title}</div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{data.investment.priority.rationale}</p>
      </Card>

      <div className="rounded-lg border border-border bg-muted/20 px-4 py-2.5 text-[10px] leading-relaxed text-muted-foreground">
        Run-rate du mois : {integer(data.forecast.currentMonthRunRateCautions)} cautions si le rythme actuel se maintient. Modèle basé sur {integer(data.forecast.historyPoints)} mois complets ; erreur historique moyenne ≈ {decimal(data.forecast.rmseCautions)} cautions. {data.caveats.join(" ")}
      </div>
    </div>
  )
}
