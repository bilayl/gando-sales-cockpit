"use client"

import { KpiAcquisitionControl } from "@/components/kpi-acquisition-control"
import { KpiAcquisitionExperiment } from "@/components/kpi-acquisition-experiment"
import { KpiActualTrends } from "@/components/kpi-actual-trends"
import { KpiCeoFocus } from "@/components/kpi-ceo-focus"
import { KpiCeoScorecard } from "@/components/kpi-ceo-scorecard"
import { KpiCostControl } from "@/components/kpi-cost-control"
import { KpiDataSourceHealth } from "@/components/kpi-data-source-health"
import { KpiEconomicsRisk } from "@/components/kpi-economics-risk"
import { KpiForecastScenarios } from "@/components/kpi-forecast-scenarios"
import { KpiGrowthUsage } from "@/components/kpi-growth-usage"
import { KpiMonthlyShadcn } from "@/components/kpi-monthly-shadcn"
import { KpiPartnerRemuneration } from "@/components/kpi-partner-remuneration"
import { KpiSystemDashboard } from "@/components/kpi-system-dashboard"

function KpiSection({
  id,
  eyebrow,
  title,
  description,
  children,
  first = false,
}: {
  id: string
  eyebrow: string
  title: string
  description: string
  children: React.ReactNode
  first?: boolean
}) {
  return (
    <section id={id} className={first ? "" : "border-t border-border/50 pt-9"}>
      <div className="mb-5">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</div>
        <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em]">{title}</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

export function KpiWorkspace({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="min-w-0 px-4 pb-12 sm:px-6 lg:px-8">
      <div className="space-y-9">
        <KpiSection
          id="overview"
          eyebrow="Vue d’ensemble"
          title="Pilotage CEO"
          description="Les chiffres essentiels, la dynamique du mois et les signaux qui demandent une décision."
          first
        >
          <div className="space-y-5">
            <KpiCeoScorecard />
            <KpiCeoFocus />
          </div>
        </KpiSection>

        <KpiSection
          id="growth"
          eyebrow="Croissance"
          title="Croissance & usage"
          description="Activation, fréquence d’usage, volume et trajectoire réelle des loueurs."
        >
          <div className="space-y-5">
            <KpiGrowthUsage />
            <KpiActualTrends variant="growth" />
          </div>
        </KpiSection>

        <KpiSection
          id="economics"
          eyebrow="Économie"
          title="Économie & risque"
          description="Rentabilité par caution, marge contributive et exposition au risque."
        >
          <div className="space-y-5">
            <KpiEconomicsRisk />
            <KpiActualTrends variant="economics" />
          </div>
        </KpiSection>

        <KpiSection
          id="forecast"
          eyebrow="Prévisions"
          title="Scénarios"
          description="Projeter les prochains mois et mesurer l’impact des hypothèses de croissance."
        >
          <KpiForecastScenarios />
        </KpiSection>

        <KpiSection
          id="acquisition"
          eyebrow="Acquisition"
          title="Acquisition & expérimentation"
          description="Suivre les investissements commerciaux et marketing ainsi que leur efficacité."
        >
          <div className="space-y-5">
            <KpiAcquisitionExperiment canEdit={canEdit} />
            <KpiAcquisitionControl canEdit={canEdit} />
          </div>
        </KpiSection>

        <KpiSection
          id="cash"
          eyebrow="Finance"
          title="Cash & coûts"
          description="Suivre les dépenses, la trésorerie et les principaux postes de coût."
        >
          <KpiCostControl canEdit={canEdit} />
        </KpiSection>

        <KpiSection
          id="remuneration"
          eyebrow="Partenaires"
          title="Redevances"
          description="Visualiser les montants à reverser aux partenaires et aux loueurs."
        >
          <KpiPartnerRemuneration />
        </KpiSection>

        <KpiSection
          id="history"
          eyebrow="Historique"
          title="Historique réel & projections"
          description="Comparer les résultats observés aux trajectoires prévues, mois par mois."
        >
          <KpiMonthlyShadcn canEdit={canEdit} />
        </KpiSection>

        <KpiSection
          id="data"
          eyebrow="Données"
          title="Qualité des données"
          description="Contrôler les sources, la fraîcheur des données et les écarts à corriger."
        >
          <div className="space-y-5">
            <KpiDataSourceHealth canEdit={canEdit} />
            <KpiSystemDashboard />
          </div>
        </KpiSection>
      </div>
    </div>
  )
}
