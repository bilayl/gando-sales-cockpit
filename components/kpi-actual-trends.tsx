"use client"

import { useEffect, useState } from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type Row = {
  month: string
  partial: boolean
  cautions: number
  tdvCents: number
  revenueCents: number
  contributionCents: number
  lossProxyCents: number
  mau: number
  cautionsPerMau: number | null
  revenuePerCautionCents: number | null
  contributionPerCautionCents: number | null
  retentionRate: number | null
}

type Data = { actual: Row[]; drivers: { usageReference: number } }

type TooltipItem = { name?: string; value?: number | string; color?: string }

type TooltipProps = {
  active?: boolean
  payload?: TooltipItem[]
  label?: string
  formatter?: (value: number) => string
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number)
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" }).format(new Date(Date.UTC(year, month - 1, 1)))
}
function euro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value)
}
function decimal(value: number, digits = 1) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(value)
}
function ActualTooltip({ active, payload, label, formatter }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-[145px] rounded-lg border border-border bg-card p-2.5 text-[10px] shadow-lg">
      <div className="mb-1.5 font-bold capitalize">{label ? monthLabel(label) : ""}</div>
      <div className="space-y-1">
        {payload.filter(item => item.value != null).map((item, index) => {
          const value = Number(item.value)
          return (
            <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: item.color || "var(--muted-foreground)" }} />
                {item.name}
              </span>
              <span className="font-semibold tabular-nums">{Number.isFinite(value) ? (formatter ? formatter(value) : decimal(value)) : item.value}</span>
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
      <div className="h-[275px] px-2 pb-3 pt-4">{children}</div>
    </Card>
  )
}

export function KpiActualTrends({ variant }: { variant: "growth" | "economics" }) {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/kpi/decision-intelligence", { cache: "no-store" })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || "Impossible de charger les tendances.")
        setData(body)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossible de charger les tendances.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <Skeleton className="h-[580px] w-full rounded-xl" />
  if (error || !data) return <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error || "Tendances indisponibles"}</div>

  const actual = data.actual.map(row => ({
    ...row,
    retentionPct: row.retentionRate == null ? null : row.retentionRate * 100,
    revenueEuro: row.revenueCents / 100,
    contributionEuro: row.contributionCents / 100,
    revenuePerCautionEuro: row.revenuePerCautionCents == null ? null : row.revenuePerCautionCents / 100,
    contributionPerCautionEuro: row.contributionPerCautionCents == null ? null : row.contributionPerCautionCents / 100,
    lossRatePct: row.tdvCents > 0 ? row.lossProxyCents / row.tdvCents * 100 : null,
  }))

  if (variant === "growth") {
    return (
      <div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-2">
          <ChartCard title="Cautions & MAU" subtitle="Historique réel uniquement : volume d’usage et nombre de loueurs actifs mois par mois.">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={actual} margin={{ top: 6, right: 10, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ActualTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="cautions" name="Cautions" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 2.5 }} />
                <Line type="monotone" dataKey="mau" name="MAU" stroke="var(--chart-3)" strokeWidth={2.2} dot={{ r: 2.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Fréquence d’usage" subtitle={`Cautions par MAU. Repère cockpit : ${decimal(data.drivers.usageReference, 1)}.`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={actual} margin={{ top: 6, right: 10, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ActualTooltip />} />
                <ReferenceLine y={data.drivers.usageReference} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="cautionsPerMau" name="Cautions / MAU" stroke="var(--chart-4)" strokeWidth={2.5} dot={{ r: 2.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard title="Rétention M+1 des loueurs actifs" subtitle="Part des MAU de M-1 qui réalisent à nouveau au moins une caution le mois suivant.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={actual} margin={{ top: 6, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tickFormatter={value => `${value}%`} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ActualTooltip formatter={value => `${decimal(value, 0)} %`} />} />
              <Line type="monotone" dataKey="retentionPct" name="Rétention M+1" stroke="var(--chart-5)" strokeWidth={2.5} dot={{ r: 2.5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Gross Revenue & contribution" subtitle="Historique réel. Contribution mesurée après assurance et partenaires, avant PSP et perte nette Gando.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={actual} margin={{ top: 6, right: 16, bottom: 0, left: -4 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={value => `${Math.round(Number(value))}€`} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ActualTooltip formatter={value => euro(value)} />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="revenueEuro" name="Gross Revenue" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 2.5 }} />
              <Line type="monotone" dataKey="contributionEuro" name="Contribution mesurée" stroke="var(--chart-3)" strokeWidth={2.5} dot={{ r: 2.5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Économie unitaire réelle" subtitle="Revenu et contribution mesurée par caution, mois par mois.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={actual} margin={{ top: 6, right: 16, bottom: 0, left: -4 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={value => `${Math.round(Number(value))}€`} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ActualTooltip formatter={value => euro(value)} />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="revenuePerCautionEuro" name="Revenu / caution" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 2.5 }} />
              <Line type="monotone" dataKey="contributionPerCautionEuro" name="Contribution / caution" stroke="var(--chart-3)" strokeWidth={2.5} dot={{ r: 2.5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Risque mensuel — proxy actuel" subtitle="Garanties Gando activées rapportées au volume garanti du mois. À remplacer par la perte nette Gando après recouvrement et indemnisation éventuelle.">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={actual} margin={{ top: 6, right: 16, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={value => `${decimal(Number(value), 1)}%`} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <Tooltip content={<ActualTooltip formatter={value => `${decimal(value, 2)} %`} />} />
            <ReferenceLine y={1.7} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="lossRatePct" name="Loss Rate proxy" stroke="var(--chart-4)" strokeWidth={2.5} dot={{ r: 2.5 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
