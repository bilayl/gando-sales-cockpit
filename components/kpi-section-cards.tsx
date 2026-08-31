import { ArrowDownRight, ArrowUpRight, Banknote, Building2, ShieldCheck, WalletCards } from "lucide-react"
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

function Trend({ value, suffix = "/ mois" }: { value: number | null; suffix?: string }) {
  if (value == null) return <Badge variant="outline">Pas assez de recul</Badge>
  const up = value >= 0
  return (
    <Badge variant="outline" className={up ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {percent(Math.abs(value))} {suffix}
    </Badge>
  )
}

export function KpiSectionCards({ summary }: { summary: KpiDashboardSummary }) {
  const cards = [
    {
      label: "CA Gando cumulé",
      value: euro(summary.totalRevenue, 0),
      description: `Take rate pondéré ${percent(summary.weightedTakeRate, 2)}`,
      trend: summary.revenueGrowth,
      icon: Banknote,
      coverage: `${summary.coverage.revenue}/${summary.coverage.total} mois renseignés`,
    },
    {
      label: "TDV sécurisé",
      value: euro(summary.totalTdv, 0),
      description: `Caution moyenne ${euro(summary.avgDeposit, 0)}`,
      trend: null,
      icon: WalletCards,
      coverage: `${summary.coverage.tdv}/${summary.coverage.total} mois renseignés`,
    },
    {
      label: "Cautions activées",
      value: integer(summary.totalDeposits),
      description: `${euro(summary.totalDeposits ? summary.totalRevenue / summary.totalDeposits : null, 2)} de CA / caution`,
      trend: summary.depositGrowth,
      icon: ShieldCheck,
      coverage: `${summary.coverage.deposits}/${summary.coverage.total} mois renseignés`,
    },
    {
      label: "Loueurs actifs",
      value: integer(summary.currentMau),
      description: `ARPU pondéré ${euro(summary.weightedArpu, 2)}`,
      trend: null,
      icon: Building2,
      coverage: `${summary.coverage.activeRenters}/${summary.coverage.total} mois renseignés`,
    },
  ]

  return (
    <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {cards.map(card => {
        const Icon = card.icon
        return (
          <Card key={card.label} className="overflow-hidden border-border/80 bg-card shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
              <div className="space-y-1">
                <CardDescription className="text-xs font-semibold">{card.label}</CardDescription>
                <CardTitle className="text-2xl font-bold tracking-[-0.04em]">{card.value}</CardTitle>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex min-h-6 items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{card.description}</span>
                {card.trend != null ? <Trend value={card.trend} /> : null}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">{card.coverage}</div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
