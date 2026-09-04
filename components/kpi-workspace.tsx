"use client"

import { KpiAcquisitionControl } from "@/components/kpi-acquisition-control"
import { KpiAcquisitionExperiment } from "@/components/kpi-acquisition-experiment"
import { KpiDashboardOverview } from "@/components/kpi-dashboard-overview"
import { KpiExecutiveOverview } from "@/components/kpi-executive-overview"
import { KpiMonthlyShadcn } from "@/components/kpi-monthly-shadcn"
import type { KpiView } from "@/lib/kpi-views"

export function KpiWorkspace({ view, canEdit }: { view: KpiView; canEdit: boolean }) {
  if (view === "overview") {
    return <div className="min-w-0 p-4 lg:px-6 lg:py-5"><KpiExecutiveOverview /></div>
  }

  if (view === "funnel") {
    return <div className="min-w-0 p-4 lg:px-6 lg:py-5">
      <div className="space-y-5">
        <KpiAcquisitionExperiment canEdit={canEdit} />
        <KpiAcquisitionControl canEdit={canEdit} />
      </div>
    </div>
  }

  if (view === "history") {
    return <div className="min-w-0 p-4 lg:px-6 lg:py-5"><KpiMonthlyShadcn canEdit={canEdit} /></div>
  }

  return <div className="min-w-0"><KpiDashboardOverview /></div>
}
