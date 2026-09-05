"use client"

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Row = {
  accountId: string
  name: string
  companyName: string
  totalDeposits: number
  totalVolumeCents: number
  totalRevenueCents: number
  currentMonthDeposits: number
  currentMonthVolumeCents: number
  averageDepositCents: number
  firstActivationAt: string
  lastActivationAt: string
  daysSinceLastActivation: number
}

type Data = {
  summary: {
    activatedRenters: number
    activeThisMonth: number
    totalDeposits: number
    totalVolumeCents: number
  }
  rows: Row[]
}

function euroCents(value: number, digits = 0) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: digits }).format(value / 100)
}
function integer(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)
}
function date(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
}

export function KpiActivatedRentersTable() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/kpi/activated-renters", { cache: "no-store" })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || "Impossible de charger les loueurs activés.")
        setData(body)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossible de charger les loueurs activés.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const rows = useMemo(() => {
    if (!data) return []
    const needle = query.trim().toLowerCase()
    if (!needle) return data.rows
    return data.rows.filter(row => `${row.name} ${row.companyName}`.toLowerCase().includes(needle))
  }, [data, query])

  if (loading) return <Skeleton className="h-[420px] w-full rounded-xl" />
  if (error || !data) return <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error || "Données indisponibles"}</div>

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Loueurs activés depuis le début</div>
          <div className="mt-0.5 text-sm font-semibold">Dernière activation d’une caution par loueur</div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {integer(data.summary.activatedRenters)} loueurs activés · {integer(data.summary.activeThisMonth)} actifs ce mois · {integer(data.summary.totalDeposits)} cautions · {euroCents(data.summary.totalVolumeCents)} garantis
          </div>
        </div>
        <Input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Rechercher un loueur…"
          className="h-8 w-full text-xs sm:w-[230px]"
        />
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loueur</TableHead>
              <TableHead className="text-right">Cautions totales</TableHead>
              <TableHead className="text-right">Ce mois</TableHead>
              <TableHead className="text-right">Volume total</TableHead>
              <TableHead className="text-right">Frais encaissés</TableHead>
              <TableHead className="text-right">Dernière activation</TableHead>
              <TableHead className="text-right">Inactivité</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.accountId}>
                <TableCell>
                  <div className="font-semibold">{row.name}</div>
                  {row.companyName && row.companyName !== row.name ? <div className="text-[10px] text-muted-foreground">{row.companyName}</div> : null}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{integer(row.totalDeposits)}</TableCell>
                <TableCell className="text-right tabular-nums">{integer(row.currentMonthDeposits)}</TableCell>
                <TableCell className="text-right tabular-nums">{euroCents(row.totalVolumeCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{euroCents(row.totalRevenueCents, 2)}</TableCell>
                <TableCell className="text-right tabular-nums">{date(row.lastActivationAt)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className={row.daysSinceLastActivation >= 30 ? "font-semibold text-amber-700" : "text-muted-foreground"}>
                    {row.daysSinceLastActivation === 0 ? "Aujourd’hui" : `${row.daysSinceLastActivation} j`}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length ? (
              <TableRow><TableCell colSpan={7} className="h-20 text-center text-xs text-muted-foreground">Aucun loueur trouvé.</TableCell></TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <div className="border-t border-border bg-muted/10 px-4 py-2 text-[10px] text-muted-foreground">
        Une activation correspond ici à une caution gagnée avec frais de sécurisation encaissés et rapprochés. Le tableau est trié par dernière activation, de la plus récente à la plus ancienne.
      </div>
    </Card>
  )
}
