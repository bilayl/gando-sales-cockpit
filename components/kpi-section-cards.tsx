import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/kpi-shadcn/ui/badge"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/kpi-shadcn/ui/card"
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
  if (value == null) return <Badge variant="outline" className="rounded-full">Pas assez de recul</Badge>
  const up = value >= 0
  return (
    <Badge variant="outline" className="rounded-full font-semibold tabular-nums">
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {up ? "+" : "-"}{percent(Math.abs(value))}
    </Badge>
  )
}

function insight(label: string, trend: number | null) {
  if (trend == null) return `${label} : recul insuffisant`
  return trend >= 0 ? `${label} progresse` : `${label} recule`
}

export function KpiSectionCards({ summary }: { summary: KpiDashboardSummary }) {
  const cards = [
    {
      label: "CA Gando cumulé",
      value: euro(summary.totalRevenue),
      trend: summary.revenueGrowth,
      insight: insight("Le revenu", summary.revenueGrowth),
      helper: `Take rate pondéré ${percent(summary.weightedTakeRate, 2)}`,
    },
    {
      label: "TDV sécurisé",
      value: euro(summary.totalTdv),
      trend: summary.tdvGrowth,
      insight: insight("Le volume sécurisé", summary.tdvGrowth),
      helper: `Caution moyenne ${euro(summary.avgDeposit)}`,
    },
    {
      label: "Cautions activées",
      value: integer(summary.totalDeposits),
      trend: summary.depositGrowth,
      insight: insight("L’usage", summary.depositGrowth),
      helper: `${euro(summary.totalDeposits ? summary.totalRevenue / summary.totalDeposits : null, 2)} de CA / caution`,
    },
    {
      label: "Loueurs actifs",
      value: integer(summary.currentMau),
      trend: summary.mauGrowth,
      insight: insight("La base active", summary.mauGrowth),
      helper: `ARPU pondéré ${euro(summary.weightedArpu, 2)}`,
    },
  ]

  return (
    <div id="kpi-overview-cards" className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2">
      {cards.map(card => {
        const up = card.trend != null && card.trend >= 0
        return (
          <Card key={card.label} className="@container/card bg-gradient-to-t from-primary/[0.025] to-card shadow-sm">
            <CardHeader className="grid grid-cols-[1fr_auto] items-start gap-4 pb-5">
              <div className="space-y-3">
                <CardDescription className="text-sm font-medium">{card.label}</CardDescription>
                <CardTitle className="text-3xl font-semibold tracking-tight tabular-nums @[420px]/card:text-4xl">
                  {card.value}
                </CardTitle>
              </div>
              <TrendBadge value={card.trend} />
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 border-t border-border/60 pt-4 text-sm">
              <div className="flex items-center gap-2 font-medium">
                {card.insight}
                {card.trend != null ? up ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" /> : null}
              </div>
              <div className="text-muted-foreground">{card.helper}</div>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
