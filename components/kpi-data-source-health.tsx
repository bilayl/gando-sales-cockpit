"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type Live = {
  source: { project: string; lastSyncedAt: string | null; sourceTables: number }
  quality: {
    feeOperations: number
    matchedFeeOperations: number
    unmatchedFeeOperations: number
    successfulDepositsWithoutMatchedFee: number
    feeMatchWindowDays: number
  }
}

function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)
}

export function KpiDataSourceHealth({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<Live | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    try {
      setError("")
      const response = await fetch("/api/kpi/live-business", { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Impossible de lire la source Gando.")
      setData(body)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de lire la source Gando.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const sync = async () => {
    setSyncing(true)
    setError("")
    try {
      const response = await fetch("/api/system/supabase-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Synchronisation impossible.")
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Synchronisation impossible.")
    } finally {
      setSyncing(false)
    }
  }

  if (loading) return <Skeleton className="h-[220px] w-full rounded-xl" />
  if (!data) return null

  const lastSync = data.source.lastSyncedAt
    ? new Date(data.source.lastSyncedAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—"

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Source Gando</div>
          <div className="mt-0.5 text-sm font-semibold">Synchronisation & qualité de rapprochement</div>
          <div className="mt-1 text-[10px] text-muted-foreground">Dernière synchronisation : {lastSync}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="h-6 text-[10px]">{integer(data.source.sourceTables)} tables</Badge>
          {canEdit ? (
            <button
              type="button"
              onClick={() => void sync()}
              disabled={syncing}
              className="h-8 rounded-md border border-border bg-background px-3 text-[11px] font-semibold hover:bg-muted disabled:opacity-50"
            >
              {syncing ? "Synchronisation…" : "Synchroniser Gando"}
            </button>
          ) : null}
        </div>
      </div>
      {error ? <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-[11px] text-destructive">{error}</div> : null}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4">
        <div className="px-4 py-4">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Frais source</div>
          <div className="mt-2 text-xl font-semibold tabular-nums">{integer(data.quality.feeOperations)}</div>
        </div>
        <div className="border-t border-border px-4 py-4 sm:border-l sm:border-t-0">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Frais rapprochés</div>
          <div className="mt-2 text-xl font-semibold tabular-nums">{integer(data.quality.matchedFeeOperations)}</div>
        </div>
        <div className="border-t border-border px-4 py-4 sm:border-l xl:border-t-0">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Frais non rapprochés</div>
          <div className="mt-2 text-xl font-semibold tabular-nums">{integer(data.quality.unmatchedFeeOperations)}</div>
        </div>
        <div className="border-t border-border px-4 py-4 sm:border-l xl:border-t-0">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Cautions sans fee rapproché</div>
          <div className="mt-2 text-xl font-semibold tabular-nums">{integer(data.quality.successfulDepositsWithoutMatchedFee)}</div>
        </div>
      </div>
      <div className="border-t border-border bg-muted/10 px-4 py-2 text-[10px] text-muted-foreground">
        Fenêtre actuelle de rapprochement fee ↔ caution : {integer(data.quality.feeMatchWindowDays)} jours. Ces indicateurs restent ici afin de ne pas polluer le pilotage CEO.
      </div>
    </Card>
  )
}
