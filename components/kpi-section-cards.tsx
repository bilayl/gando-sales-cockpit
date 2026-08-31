import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { KpiDashboardSummary } from "@/lib/kpi-dashboard"

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

function TrendBadge({ value }: { value: number | null }) {
  if (value == null) return <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">—</Badge>
  const up = value >= 0
  return (
    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-bold">
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {up ? "+" : "-"}{percent(Math.abs(value))}
    </Badge>
  )
}

function insight(label: string, trend: number | null) {
  if (trend == null) return { title: `${label} à suivre`, detail: "Pas encore assez de recul pour calculer une tendance fiable." }
  if (trend >= 0) return { title: `${label} en progression`, detail: "La dynamique est positive sur la période observée." }
  return { title: `${label} en recul`, detail: "La variation mérite une lecture détaillée dans le dashboard." }
}

export function KpiSectionCards({ summary }: { summary: KpiDashboardSummary }) {
  const cards = [
    {
      label: "CA Gando cumulé",
      value: euro(summary.totalRevenue, 0),
      trend: summary.revenueGrowth,
      helper: `Take rate pondéré ${percent(summary.weightedTakeRate, 2)}`,
      insight: insight("Le revenu", summary.revenueGrowth),
    },
    {
      label: "TDV sécurisé",
      value: euro(summary.totalTdv, 0),
      trend: summary.tdvGrowth,
      helper: `Caution moyenne ${euro(summary.avgDeposit, 0)}`,
      insight: insight("Le volume sécurisé", summary.tdvGrowth),
    },
    {
      label: "Cautions activées",
      value: integer(summary.totalDeposits),
      trend: summary.depositGrowth,
      helper: `${euro(summary.totalDeposits ? summary.totalRevenue / summary.totalDeposits : null, 2)} de CA / caution`,
      insight: insight("L’usage", summary.depositGrowth),
    },
    {
      label: "Loueurs actifs",
      value: integer(summary.currentMau),
      trend: summary.mauGrowth,
      helper: `ARPU pondéré ${euro(summary.weightedArpu, 2)}`,
      insight: insight("La base active", summary.mauGrowth),
    },
  ]

  return (
    <div id="kpi-overview-cards" className="grid gap-4 px-4 lg:px-6 @2xl/main:grid-cols-2">
      {cards.map(card => (
        <Card key={card.label} className="min-h-[250px] rounded-[22px] border-border/80 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 px-7 pb-0 pt-7">
            <CardDescription className="text-base font-medium text-muted-foreground">{card.label}</CardDescription>
            <TrendBadge value={card.trend} />
          </CardHeader>
          <CardContent className="flex h-[190px] flex-col justify-between px-7 pb-7 pt-3">
            <CardTitle className="text-4xl font-bold tracking-[-0.055em] sm:text-5xl">{card.value}</CardTitle>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-bold sm:text-base">
                {card.insight.title}
                {card.trend != null ? card.trend >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" /> : null}
              </div>
              <div className="text-sm text-muted-foreground">{card.helper}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
