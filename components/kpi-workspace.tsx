"use client"

import { KpiAcquisitionControl } from "@/components/kpi-acquisition-control"
import { KpiAcquisitionExperiment } from "@/components/kpi-acquisition-experiment"
import { KpiCeoFocus } from "@/components/kpi-ceo-focus"
import { KpiCeoScorecard } from "@/components/kpi-ceo-scorecard"
import { KpiCostControl } from "@/components/kpi-cost-control"
import { KpiDataSourceHealth } from "@/components/kpi-data-source-health"
import { KpiDecisionIntelligence } from "@/components/kpi-decision-intelligence"
import { KpiEconomicsRisk } from "@/components/kpi-economics-risk"
import { KpiGrowthUsage } from "@/components/kpi-growth-usage"
import { KpiMonthlyShadcn } from "@/components/kpi-monthly-shadcn"
import { KpiPartnerRemuneration } from "@/components/kpi-partner-remuneration"
import { KpiSystemDashboard } from "@/components/kpi-system-dashboard"
import type { KpiView } from "@/lib/kpi-views"

export function KpiWorkspace({ view, canEdit }: { view: KpiView; canEdit: boolean }) {
  if (view === "forecast") {
    return (
      <div className="min-w-0 p-4 lg:px-6 lg:py-5">
        <KpiDecisionIntelligence />
      </div>
    )
  }

  if (view === "growth") {
    return <div className="min-w-0 p-4 lg:px-6 lg:py-5"><KpiGrowthUsage /></div>
  }

  if (view === "economics") {
    return <div className="min-w-0 p-4 lg:px-6 lg:py-5"><KpiEconomicsRisk /></div>
  }

  if (view === "acquisition") {
    return (
      <div className="min-w-0 p-4 lg:px-6 lg:py-5">
        <div className="space-y-5">
          <KpiAcquisitionExperiment canEdit={canEdit} />
          <KpiAcquisitionControl canEdit={canEdit} />
        </div>
      </div>
    )
  }

  if (view === "cash") {
    return <div className="min-w-0 p-4 lg:px-6 lg:py-5"><KpiCostControl canEdit={canEdit} /></div>
  }

  if (view === "remuneration") {
    return <div className="min-w-0 p-4 lg:px-6 lg:py-5"><KpiPartnerRemuneration /></div>
  }

  if (view === "history") {
    return <div className="min-w-0 p-4 lg:px-6 lg:py-5"><KpiMonthlyShadcn canEdit={canEdit} /></div>
  }

  if (view === "data") {
    return (
      <div className="min-w-0 p-4 lg:px-6 lg:py-5">
        <div className="space-y-5">
          <KpiDataSourceHealth canEdit={canEdit} />
          <KpiSystemDashboard />
        </div>
      </div>
    )
  }

  return (
    <div className="min-w-0 p-4 lg:px-6 lg:py-5">
      <div className="space-y-5">
        <KpiCeoScorecard />
        <KpiCeoFocus />
      </div>
    </div>
  )
}
