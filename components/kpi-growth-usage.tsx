"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { KpiActivatedRentersTable } from "@/components/kpi-activated-renters-table"

type Scorecard = {
  period: { currentMonth: string; comparisonMode?: string }
  cautions: { current: number; previous: number; total: number; mom: number | null; tdvCents: number; totalTdvCents: number }
  mau: { current: number; cautionsPerMau: number | null; activatedEver: number; cautionsPerActivatedEver: number | null }
  guarantee: { averagePerCautionCents: number | null; totalAveragePerCautionCents: number | null }
}

type Live = {
  core: {
    successfulDeposits: number
    activeAccounts: number
    guaranteeProvidedCents: number
    averageGuaranteeCents: number
  }
  metadata: { accounts: number }
}

function euroCents(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: digits }).format(value / 100)
}
function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)
}
function decimal(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}
function percent(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: digits }).format(value)
}

export function KpiGrowthUsage() {
  const [scorecard, setScorecard] = useState<Scorecard | null>(null)
  const [live, setLive] = useState<Live | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    void (async () => {
      try {
        const [scoreResponse, liveResponse] = await Promise.all([
          fetch("/api/kpi/ceo-scorecard", { cache: "no-store" }),
          fetch("/api/kpi/live-business", { cache: "no-store" }),
        ])
        const [scoreBody, liveBody] = await Promise.all([scoreResponse.json(), liveResponse.json()])
        if (!scoreResponse.ok) throw new Error(scoreBody.error || "Impossible de charger la croissance.")
        if (!liveResponse.ok) throw new Error(liveBody.error || "Impossible de charger l’usage.")
        setScorecard(scoreBody)
        setLive(liveBody)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossible de charger les KPI de croissance.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <Skeleton className="h-[520px] w-full rounded-xl" />
  if (error || !scorecard || !live) return <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error || "Données indisponibles"}</div>

  const activationShare = live.metadata.accounts > 0 ? scorecard.mau.activatedEver / live.metadata.accounts : null
  const cards = [
    { label: "Cautions MTD", value: integer(scorecard.cautions.current), detail: scorecard.cautions.mom == null ? "Comparaison indisponible" : `${scorecard.cautions.mom >= 0 ? "+" : ""}${percent(scorecard.cautions.mom)} vs même période M-1` },
    { label: "Volume MTD", value: euroCents(scorecard.cautions.tdvCents), detail: `Garantie moyenne ${euroCents(scorecard.guarantee.averagePerCautionCents)}` },
    { label: "MAU", value: integer(scorecard.mau.current), detail: `${decimal(scorecard.mau.cautionsPerMau)} cautions / MAU` },
    { label: "Loueurs déjà activés", value: integer(scorecard.mau.activatedEver), detail: activationShare == null ? "—" : `${percent(activationShare)} des comptes source ont déjà généré une caution` },
  ]

  const usageTarget = 3.5
  const usageGap = scorecard.mau.cautionsPerMau == null ? null : usageTarget - scorecard.mau.cautionsPerMau

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="border-b border-border bg-muted/20 px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Croissance</div>
          <div className="mt-0.5 text-sm font-semibold">Est-ce que Gando grandit réellement ?</div>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((item, index) => (
            <div key={item.label} className={`px-4 py-4 ${index ? "border-t border-border sm:border-l sm:border-t-0" : ""} ${index >= 2 ? "sm:border-t xl:border-t-0" : ""}`}>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">{item.label}</div>
              <div className="mt-2 text-[24px] font-semibold tracking-[-0.035em] tabular-nums">{item.value}</div>
              <div className="mt-1.5 text-[11px] font-medium text-muted-foreground">{item.detail}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Usage</div>
          <div className="mt-0.5 text-sm font-semibold">Le moteur à faire progresser : MAU × cautions par MAU</div>
        </div>
        <div className="grid gap-0 md:grid-cols-3">
          <div className="px-4 py-4">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">MAU actuel</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{integer(scorecard.mau.current)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Loueurs ayant généré au moins une caution payée ce mois.</div>
          </div>
          <div className="border-t border-border px-4 py-4 md:border-l md:border-t-0">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Cautions / MAU</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{decimal(scorecard.mau.cautionsPerMau)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Repère cockpit : 3,5. {usageGap != null && usageGap > 0 ? `Écart actuel : ${decimal(usageGap)}.` : "Objectif atteint ou dépassé."}</div>
          </div>
          <div className="border-t border-border px-4 py-4 md:border-l md:border-t-0">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Base active cumulée</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{integer(scorecard.mau.activatedEver)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{decimal(scorecard.mau.cautionsPerActivatedEver)} cautions en moyenne par loueur activé depuis le début.</div>
          </div>
        </div>
        <div className="border-t border-border bg-muted/10 px-4 py-2.5 text-[10px] text-muted-foreground">
          Le taux “comptes source devenus actifs” est un indicateur de couverture, pas encore un taux d’activation commercial parfaitement propre : les comptes source peuvent inclure des comptes de test ou incomplets.
        </div>
      </Card>

      <KpiActivatedRentersTable />
    </div>
  )
}
