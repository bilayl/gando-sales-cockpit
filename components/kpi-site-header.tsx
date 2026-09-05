"use client"

import Link from "next/link"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { KpiView } from "@/lib/kpi-views"

const VIEW_LABEL: Record<KpiView, string> = {
  ceo: "CEO Cockpit",
  forecast: "Prévisions & scénarios",
  growth: "Croissance & usage",
  economics: "Économie & risque",
  acquisition: "Acquisition & CAC",
  cash: "Cash & coûts",
  remuneration: "Rémunération partenaires",
  history: "Historique réel",
  data: "Qualité des données",
}

const VIEW_COPY: Record<KpiView, string> = {
  ceo: "Où en est Gando aujourd’hui ? Quatre résultats clés et la priorité CEO du moment.",
  forecast: "Où va Gando si la trajectoire actuelle continue, et quels leviers changent réellement le résultat ?",
  growth: "Qui utilise réellement Gando, à quelle fréquence, et quels loueurs faut-il activer ou réactiver ?",
  economics: "Combien gagne Gando par caution et quelle exposition au risque supporte réellement le modèle ?",
  acquisition: "Combien coûte un nouveau loueur actif et quand l’acquisition devient-elle rentable ?",
  cash: "Combien Gando dépense, combien de cash reste disponible et combien de temps l’entreprise peut exécuter ?",
  remuneration: "Combien Gando doit reverser aux loueurs et partenaires, règle par règle.",
  history: "Ce qui s’est réellement passé mois par mois, sans prévision ni scénario mélangé à l’historique.",
  data: "Quelles données sont fiables, lesquelles manquent et quelles décisions sont encore fragiles ?",
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
