"use client"

import { useState } from "react"
import { BarChart3, ChartNoAxesCombined, Gauge, History, Infinity } from "lucide-react"
import { KpiDashboardOverview } from "@/components/kpi-dashboard-overview"
import { KpiExecutiveOverview } from "@/components/kpi-executive-overview"
import { ValueKpiFunnel } from "@/components/value-kpi-funnel"
import { BusinessKpiDashboard } from "@/components/business-kpi-dashboard"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type View = "lifetime" | "overview" | "funnel" | "history"

const VIEWS: Array<{ id: View; label: string; icon: typeof Gauge }> = [
  { id: "lifetime", label: "Depuis le début", icon: Infinity },
  { id: "overview", label: "Dernier mois", icon: Gauge },
  { id: "funnel", label: "Funnel & économie", icon: ChartNoAxesCombined },
  { id: "history", label: "Mensuel & simulation", icon: History },
]

export function KpiWorkspace({ canEdit }: { canEdit: boolean }) {
  const [view, setView] = useState<View>("lifetime")

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 lg:px-6 lg:pt-6">
        <Card className="inline-flex max-w-full flex-wrap gap-1 p-1 shadow-sm">
          {VIEWS.map(item => {
            const Icon = item.icon
            const active = view === item.id
            return (
              <Button
                key={item.id}
                type="button"
                variant={active ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView(item.id)}
                className={cn("h-9 gap-2", active && "font-bold")}
              >
                <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                {item.label}
              </Button>
            )
          })}
        </Card>
      </div>

      {view === "lifetime" ? <KpiDashboardOverview /> : null}

      {view === "overview" ? (
        <div className="px-4 py-6 lg:px-6"><KpiExecutiveOverview /></div>
      ) : null}

      {view === "funnel" ? (
        <div className="space-y-4 px-4 py-6 lg:px-6">
          <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold"><ChartNoAxesCombined className="h-4 w-4 text-primary" /> Funnel & économie</div>
            <p className="mt-1 text-xs text-muted-foreground">Conversions, unit economics, campagnes et saisie des KPI opérationnels.</p>
          </div>
          <ValueKpiFunnel canEdit={canEdit} />
        </div>
      ) : null}

      {view === "history" ? (
        <div className="space-y-4 px-4 py-6 lg:px-6">
          <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold"><BarChart3 className="h-4 w-4 text-primary" /> Mensuel & simulation</div>
            <p className="mt-1 text-xs text-muted-foreground">Saisie mensuelle, ratios calculés automatiquement et projections à partir des moyennes réelles.</p>
          </div>
          <BusinessKpiDashboard canEdit={canEdit} />
        </div>
      ) : null}
    </div>
  )
}
