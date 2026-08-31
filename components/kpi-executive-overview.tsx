"use client"

import { useEffect, useMemo, useState } from "react"
import { Activity } from "lucide-react"
import { Badge } from "@/components/kpi-shadcn/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/kpi-shadcn/ui/card"
import { Skeleton } from "@/components/kpi-shadcn/ui/skeleton"

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

type CoreRow = {
  year: number
  monthNumber: number
  revenue: number | null
  tdv: number | null
  deposits: number | null
  activeRenters: number | null
  churnRate: number | null
}

type ValueRow = {
  year: number
  monthNumber: number
  prospectsContacted: number | null
  meetings: number | null
  rentersActivated: number | null
  firstDepositRenters: number | null
  paidSpend: number | null
  salesCost: number | null
  signedRevenue: number | null
  cashCollected: number | null
  netMargin: number | null
  avgDealAgeDays: number | null
  dealsOver40Days: number | null
}

function n(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}
function ratio(top: number | null | undefined, bottom: number | null | undefined) {
  const b = n(bottom)
  return b > 0 ? n(top) / b : null
}
function euro(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: digits }).format(value)
}
function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)
}
function percent(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: digits }).format(value)
}
function decimal(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(value)
}
function key(row: { year: number; monthNumber: number }) {
  return row.year * 12 + row.monthNumber
}

