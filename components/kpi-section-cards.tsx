import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/kpi-shadcn/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/kpi-shadcn/ui/card"
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
  if (value == null) {
    return <Badge variant="outline" className="h-6 rounded-md px-2 text-[11px] font-medium text-muted-foreground">—</Badge>
  }
  const up = value >= 0
  return (
    <Badge variant="outline" className="h-6 gap-1 rounded-md px-2 text-[11px] font-medium tabular-nums">
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {up ? "+" : "-"}{percent(Math.abs(value))}
    </Badge>
  )
}

export function KpiSectionCards({ summary }: { summary: KpiDashboardSummary }) {
  const cards = [
    { label: "CA Gando cumulé", value: euro(summary.totalRevenue), trend: summary.revenueGrowth, helper: `Take rate ${percent(summary.weightedTakeRate, 2)}` },
    { label: "TDV sécurisé", value: euro(summary.totalTdv), trend: summary.tdvGrowth, helper: `Caution moyenne ${euro(summary.avgDeposit)}` },
    { label: "Cautions activées", value: integer(summary.totalDeposits), trend: summary.depositGrowth, helper: `${euro(summary.totalDeposits ? summary.totalRevenue / summary.totalDeposits : null, 2)} / caution` },
    { label: "Loueurs actifs", value: integer(summary.currentMau), trend: summary.mauGrowth, helper: `ARPU ${euro(summary.weightedArpu, 2)}` },
  ]

  return (
    <div id="kpi-overview-cards" className="grid gap-4 px-4 sm:grid-cols-2 lg:px-6 xl:grid-cols-4">
      {cards.map(card => (
        <Card key={card.label} className="shadow-sm">
          <CardHeader className="space-y-0 pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardDescription className="truncate text-xs font-medium">{card.label}</CardDescription>
              <TrendBadge value={card.trend} />
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{card.value}</CardTitle>
            <p className="mt-2 text-xs text-muted-foreground">{card.helper}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
