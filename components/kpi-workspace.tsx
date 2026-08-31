"use client"

import { ChartNoAxesCombined, Gauge, History, Infinity } from "lucide-react"
import { BusinessKpiDashboard } from "@/components/business-kpi-dashboard"
import { KpiDashboardOverview } from "@/components/kpi-dashboard-overview"
import { KpiExecutiveOverview } from "@/components/kpi-executive-overview"
import { ValueKpiFunnel } from "@/components/value-kpi-funnel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/kpi-shadcn/ui/tabs"

const VIEWS = [
  { id: "lifetime", label: "Depuis le début", icon: Infinity },
  { id: "overview", label: "Dernier mois", icon: Gauge },
  { id: "funnel", label: "Funnel & économie", icon: ChartNoAxesCombined },
  { id: "history", label: "Mensuel & simulation", icon: History },
] as const

const LEGACY_CLEANUP = [
  "[&_.rounded-3xl]:!rounded-xl",
  "[&_.rounded-2xl]:!rounded-xl",
  "[&_.border-slate-200]:!border-border",
  "[&_.bg-white]:!bg-card",
  "[&_.bg-slate-50]:!bg-muted/40",
  "[&_.text-slate-950]:!text-foreground",
  "[&_.text-slate-900]:!text-foreground",
  "[&_.text-slate-600]:!text-muted-foreground",
  "[&_.text-slate-500]:!text-muted-foreground",
  "[&_.text-slate-400]:!text-muted-foreground",
  "[&_.shadow-sm]:!shadow-none",
].join(" ")

export function KpiWorkspace({ canEdit }: { canEdit: boolean }) {
  return (
    <Tabs defaultValue="lifetime" className="flex min-w-0 flex-1 flex-col">
      <div className="sticky top-[var(--header-height,3.5rem)] z-20 border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:px-6">
        <TabsList className="h-9 max-w-full justify-start overflow-x-auto bg-muted/60 p-1">
          {VIEWS.map(item => {
            const Icon = item.icon
            return (
              <TabsTrigger key={item.id} value={item.id} className="h-7 gap-1.5 px-2.5 text-xs">
                <Icon className="size-3.5" />
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
        <div className={LEGACY_CLEANUP}>
          <ValueKpiFunnel canEdit={canEdit} />
        </div>
      </TabsContent>

      <TabsContent value="history" className="m-0 min-w-0 p-4 lg:p-6">
        <div className={LEGACY_CLEANUP}>
          <BusinessKpiDashboard canEdit={canEdit} />
        </div>
      </TabsContent>
    </Tabs>
  )
}
