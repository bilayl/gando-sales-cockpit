"use client"

import { useEffect, useMemo, useState } from "react"
import { Activity, Banknote, Building2, CircleDollarSign, ShieldCheck, TrendingUp, UsersRound, WalletCards } from "lucide-react"
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

function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Banknote }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardDescription className="text-xs font-medium">{label}</CardDescription>
          <div className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="size-4" /></div>
        </div>
      </CardHeader>
      <CardContent>
        <CardTitle className="text-2xl font-semibold tracking-tight tabular-nums">{value}</CardTitle>
        <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
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
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-32 w-full rounded-xl" />)}
      </div>
    )
  }
  if (error) return <Card className="border-destructive/30"><CardContent className="pt-6 text-sm text-destructive">{error}</CardContent></Card>

  const { value, core } = snapshot
  const funnel = [
    { label: "Prospects", value: value?.prospectsContacted },
    { label: "Rendez-vous", value: value?.meetings },
    { label: "Loueurs activés", value: value?.rentersActivated },
    { label: "1re caution", value: value?.firstDepositRenters },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge variant="outline">Dernier mois disponible</Badge>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Santé business de Gando</h1>
          <p className="mt-1 text-sm text-muted-foreground">Les KPI essentiels du dernier mois renseigné.</p>
        </div>
        <Badge variant="secondary" className="text-sm">{MONTHS[snapshot.monthNumber - 1]} {snapshot.year}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="CA Gando" value={euro(core?.revenue)} detail={`Take rate ${percent(snapshot.takeRate)}`} icon={Banknote} />
        <MetricCard label="Marge nette" value={euro(value?.netMargin)} detail={`Taux de marge ${percent(snapshot.marginRate)}`} icon={CircleDollarSign} />
        <MetricCard label="TDV sécurisé" value={euro(core?.tdv)} detail={`${integer(core?.deposits)} cautions activées`} icon={ShieldCheck} />
        <MetricCard label="Loueurs actifs" value={integer(core?.activeRenters)} detail="MAU loueurs sur la période" icon={Building2} />
        <MetricCard label="Cash encaissé" value={euro(value?.cashCollected)} detail={`${percent(snapshot.collectionRate)} du CA signé`} icon={WalletCards} />
        <MetricCard label="Taux de closing" value={percent(snapshot.closingRate)} detail="RDV → loueurs activés" icon={UsersRound} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Funnel de création de valeur</CardTitle>
            <CardDescription>Du prospect à la première caution.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {funnel.map((item, index) => {
              const previous = index > 0 ? funnel[index - 1].value : null
              const conversion = index > 0 ? ratio(item.value, previous) : null
              return (
                <div key={item.label} className="rounded-lg border bg-muted/20 p-4">
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="mt-2 text-xl font-semibold tabular-nums">{integer(item.value)}</div>
                  {conversion != null ? <Badge variant="outline" className="mt-3">{percent(conversion)}</Badge> : null}
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2"><Activity className="size-4 text-primary" /><CardTitle className="text-base">À surveiller</CardTitle></div>
            <CardDescription>Signaux calculés à partir des données disponibles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshot.alerts.length ? snapshot.alerts.slice(0, 4).map(alert => (
              <div key={alert} className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-xs leading-5 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">{alert}</div>
            )) : (
              <div className="rounded-lg border bg-muted/25 px-3 py-3 text-xs text-muted-foreground">Aucun signal critique avec les données disponibles.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2"><TrendingUp className="size-4 text-primary" /><CardTitle className="text-base">Unit economics</CardTitle></div>
          <CardDescription>Lecture simple de l’efficacité d’acquisition et de la valeur client.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {[
            ["CAC", euro(snapshot.cac)],
            ["LTV 24 mois", euro(snapshot.ltv24)],
            ["LTV / CAC", snapshot.ltvCac == null ? "—" : `${decimal(snapshot.ltvCac, 1)}×`],
          ].map(([label, metric]) => (
            <div key={label} className="rounded-lg border bg-muted/20 p-4">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="mt-2 text-xl font-semibold tabular-nums">{metric}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
