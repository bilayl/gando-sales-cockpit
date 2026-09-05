"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type LiveKpi = {
  source: { project: string; lastSyncedAt: string | null; sourceTables: number }
  core: {
    successfulDeposits: number
    activeAccounts: number
    guaranteeProvidedCents: number
    averageGuaranteeCents: number
    grossRevenueCents: number
    grossRevenuePerCautionCents: number
    paidCaptures: number
    paidCaptureAmountCents: number
    acceptedGuarantees: number
  }
  economics: {
    insuranceRateBps: number
    insuranceTotalCents: number
    insurancePerCautionCents: number
    partnerCostCents: number
    partnerCostPerCautionCents: number
    measuredContributionCents: number
    measuredContributionPerCautionCents: number
    grossRevenueYield: number | null
    measuredContributionYield: number | null
  }
  quality: {
    feeOperations: number
    matchedFeeOperations: number
    unmatchedFeeOperations: number
    successfulDepositsWithoutMatchedFee: number
    feeMatchWindowDays: number
  }
}

function euroCents(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value / 100)
}

function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)
}

function percent(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}

function percentBps(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / 100)} %`
}

export function KpiLiveBusinessData({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<LiveKpi | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    try {
      setError("")
      const response = await fetch("/api/kpi/live-business", { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Impossible de charger les données Gando.")
      setData(body)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de charger les données Gando.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const syncSource = async () => {
    setSyncing(true)
    setError("")
    try {
      const response = await fetch("/api/system/supabase-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Impossible de synchroniser la source Gando.")
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de synchroniser la source Gando.")
    } finally {
      setSyncing(false)
    }
  }

  const cards = useMemo(() => data ? [
    { label: "Garantie fournie", value: euroCents(data.core.guaranteeProvidedCents), detail: `${integer(data.core.successfulDeposits)} cautions · moyenne ${euroCents(data.core.averageGuaranteeCents)}` },
    { label: "Gross Revenue", value: euroCents(data.core.grossRevenueCents, 2), detail: `${euroCents(data.core.grossRevenuePerCautionCents, 2)} / caution · yield ${percent(data.economics.grossRevenueYield)}` },
    { label: "Coût assurance", value: euroCents(data.economics.insuranceTotalCents, 2), detail: `${percentBps(data.economics.insuranceRateBps)} de la garantie · ${euroCents(data.economics.insurancePerCautionCents, 2)} / caution` },
    { label: "Rémunération partenaires", value: euroCents(data.economics.partnerCostCents, 2), detail: `${euroCents(data.economics.partnerCostPerCautionCents, 2)} / caution` },
    { label: "Marge mesurée", value: euroCents(data.economics.measuredContributionCents, 2), detail: `${euroCents(data.economics.measuredContributionPerCautionCents, 2)} / caution · ${percent(data.economics.measuredContributionYield)} de la garantie` },
    { label: "Encaissements récupérés", value: euroCents(data.core.paidCaptureAmountCents, 2), detail: `${integer(data.core.paidCaptures)} encaissement(s) payé(s)` },
  ] : [], [data])

  if (loading) return <Skeleton className="mb-5 h-[360px] w-full rounded-xl" />
  if (!data) return null

  const lastSync = data.source.lastSyncedAt
    ? new Date(data.source.lastSyncedAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—"

  return (
    <Card className="mb-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Économie produit live</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-semibold">
            Supabase Gando
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{data.source.sourceTables} tables synchronisées</Badge>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Assurance {percentBps(data.economics.insuranceRateBps)}</Badge>
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">Dernière sync : {lastSync}</div>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => void syncSource()}
            disabled={syncing}
            className="h-8 rounded-md border border-border bg-background px-3 text-[11px] font-semibold hover:bg-muted disabled:opacity-50"
          >
            {syncing ? "Synchronisation…" : "Synchroniser Gando"}
          </button>
        ) : null}
      </div>

      {error ? <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-[11px] text-destructive">{error}</div> : null}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((item, index) => (
          <div key={item.label} className={`px-4 py-4 ${index ? "border-t border-border sm:border-l sm:border-t-0" : ""} ${index >= 2 ? "sm:border-t xl:border-t-0" : ""} ${index >= 3 ? "xl:border-t" : ""}`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">{item.label}</div>
            <div className="mt-2 text-[22px] font-semibold tracking-[-0.03em] tabular-nums">{item.value}</div>
            <div className="mt-1.5 text-[11px] font-medium text-muted-foreground">{item.detail}</div>
          </div>
        ))}
      </div>

      <div className="border-t border-border bg-muted/10 px-4 py-2 text-[10px] leading-relaxed text-muted-foreground">
        Périmètre économique : cautions au statut active, close ou captured avec frais de sécurisation encaissé et rapproché. La marge mesurée = Gross Revenue − assurance − rémunération partenaires. Les coûts PSP et les pertes finales nettes de recouvrement restent à brancher pour obtenir la marge contributive définitive. Qualité : {integer(data.quality.matchedFeeOperations)} cautions rapprochées · {integer(data.quality.successfulDepositsWithoutMatchedFee)} cautions gagnées sans fee rapproché.
      </div>
    </Card>
  )
}
