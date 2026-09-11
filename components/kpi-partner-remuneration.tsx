"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type MonthlyRow = {
  month: string
  deposits: number
  tdvCents: number
  securingFeesCents: number
  dueCents: number
}

type BreakdownRow = {
  accountId: string
  accountName: string
  deposits: number
  tdvCents: number
  dueCents: number
}

type PartnerRow = {
  actorKey: string
  actorLabel: string
  accountName: string | null
  mechanism: string
  calculationMode: string
  rateBps: number | null
  configured: boolean
  eligibleDeposits: number
  eligibleTdvCents: number
  eligibleSecuringFeesCents: number
  dueCents: number
  monthly: MonthlyRow[]
  breakdown: BreakdownRow[]
  notes: string | null
  consistencyWarning: string | null
}

type PartnerResponse = {
  source: { lastSyncedAt: string | null }
  currentMonth: string
  currentMonthDueCents: number
  configuredPartners: number
  rows: PartnerRow[]
}

function euroCents(value: number | null | undefined, digits = 2) {
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

function percentBps(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / 100)} %`
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number)
  if (!year || !month) return value
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export function KpiPartnerRemuneration() {
  const [data, setData] = useState<PartnerResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/kpi/partner-remuneration", { cache: "no-store" })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || "Impossible de charger les redevances.")
        setData(body)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossible de charger les redevances.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const monthlyRows = useMemo(() => {
    if (!data) return []
    return data.rows
      .flatMap(partner => partner.monthly.map(month => ({
        ...month,
        actorKey: partner.actorKey,
        actorLabel: partner.actorLabel,
        mechanism: partner.mechanism,
        rateBps: partner.rateBps,
      })))
      .sort((a, b) => b.month.localeCompare(a.month) || a.actorLabel.localeCompare(b.actorLabel))
  }, [data])

  if (loading) return <Skeleton className="h-[520px] w-full rounded-xl" />
  if (error) return <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error}</div>
  if (!data) return null

  const fleetee = data.rows.find(row => row.actorKey === "fleetee")
  const lr = data.rows.find(row => row.actorKey === "lr")
  const fleeteeCurrentMonth = fleetee?.monthly.find(row => row.month === data.currentMonth)
  const lastSync = data.source.lastSyncedAt
    ? new Date(data.source.lastSyncedAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—"

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Redevances & revenue share</div>
            <div className="mt-0.5 text-sm font-semibold">Redevances loueurs / partenaires</div>
            <div className="mt-1 text-[10px] text-muted-foreground">Calculées automatiquement depuis les cautions synchronisées · dernière sync {lastSync}</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="h-6 text-[10px]">{integer(data.configuredPartners)} partenaire(s) configuré(s)</Badge>
            <Badge variant="outline" className="h-6 text-[10px]">{monthLabel(data.currentMonth)} : {euroCents(data.currentMonthDueCents)} HT dû</Badge>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-muted/20 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Acteur</th>
                <th className="px-4 py-2.5 font-semibold">Règle</th>
                <th className="px-4 py-2.5 text-right font-semibold">Cautions éligibles</th>
                <th className="px-4 py-2.5 text-right font-semibold">Volume éligible</th>
                <th className="px-4 py-2.5 text-right font-semibold">Frais sécurisation</th>
                <th className="px-4 py-2.5 text-right font-semibold">Redevance HT</th>
                <th className="px-4 py-2.5 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map(row => (
                <tr key={row.actorKey} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{row.actorLabel}</div>
                    {row.accountName ? <div className="mt-0.5 text-[10px] text-muted-foreground">{row.accountName}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{row.mechanism}</div>
                    {row.rateBps ? <div className="mt-0.5 text-[10px]">Taux : {percentBps(row.rateBps)}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{row.configured ? integer(row.eligibleDeposits) : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.configured ? euroCents(row.eligibleTdvCents, 0) : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.configured ? (row.actorKey === "fleetee" ? "—" : euroCents(row.eligibleSecuringFeesCents)) : "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{row.configured ? euroCents(row.dueCents) : "—"}</td>
                  <td className="px-4 py-3"><Badge variant={row.configured ? "secondary" : "outline"} className="h-5 px-1.5 text-[10px]">{row.configured ? "Calcul automatique" : "À configurer"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {fleetee?.configured ? (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Fleetee</div>
              <div className="mt-0.5 text-sm font-semibold">Redevance Fleetee</div>
              <div className="mt-1 max-w-3xl text-[10px] text-muted-foreground">
                2 € HT par caution activée strictement supérieure à 800 € pour tous les loueurs associés à Fleetee. Une caution reste comptée après clôture ou annulation si elle a bien été activée. Les cautions garanties sont exclues.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="h-6 text-[10px]">{integer(fleetee.eligibleDeposits)} cautions · total</Badge>
              <Badge variant="outline" className="h-6 text-[10px]">{euroCents(fleetee.dueCents)} HT · total dû</Badge>
              {fleeteeCurrentMonth ? <Badge variant="outline" className="h-6 text-[10px]">{monthLabel(data.currentMonth)} : {integer(fleeteeCurrentMonth.deposits)} cautions · {euroCents(fleeteeCurrentMonth.dueCents)} HT</Badge> : null}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="bg-muted/20 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Loueur Fleetee</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Cautions éligibles</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Volume caution</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Redevance HT</th>
                </tr>
              </thead>
              <tbody>
                {fleetee.breakdown.length ? fleetee.breakdown.map(row => (
                  <tr key={row.accountId || row.accountName} className="border-t border-border">
                    <td className="px-4 py-3 font-semibold">{row.accountName}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{integer(row.deposits)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{euroCents(row.tdvCents, 0)}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">{euroCents(row.dueCents)}</td>
                  </tr>
                )) : (
                  <tr className="border-t border-border"><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Aucune caution Fleetee éligible.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {lr ? (
        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">LR Location</div>
            <div className="mt-0.5 text-sm font-semibold">Suivi mensuel de la redevance</div>
            <div className="mt-1 text-[10px] text-muted-foreground">Règle active : {percentBps(lr.rateBps)} du volume des cautions au statut active, datées par l’encaissement du frais de sécurisation.</div>
          </div>

          {lr.consistencyWarning ? (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              {lr.consistencyWarning}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-muted/20 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Mois</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Cautions actives</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Volume actif</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Frais sécurisation</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Taux</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Redevance HT</th>
                </tr>
              </thead>
              <tbody>
                {lr.monthly.length ? lr.monthly.map(row => (
                  <tr key={row.month} className="border-t border-border">
                    <td className="px-4 py-3 font-semibold capitalize">{monthLabel(row.month)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{integer(row.deposits)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{euroCents(row.tdvCents, 0)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{euroCents(row.securingFeesCents)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{percentBps(lr.rateBps)}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">{euroCents(row.dueCents)}</td>
                  </tr>
                )) : (
                  <tr className="border-t border-border"><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Aucune caution éligible sur la période configurée.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Historique mensuel</div>
          <div className="mt-0.5 text-sm font-semibold">Historique des redevances partenaires</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="bg-muted/20 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Mois</th>
                <th className="px-4 py-2.5 font-semibold">Partenaire</th>
                <th className="px-4 py-2.5 text-right font-semibold">Cautions</th>
                <th className="px-4 py-2.5 text-right font-semibold">Volume</th>
                <th className="px-4 py-2.5 text-right font-semibold">Frais sécurisation</th>
                <th className="px-4 py-2.5 text-right font-semibold">Redevance HT</th>
              </tr>
            </thead>
            <tbody>
              {monthlyRows.map(row => (
                <tr key={`${row.actorKey}-${row.month}`} className="border-t border-border">
                  <td className="px-4 py-3 capitalize">{monthLabel(row.month)}</td>
                  <td className="px-4 py-3 font-semibold">{row.actorLabel}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{integer(row.deposits)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{euroCents(row.tdvCents, 0)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.actorKey === "fleetee" ? "—" : euroCents(row.securingFeesCents)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{euroCents(row.dueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
