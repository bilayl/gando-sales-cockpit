"use client"

import Link from "next/link"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { KpiView } from "@/lib/kpi-views"

const VIEW_LABEL: Record<KpiView, string> = {
  ceo: "CEO Cockpit",
  growth: "Croissance & usage",
  economics: "Économie & risque",
  acquisition: "Acquisition",
  cash: "Cash & coûts",
  remuneration: "Rémunération partenaires",
  history: "Historique",
  data: "Qualité des données",
}

const VIEW_COPY: Record<KpiView, string> = {
  ceo: "Quatre chiffres pour décider : volume, usage, marge et risque.",
  growth: "Vérifiez si Gando grandit par davantage de loueurs actifs et davantage de cautions par loueur.",
  economics: "Suivez ce que chaque caution rapporte, coûte, garantit et expose réellement Gando.",
  acquisition: "Mesurez le coût d’acquisition jusqu’à la première caution et au MAU, pas l’activité commerciale.",
  cash: "Pilotez dépenses, burn, cash et runway sans les mélanger aux KPI produit.",
  remuneration: "Contrôlez séparément les commissions, cashback et revenue share dus aux partenaires.",
  history: "Analysez les tendances mensuelles et les projections sans surcharger la vue CEO.",
  data: "Contrôlez les définitions, sources et trous de données qui peuvent fausser une décision.",
}

export function KpiSiteHeader({ view }: { view: KpiView }) {
  return (
    <header className="shrink-0 border-b border-border bg-card px-5 py-3 lg:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">KPI</span>
            <span className="text-[10px] text-muted-foreground">{VIEW_LABEL[view]}</span>
          </div>
          <p className="mt-0.5 text-sm font-semibold text-foreground">{VIEW_COPY[view]}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5" asChild>
            <Link href="/">
              <ArrowLeft size={14} /> Cockpit
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => window.location.reload()}>
            <RefreshCw size={14} /> Actualiser
          </Button>
        </div>
      </div>
    </header>
  )
}
