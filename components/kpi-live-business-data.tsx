"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type RemunerationRow = {
  actorKey: string
  actorLabel: string
  accountName: string | null
  mechanism: string
  configured: boolean
  eligibleDeposits: number
  successfulDeposits: number
  eligibleTdvCents: number
  eligibleSecuringFeesCents: number
  cashbackDueCents: number
  notes: string | null
}

type LiveKpi = {
  source: { project: string; lastSyncedAt: string | null; sourceTables: number }
  core: {
    successfulDeposits: number
    activeAccounts: number
    totalSecuredCents: number
    averageDepositCents: number
    securingFeesPaidCents: number
    matchedSecuringFeesCents: number
    paidCaptures: number
    paidCaptureAmountCents: number
    acceptedGuarantees: number
  }
  economics: {
    cashbackDueCents: number
    insuranceCostPerWonDepositCents: number | null
    insuranceTotalCents: number | null
    contributionAfterCashbackAndInsuranceCents: number | null
  }
  quality: {
    feeOperations: number
    matchedFeeOperations: number
    unmatchedFeeOperations: number
    successfulDepositsWithoutMatchedFee: number
    feeMatchWindowDays: number
  }
  remuneration: RemunerationRow[]
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

export function KpiLiveBusinessData({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<LiveKpi | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [insuranceDraft, setInsuranceDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    try {
      setError("")
      const response = await fetch("/api/kpi/live-business", { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Impossible de charger les données Gando.")
      setData(body)
      setInsuranceDraft(body.economics.insuranceCostPerWonDepositCents == null
        ? ""
        : String(body.economics.insuranceCostPerWonDepositCents / 100))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de charger les données Gando.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const saveInsurance = async () => {
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/kpi/live-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insuranceCostPerWonDepositEuros: insuranceDraft }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Impossible d’enregistrer le coût assurance.")
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’enregistrer le coût assurance.")
    } finally {
      setSaving(false)
    }
  }

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
    { label: "Cautions gagnées", value: integer(data.core.successfulDeposits), detail: `${integer(data.core.activeAccounts)} loueurs actifs` },
    { label: "TDV sécurisé", value: euroCents(data.core.totalSecuredCents), detail: `Panier moyen ${euroCents(data.core.averageDepositCents)}` },
    { label: "Frais de sécurisation payés", value: euroCents(data.core.securingFeesPaidCents, 2), detail: `${integer(data.quality.feeOperations)} paiements enregistrés` },
    { label: "Frais rattachés aux cautions gagnées", value: euroCents(data.core.matchedSecuringFeesCents, 2), detail: `${integer(data.quality.matchedFeeOperations)} cautions rapprochées` },
    { label: "Cashback à payer", value: euroCents(data.economics.cashbackDueCents, 2), detail: "Règles partenaires configurées" },
    { label: "Coût assurance", value: euroCents(data.economics.insuranceTotalCents, 2), detail: data.economics.insuranceCostPerWonDepositCents == null ? "Coût unitaire à renseigner" : `${euroCents(data.economics.insuranceCostPerWonDepositCents, 2)} / caution gagnée` },
    { label: "Contribution après cashback + assurance", value: euroCents(data.economics.contributionAfterCashbackAndInsuranceCents, 2), detail: "Avant coûts PSP et autres coûts variables" },
    { label: "Encaissements payés", value: euroCents(data.core.paidCaptureAmountCents, 2), detail: `${integer(data.core.paidCaptures)} encaissement(s) · ${integer(data.core.acceptedGuarantees)} garantie(s) acceptée(s)` },
  ] : [], [data])

  if (loading) return <Skeleton className="mb-5 h-[420px] w-full rounded-xl" />
  if (!data) return null

  const lastSync = data.source.lastSyncedAt
    ? new Date(data.source.lastSyncedAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—"

  return (
    <Card className="mb-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Données produit live</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-semibold">
            Supabase Gando
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{data.source.sourceTables} tables synchronisées</Badge>
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

      <div className="grid sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((item, index) => (
          <div key={item.label} className={`px-4 py-4 ${index ? "border-t border-border sm:border-l sm:border-t-0" : ""} ${index >= 2 ? "sm:border-t xl:border-t-0" : ""} ${index >= 4 ? "xl:border-t" : ""}`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">{item.label}</div>
            <div className="mt-2 text-[22px] font-semibold tracking-[-0.03em] tabular-nums">{item.value}</div>
            <div className="mt-1.5 text-[11px] font-medium text-muted-foreground">{item.detail}</div>
          </div>
        ))}
      </div>

      <div className="border-t border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Assurance</div>
            <div className="mt-0.5 text-sm font-semibold">Coût par caution gagnée</div>
            <div className="mt-1 text-[10px] text-muted-foreground">Appliqué à chaque caution au statut active, close ou captured.</div>
          </div>
          {canEdit ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  value={insuranceDraft}
                  onChange={event => setInsuranceDraft(event.target.value)}
                  inputMode="decimal"
                  placeholder="Ex. 2,50"
                  className="h-8 w-28 rounded-md border border-border bg-background px-2 pr-7 text-right text-xs tabular-nums outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">€</span>
              </div>
              <button
                type="button"
                onClick={() => void saveInsurance()}
                disabled={saving}
                className="h-8 rounded-md bg-foreground px-3 text-[11px] font-semibold text-background disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <section className="border-t border-border">
        <div className="border-b border-border px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Revenue share & cashback</div>
          <div className="mt-0.5 text-sm font-semibold">Rémunération loueurs / partenaires</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-muted/20 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Acteur</th>
                <th className="px-4 py-2.5 font-semibold">Mécanisme</th>
                <th className="px-4 py-2.5 text-right font-semibold">Cautions éligibles</th>
                <th className="px-4 py-2.5 text-right font-semibold">TDV éligible</th>
                <th className="px-4 py-2.5 text-right font-semibold">Frais sécurisation</th>
                <th className="px-4 py-2.5 text-right font-semibold">À payer HT</th>
                <th className="px-4 py-2.5 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {data.remuneration.map(row => (
                <tr key={row.actorKey} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{row.actorLabel}</div>
                    {row.accountName ? <div className="mt-0.5 text-[10px] text-muted-foreground">{row.accountName}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.mechanism}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{row.configured ? integer(row.eligibleDeposits) : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.configured ? euroCents(row.eligibleTdvCents) : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.configured ? euroCents(row.eligibleSecuringFeesCents, 2) : "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{row.configured ? euroCents(row.cashbackDueCents, 2) : "—"}</td>
                  <td className="px-4 py-3"><Badge variant={row.configured ? "secondary" : "outline"} className="h-5 px-1.5 text-[10px]">{row.configured ? "Calcul automatique" : "À configurer"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-4 py-3 text-[10px] leading-relaxed text-muted-foreground">
          RL : récompense uniquement si la caution est gagnée et qu’un frais de sécurisation payé est rapproché. 1 000 € à &lt; 1 500 € → 5,60 € HT ; 1 500 € à 2 500 € inclus → 8,33 € HT. Les cautions annulées sont exclues.
        </div>
      </section>

      <div className="border-t border-border bg-muted/10 px-4 py-2 text-[10px] text-muted-foreground">
        Qualité du rapprochement : {integer(data.quality.matchedFeeOperations)} frais associés à une caution gagnée · {integer(data.quality.unmatchedFeeOperations)} frais non rapprochés · fenêtre de rapprochement {integer(data.quality.feeMatchWindowDays)} jours.
      </div>
    </Card>
  )
}
