"use client"

import Link from "next/link"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { KpiView } from "@/lib/kpi-views"

const VIEW_LABEL: Record<KpiView, string> = {
  lifetime: "Vue d’ensemble",
  remuneration: "Rémunération partenaires",
  system: "Système KPI",
  costs: "Cost Control",
  overview: "Dernier mois",
  funnel: "Funnel & économie",
  history: "Mensuel & projection",
}

const VIEW_COPY: Record<KpiView, string> = {
  lifetime: "Commencez par les 4 résultats CEO : cautions, MAU, marge contributive et loss rate.",
  remuneration: "Suivez ce que Gando doit aux loueurs et partenaires, mois par mois, à partir du volume réellement éligible.",
  system: "Pilotez Gando avec des définitions, formules et données fiables de bout en bout.",
  costs: "Maîtrisez budget, dépenses réelles, coûts unitaires et dérives avant la fin du mois.",
  overview: "Comprenez immédiatement la santé du dernier mois renseigné.",
  funnel: "Reliez acquisition, activation, revenu, cash et marge.",
  history: "Saisissez les données sources et projetez les prochains mois.",
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
