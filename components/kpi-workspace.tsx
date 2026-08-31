"use client"

import { KpiDashboardOverview } from "@/components/kpi-dashboard-overview"
import { KpiExecutiveOverview } from "@/components/kpi-executive-overview"
import { KpiFunnelShadcn } from "@/components/kpi-funnel-shadcn"
import { KpiMonthlyShadcn } from "@/components/kpi-monthly-shadcn"
import type { KpiView } from "@/lib/kpi-views"

export function KpiWorkspace({ view, canEdit }: { view: KpiView; canEdit: boolean }) {
  if (view === "overview") {
    return <div className="min-w-0 p-4 lg:px-6 lg:py-5"><KpiExecutiveOverview /></div>
  }

  if (view === "funnel") {
    return <div className="min-w-0 p-4 lg:px-6 lg:py-5"><KpiFunnelShadcn canEdit={canEdit} /></div>
  }

  if (view === "history") {
    return <div className="min-w-0 p-4 lg:px-6 lg:py-5"><KpiMonthlyShadcn canEdit={canEdit} /></div>
  }

  return <div className="min-w-0"><KpiDashboardOverview /></div>
}