export function KpiExecutiveOverview() {
  const [coreRows, setCoreRows] = useState<CoreRow[]>([])
  const [valueRows, setValueRows] = useState<ValueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    void (async () => {
      try {
        const [coreResponse, valueResponse] = await Promise.all([
          fetch("/api/kpi", { cache: "no-store" }),
          fetch("/api/kpi/value-funnel", { cache: "no-store" }),
        ])
        const [coreBody, valueBody] = await Promise.all([coreResponse.json(), valueResponse.json()])
        if (!coreResponse.ok) throw new Error(coreBody.error || "Impossible de charger les KPI.")
        if (!valueResponse.ok) throw new Error(valueBody.error || "Impossible de charger le funnel.")
        setCoreRows(Array.isArray(coreBody.rows) ? coreBody.rows : [])
        setValueRows(Array.isArray(valueBody.rows) ? valueBody.rows : [])
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossible de charger l’aperçu KPI.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const snapshot = useMemo(() => {
    const latestValue = [...valueRows]
      .filter(row => Object.entries(row).some(([field, value]) => !["year", "monthNumber"].includes(field) && value != null))
      .sort((a, b) => key(b) - key(a))[0]
    const latestCore = [...coreRows]
      .filter(row => row.revenue != null || row.tdv != null || row.deposits != null || row.activeRenters != null)
      .sort((a, b) => key(b) - key(a))[0]
    const targetKey = Math.max(latestValue ? key(latestValue) : 0, latestCore ? key(latestCore) : 0)
    const value = valueRows.find(row => key(row) === targetKey) || latestValue || null
    const core = coreRows.find(row => key(row) === targetKey) || latestCore || null
    const year = value?.year || core?.year || new Date().getFullYear()
    const monthNumber = value?.monthNumber || core?.monthNumber || new Date().getMonth() + 1

    const acquisitionCost = n(value?.paidSpend) + n(value?.salesCost)
    const cac = n(value?.rentersActivated) > 0 ? acquisitionCost / n(value?.rentersActivated) : null
    const arpu = ratio(core?.revenue, core?.activeRenters)
    const churn = n(core?.churnRate)
    const lifetimeMonths = churn > 0 ? Math.min(24, 1 / churn) : 24
    const ltv24 = arpu == null ? null : arpu * lifetimeMonths
    const ltvCac = ltv24 != null && cac != null && cac > 0 ? ltv24 / cac : null
    const takeRate = ratio(core?.revenue, core?.tdv)
    const collectionRate = ratio(value?.cashCollected, value?.signedRevenue)
    const marginRate = ratio(value?.netMargin, core?.revenue)
    const closingRate = ratio(value?.rentersActivated, value?.meetings)

    const alerts: string[] = []
    if (ltvCac != null && ltvCac < 3) alerts.push(`LTV / CAC à ${decimal(ltvCac, 1)}× : sous le repère 3×.`)
    if (n(value?.avgDealAgeDays) > 40) alerts.push(`Âge moyen des deals : ${decimal(value?.avgDealAgeDays, 0)} jours.`)
    if (n(value?.dealsOver40Days) > 0) alerts.push(`${integer(value?.dealsOver40Days)} deal(s) ont plus de 40 jours.`)
    if (collectionRate != null && collectionRate < 0.9) alerts.push(`Taux de collecte à ${percent(collectionRate)} du CA signé.`)
    if (marginRate != null && marginRate < 0) alerts.push("Marge nette négative sur la période.")

    return { value, core, year, monthNumber, cac, ltv24, ltvCac, takeRate, collectionRate, marginRate, closingRate, alerts }
  }, [coreRows, valueRows])

  if (loading) {
    return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-24 w-full rounded-lg" />)}</div>
  }
  if (error) return <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-[12px] text-destructive">{error}</div>

  const { value, core } = snapshot
  const metrics = [
    ["CA Gando", euro(core?.revenue), `Take rate ${percent(snapshot.takeRate)}`],
    ["Marge nette", euro(value?.netMargin), `Taux de marge ${percent(snapshot.marginRate)}`],
    ["TDV sécurisé", euro(core?.tdv), `${integer(core?.deposits)} cautions`],
    ["Loueurs actifs", integer(core?.activeRenters), "MAU du mois"],
    ["Cash encaissé", euro(value?.cashCollected), `${percent(snapshot.collectionRate)} du CA signé`],
    ["Taux de closing", percent(snapshot.closingRate), "RDV → loueurs activés"],
  ]
  const funnel = [
    { label: "Prospects", value: value?.prospectsContacted },
    { label: "Rendez-vous", value: value?.meetings },
    { label: "Loueurs activés", value: value?.rentersActivated },
    { label: "1re caution", value: value?.firstDepositRenters },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-[17px] font-semibold tracking-[-0.02em]">Dernier mois</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Performance actuelle et signaux à surveiller.</p>
        </div>
        <Badge variant="outline" className="h-6 rounded-md px-2 text-[11px] font-normal shadow-none">{MONTHS[snapshot.monthNumber - 1]} {snapshot.year}</Badge>
      </div>

      <div className="grid overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(([label, metric, detail], index) => (
          <div key={label} className={`px-4 py-4 ${index > 0 ? "border-t border-border sm:border-l sm:border-t-0" : ""} ${index === 2 ? "sm:border-l-0 sm:border-t xl:border-l xl:border-t-0" : ""} ${index >= 3 ? "xl:border-t" : ""}`}>
            <div className="text-[11px] text-muted-foreground">{label}</div>
            <div className="mt-2 text-[24px] font-semibold tracking-[-0.03em] tabular-nums">{metric}</div>
            <div className="mt-1.5 text-[10px] text-muted-foreground/75">{detail}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="overflow-hidden rounded-lg border-border shadow-none">
          <CardHeader className="space-y-0.5 border-b border-border px-4 py-3">
            <CardTitle className="text-[13px] font-medium">Funnel de création de valeur</CardTitle>
            <CardDescription className="text-[11px]">Conversion du prospect jusqu’à la première caution.</CardDescription>
          </CardHeader>
          <CardContent className="grid p-0 sm:grid-cols-2 xl:grid-cols-4">
            {funnel.map((item, index) => {
              const previous = index > 0 ? funnel[index - 1].value : null
              const conversion = index > 0 ? ratio(item.value, previous) : null
              return (
                <div key={item.label} className={`px-4 py-4 ${index ? "border-t border-border sm:border-l sm:border-t-0" : ""} ${index === 2 ? "sm:border-l-0 sm:border-t xl:border-l xl:border-t-0" : ""}`}>
                  <div className="text-[11px] text-muted-foreground">{item.label}</div>
                  <div className="mt-2 text-[22px] font-semibold tabular-nums">{integer(item.value)}</div>
                  <div className="mt-2 text-[10px] text-muted-foreground/70">{conversion == null ? "Entrée" : `${percent(conversion)} conversion`}</div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-lg border-border shadow-none">
          <CardHeader className="space-y-0.5 border-b border-border px-4 py-3">
            <div className="flex items-center gap-1.5"><Activity className="size-3.5 text-primary" /><CardTitle className="text-[13px] font-medium">À surveiller</CardTitle></div>
            <CardDescription className="text-[11px]">Signaux calculés automatiquement.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {snapshot.alerts.length ? snapshot.alerts.slice(0, 4).map(alert => (
              <div key={alert} className="px-4 py-3 text-[11px] leading-4 text-amber-800">{alert}</div>
            )) : (
              <div className="px-4 py-4 text-[11px] text-muted-foreground">Aucun signal critique avec les données disponibles.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-lg border-border shadow-none">
        <CardHeader className="space-y-0.5 border-b border-border px-4 py-3">
          <CardTitle className="text-[13px] font-medium">Unit economics</CardTitle>
          <CardDescription className="text-[11px]">Efficacité d’acquisition et valeur client sur une LTV plafonnée à 24 mois.</CardDescription>
        </CardHeader>
        <CardContent className="grid p-0 sm:grid-cols-3">
          {[
            ["CAC", euro(snapshot.cac)],
            ["LTV 24 mois", euro(snapshot.ltv24)],
            ["LTV / CAC", snapshot.ltvCac == null ? "—" : `${decimal(snapshot.ltvCac, 1)}×`],
          ].map(([label, metric], index) => (
            <div key={label} className={`px-4 py-4 ${index ? "border-t border-border sm:border-l sm:border-t-0" : ""}`}>
              <div className="text-[11px] text-muted-foreground">{label}</div>
              <div className="mt-2 text-[22px] font-semibold tracking-[-0.025em] tabular-nums">{metric}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
