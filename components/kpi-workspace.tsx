"use client"

import { BarChart3, ChartNoAxesCombined, Gauge, History, Infinity } from "lucide-react"
import { BusinessKpiDashboard } from "@/components/business-kpi-dashboard"
import { KpiDashboardOverview } from "@/components/kpi-dashboard-overview"
import { KpiExecutiveOverview } from "@/components/kpi-executive-overview"
import { ValueKpiFunnel } from "@/components/value-kpi-funnel"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/kpi-shadcn/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/kpi-shadcn/ui/tabs"

const VIEWS = [
  { id: "lifetime", label: "Depuis le début", icon: Infinity },
  { id: "overview", label: "Dernier mois", icon: Gauge },
  { id: "funnel", label: "Funnel & économie", icon: ChartNoAxesCombined },
  { id: "history", label: "Mensuel & simulation", icon: History },
] as const

export function KpiWorkspace({ canEdit }: { canEdit: boolean }) {
  return (
    <Tabs defaultValue="lifetime" className="flex min-w-0 flex-1 flex-col">
      <div className="border-b bg-background px-4 py-3 lg:px-6">
        <TabsList className="h-auto max-w-full justify-start overflow-x-auto bg-muted/60 p-1">
          {VIEWS.map(item => {
            const Icon = item.icon
            return (
              <TabsTrigger key={item.id} value={item.id} className="gap-2 px-3 py-2 text-xs sm:text-sm">
                <Icon className="size-4" />
                {item.label}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </div>

      <TabsContent value="lifetime" className="m-0 min-w-0">
        <KpiDashboardOverview />
      </TabsContent>

      <TabsContent value="overview" className="m-0 min-w-0 p-4 lg:p-6">
        <KpiExecutiveOverview />
      </TabsContent>

      <TabsContent value="funnel" className="m-0 min-w-0 p-4 lg:p-6">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <ChartNoAxesCombined className="size-4 text-primary" />
                <CardTitle className="text-base">Funnel & économie</CardTitle>
              </div>
              <CardDescription>Conversions, unit economics, campagnes et saisie des KPI opérationnels.</CardDescription>
            </CardHeader>
          </Card>
          <ValueKpiFunnel canEdit={canEdit} />
        </div>
      </TabsContent>

      <TabsContent value="history" className="m-0 min-w-0 p-4 lg:p-6">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="size-4 text-primary" />
                <CardTitle className="text-base">Mensuel & simulation</CardTitle>
              </div>
              <CardDescription>Saisie mensuelle, ratios calculés automatiquement et projections à partir des données réelles.</CardDescription>
            </CardHeader>
            <CardContent className="hidden" />
          </Card>
          <BusinessKpiDashboard canEdit={canEdit} />
        </div>
      </TabsContent>
    </Tabs>
  )
}
