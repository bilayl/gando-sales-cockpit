"use client"

import Link from "next/link"
import { ArrowLeft, CheckCircle2, RefreshCw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { KpiView } from "@/lib/kpi-views"

const VIEW_LABEL: Record<KpiView, string> = {
  ceo: "CEO Cockpit",
  forecast: "Prévisions & scénarios",
  growth: "Croissance & usage",
  economics: "Économie & risque",
  acquisition: "Acquisition & CAC",
  cash: "Cash & coûts",
  remuneration: "Redevances partenaires",
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

type SyncStatus = "idle" | "syncing" | "fresh" | "error"

function timeLabel(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date)
}

export function KpiSiteHeader({
  view,
  syncStatus = "idle",
  lastSyncedAt = null,
  onRefresh,
}: {
  view: KpiView
  syncStatus?: SyncStatus
  lastSyncedAt?: string | null
  onRefresh?: () => void
}) {
  const lastSync = timeLabel(lastSyncedAt)

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

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden items-center gap-1.5 text-[10px] font-medium text-muted-foreground sm:flex">
            {syncStatus === "syncing" ? <RefreshCw size={12} className="animate-spin" /> : null}
            {syncStatus === "fresh" ? <CheckCircle2 size={12} className="text-emerald-600" /> : null}
            {syncStatus === "error" ? <TriangleAlert size={12} className="text-amber-600" /> : null}
            <span>
              {syncStatus === "syncing"
                ? "Synchronisation Gando…"
                : syncStatus === "error"
                  ? "Sync source à vérifier"
                  : lastSync
                    ? `Données Gando à jour · ${lastSync}`
                    : "Actualisation automatique active"}
            </span>
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" asChild>
            <Link href="/">
              <ArrowLeft size={14} /> Cockpit
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={onRefresh || (() => window.location.reload())}
            disabled={syncStatus === "syncing"}
          >
            <RefreshCw size={14} className={syncStatus === "syncing" ? "animate-spin" : ""} /> Actualiser
          </Button>
        </div>
      </div>
    </header>
  )
}
