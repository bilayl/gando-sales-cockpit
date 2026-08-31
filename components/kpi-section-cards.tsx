import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/kpi-shadcn/ui/badge"
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
    return <span className="text-[10px] text-muted-foreground/60">Pas de comparaison</span>
  }
  const up = value >= 0
  return (
    <Badge
      variant="outline"
      className={
        up
          ? "h-5 gap-0.5 rounded-[5px] border-emerald-200 bg-emerald-50 px-1.5 text-[10px] font-medium text-emerald-700 shadow-none"
          : "h-5 gap-0.5 rounded-[5px] border-rose-200 bg-rose-50 px-1.5 text-[10px] font-medium text-rose-700 shadow-none"
      }
    >
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {up ? "+" : "-"}{percent(Math.abs(value))}
    </Badge>
  )
}

export function KpiSectionCards({ summary }: { summary: KpiDashboardSummary }) {
  const cards = [
    { label: "CA Gando", value: euro(summary.totalRevenue), trend: summary.revenueGrowth, helper: `Take rate ${percent(summary.weightedTakeRate, 2)}` },
    { label: "TDV sécurisé", value: euro(summary.totalTdv), trend: summary.tdvGrowth, helper: `Caution moyenne ${euro(summary.avgDeposit)}` },
    { label: "Cautions", value: integer(summary.totalDeposits), trend: summary.depositGrowth, helper: `${euro(summary.totalDeposits ? summary.totalRevenue / summary.totalDeposits : null, 2)} de CA / caution` },
    { label: "Loueurs actifs", value: integer(summary.currentMau), trend: summary.mauGrowth, helper: `ARPU ${euro(summary.weightedArpu, 2)}` },
  ]

  return (
    <div className="px-4 lg:px-5">
      <div id="kpi-overview-cards" className="grid overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, index) => (
          <section
            key={card.label}
            className={`group min-w-0 px-4 py-4 transition-colors hover:bg-muted/25 ${index > 0 ? "border-t border-border sm:border-l sm:border-t-0" : ""} ${index === 2 ? "sm:border-l-0 sm:border-t xl:border-l xl:border-t-0" : ""}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-[11px] font-medium text-muted-foreground">{card.label}</div>
              <TrendBadge value={card.trend} />
            </div>
            <div className="mt-3 truncate text-[28px] font-semibold leading-none tracking-[-0.035em] text-foreground tabular-nums">
              {card.value}
            </div>
            <div className="mt-3 truncate text-[11px] text-muted-foreground/80">{card.helper}</div>
          </section>
        ))}
      </div>
    </div>
  )
}
