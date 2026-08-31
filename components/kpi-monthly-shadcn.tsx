"use client"

import { useEffect, useMemo, useState } from "react"
import { Pencil, RefreshCw, Save, TrendingDown, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/kpi-shadcn/ui/tabs"

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

type KpiRow = {
  id?: string
  year: number
  monthNumber: number
  month: string
  revenue: number | null
  tdv: number | null
  deposits: number | null
  activeRenters: number | null
  newUsers: number | null
  registeredUsers: number | null
  totalClients: number | null
  cumulativeDepositVolume: number | null
  depositCashouts: number | null
  cashoutAmount: number | null
  advancedGuarantee: number | null
  churnedRenters: number | null
  churnRate: number | null
  growth: number | null
}

type NumericKey = Exclude<keyof KpiRow, "id" | "year" | "monthNumber" | "month">

type Derived = {
  takeRate: number | null
  arpu: number | null
  avgDeposit: number | null
  revenuePerDeposit: number | null
  depositsPerRenter: number | null
  depositGrowth: number | null
  revenueGrowth: number | null
  tdvGrowth: number | null
  cashoutRate: number | null
  avgCashout: number | null
  guaranteeShare: number | null
  churnRate: number | null
}

type Assumptions = {
  depositGrowth: number
  depositsPerRenter: number
  tdvPerDeposit: number
  takeRate: number
  newUsersPerMonth: number
  newClientsPerMonth: number
  cashoutRate: number
  cashoutAmount: number
  guaranteeShare: number
  churnRate: number
}

type SimulationRow = {
  year: number
  monthNumber: number
  month: string
  revenue: number
  tdv: number
  deposits: number
  activeRenters: number
  registeredUsers: number
  totalClients: number
  depositCashouts: number
  cashoutAmount: number
  advancedGuarantee: number
  churnedRenters: number
}

const SOURCE_FIELDS: Array<{ key: NumericKey; label: string; group: string; euro?: boolean }> = [
  { key: "revenue", label: "Revenue Gando", group: "Revenu & volume", euro: true },
  { key: "tdv", label: "TDV sécurisé", group: "Revenu & volume", euro: true },
  { key: "deposits", label: "Cautions activées", group: "Revenu & volume" },
  { key: "activeRenters", label: "Loueurs actifs (MAU)", group: "Usage" },
  { key: "newUsers", label: "Nouveaux utilisateurs", group: "Usage" },
  { key: "registeredUsers", label: "Utilisateurs inscrits", group: "Usage" },
  { key: "totalClients", label: "Total clients", group: "Usage" },
  { key: "depositCashouts", label: "Cautions encaissées", group: "Risque & recouvrement" },
  { key: "cashoutAmount", label: "Montant encaissé", group: "Risque & recouvrement", euro: true },
  { key: "advancedGuarantee", label: "Garantie Gando avancée", group: "Risque & recouvrement", euro: true },
  { key: "churnedRenters", label: "Loueurs churnés", group: "Risque & recouvrement" },
]

function rowKey(year: number, monthNumber: number) {
  return `${year}-${String(monthNumber).padStart(2, "0")}`
}

function monthIndex(row: { year: number; monthNumber: number }) {
  return row.year * 12 + row.monthNumber - 1
}

function fromMonthIndex(index: number) {
  const year = Math.floor(index / 12)
  const monthNumber = index % 12 + 1
  return { year, monthNumber, month: MONTHS[monthNumber - 1] }
}

function blankRow(year: number, monthNumber: number): KpiRow {
  return {
    year,
    monthNumber,
    month: MONTHS[monthNumber - 1],
    revenue: null,
    tdv: null,
    deposits: null,
    activeRenters: null,
    newUsers: null,
    registeredUsers: null,
    totalClients: null,
    cumulativeDepositVolume: null,
    depositCashouts: null,
    cashoutAmount: null,
    advancedGuarantee: null,
    churnedRenters: null,
    churnRate: null,
    growth: null,
  }
}

function n(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function ratio(top: number | null | undefined, bottom: number | null | undefined) {
  const b = n(bottom)
  return b > 0 ? n(top) / b : null
}

function growth(current: number | null | undefined, previous: number | null | undefined) {
  const p = n(previous)
  if (p <= 0 || current == null) return null
  return (n(current) - p) / p
}

function mean(values: Array<number | null | undefined>) {
  const clean = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0
}

function isFilled(row: KpiRow) {
  return row.revenue != null || row.tdv != null || row.deposits != null || row.activeRenters != null
}

function euro(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: digits }).format(value)
}

function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)
}

function decimal(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(value)
}

function percent(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: digits }).format(value)
}

function nullableInput(value: string) {
  if (value.trim() === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function TrendBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[10px] font-medium text-muted-foreground/60">—</span>
  const up = value >= 0
  return (
    <Badge variant="outline" className={up
      ? "h-5 gap-0.5 border-emerald-200/80 bg-emerald-50/70 px-1.5 text-[10px] font-semibold text-emerald-700"
      : "h-5 gap-0.5 border-rose-200/80 bg-rose-50/70 px-1.5 text-[10px] font-semibold text-rose-700"}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{up ? "+" : "-"}{percent(Math.abs(value))}
    </Badge>
  )
}

function DriverCell({ label, value, formula, index }: { label: string; value: string; formula: string; index: number }) {
  return (
    <div className={`px-4 py-4 ${index ? "border-t border-border sm:border-l sm:border-t-0" : ""} ${index % 4 === 0 && index > 0 ? "sm:border-l-0 lg:border-l-0" : ""} ${index >= 4 ? "lg:border-t" : ""}`}>
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">{label}</div>
      <div className="mt-2 text-[19px] font-semibold tracking-[-0.02em] tabular-nums">{value}</div>
      <div className="mt-1.5 text-[10px] font-medium text-muted-foreground">{formula}</div>
    </div>
  )
}

function AssumptionField({ label, value, suffix, percentValue, onChange }: { label: string; value: number; suffix?: string; percentValue?: boolean; onChange: (value: number) => void }) {
  const shown = percentValue ? value * 100 : value
  return (
    <label className="space-y-1.5">
      <span className="text-[11px] font-semibold">{label}</span>
      <div className="relative">
        <Input className="h-9 text-xs" type="number" step="any" value={Number(shown.toFixed(2))} onChange={event => { const parsed = Number(event.target.value); if (Number.isFinite(parsed)) onChange(percentValue ? parsed / 100 : parsed) }} />
        {suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{suffix}</span> : null}
      </div>
    </label>
  )
}

export function KpiMonthlyShadcn({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<KpiRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedMonth, setSelectedMonth] = useState("")
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<KpiRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [horizon, setHorizon] = useState("12")
  const [assumptions, setAssumptions] = useState<Assumptions | null>(null)

  async function load() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/kpi", { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Impossible de charger les KPI.")
      setRows(Array.isArray(body.rows) ? body.rows : [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de charger les KPI.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const sortedRows = useMemo(() => [...rows].sort((a, b) => monthIndex(a) - monthIndex(b)), [rows])
  const actualRows = useMemo(() => sortedRows.filter(isFilled), [sortedRows])

  useEffect(() => {
    if (selectedMonth || !actualRows.length) return
    const latest = actualRows.at(-1)
    if (latest) setSelectedMonth(rowKey(latest.year, latest.monthNumber))
  }, [actualRows, selectedMonth])

  useEffect(() => {
    if (!selectedMonth) return
    const [year, monthNumber] = selectedMonth.split("-").map(Number)
    const existing = rows.find(row => row.year === year && row.monthNumber === monthNumber)
    setDraft(existing ? { ...existing } : blankRow(year, monthNumber))
  }, [selectedMonth, rows])

  const derivedByMonth = useMemo(() => {
    const map = new Map<string, Derived>()
    sortedRows.forEach((row, index) => {
      const previous = index > 0 ? sortedRows[index - 1] : null
      map.set(rowKey(row.year, row.monthNumber), {
        takeRate: ratio(row.revenue, row.tdv),
        arpu: ratio(row.revenue, row.activeRenters),
        avgDeposit: ratio(row.tdv, row.deposits),
        revenuePerDeposit: ratio(row.revenue, row.deposits),
        depositsPerRenter: ratio(row.deposits, row.activeRenters),
        depositGrowth: growth(row.deposits, previous?.deposits),
        revenueGrowth: growth(row.revenue, previous?.revenue),
        tdvGrowth: growth(row.tdv, previous?.tdv),
        cashoutRate: ratio(row.depositCashouts, row.deposits),
        avgCashout: ratio(row.cashoutAmount, row.depositCashouts),
        guaranteeShare: ratio(row.advancedGuarantee, row.cashoutAmount),
        churnRate: ratio(row.churnedRenters, previous?.activeRenters),
      })
    })
    return map
  }, [sortedRows])

  const selectedIndex = sortedRows.findIndex(row => rowKey(row.year, row.monthNumber) === selectedMonth)
  const selected = selectedIndex >= 0 ? sortedRows[selectedIndex] : draft
  const previous = selectedIndex > 0 ? sortedRows[selectedIndex - 1] : null
  const selectedDerived = selected ? derivedByMonth.get(rowKey(selected.year, selected.monthNumber)) || null : null

  const historical = useMemo(() => {
    const derived = actualRows.map(row => derivedByMonth.get(rowKey(row.year, row.monthNumber))).filter((item): item is Derived => Boolean(item))
    const clientIncrements = actualRows.slice(1).map((row, index) => Math.max(0, n(row.totalClients) - n(actualRows[index].totalClients)))
    return {
      depositGrowth: mean(derived.map(item => item.depositGrowth)),
      depositsPerRenter: mean(derived.map(item => item.depositsPerRenter)),
      tdvPerDeposit: mean(derived.map(item => item.avgDeposit)),
      takeRate: mean(derived.map(item => item.takeRate)),
      newUsersPerMonth: mean(actualRows.map(row => row.newUsers)),
      newClientsPerMonth: mean(clientIncrements),
      cashoutRate: mean(derived.map(item => item.cashoutRate)),
      cashoutAmount: mean(derived.map(item => item.avgCashout)),
      guaranteeShare: mean(derived.map(item => item.guaranteeShare)),
      churnRate: mean(derived.map(item => item.churnRate)),
    }
  }, [actualRows, derivedByMonth])

  useEffect(() => {
    setAssumptions({
      depositGrowth: historical.depositGrowth,
      depositsPerRenter: historical.depositsPerRenter || 1,
      tdvPerDeposit: historical.tdvPerDeposit,
      takeRate: historical.takeRate,
      newUsersPerMonth: historical.newUsersPerMonth,
      newClientsPerMonth: historical.newClientsPerMonth,
      cashoutRate: historical.cashoutRate,
      cashoutAmount: historical.cashoutAmount,
      guaranteeShare: historical.guaranteeShare,
      churnRate: historical.churnRate,
    })
  }, [historical])

  const simulation = useMemo<SimulationRow[]>(() => {
    const last = actualRows.at(-1)
    if (!last || !assumptions) return []
    const result: SimulationRow[] = []
    let deposits = n(last.deposits)
    let registeredUsers = n(last.registeredUsers)
    let totalClients = n(last.totalClients)
    const months = Number(horizon)
    for (let offset = 1; offset <= months; offset += 1) {
      deposits = Math.max(0, deposits * (1 + assumptions.depositGrowth))
      const point = fromMonthIndex(monthIndex(last) + offset)
      const activeRenters = assumptions.depositsPerRenter > 0 ? deposits / assumptions.depositsPerRenter : 0
      const tdv = Math.max(0, deposits * assumptions.tdvPerDeposit)
      const revenue = Math.max(0, tdv * assumptions.takeRate)
      registeredUsers += Math.max(0, assumptions.newUsersPerMonth)
      totalClients += Math.max(0, assumptions.newClientsPerMonth)
      const depositCashouts = Math.max(0, deposits * assumptions.cashoutRate)
      const cashoutAmount = Math.max(0, depositCashouts * assumptions.cashoutAmount)
      result.push({
        ...point,
        revenue,
        tdv,
        deposits,
        activeRenters,
        registeredUsers,
        totalClients,
        depositCashouts,
        cashoutAmount,
        advancedGuarantee: Math.max(0, cashoutAmount * assumptions.guaranteeShare),
        churnedRenters: Math.max(0, activeRenters * assumptions.churnRate),
      })
    }
    return result
  }, [actualRows, assumptions, horizon])

  async function save() {
    if (!draft || !canEdit) return
    setSaving(true)
    setError("")
    try {
      const previousRow = sortedRows.filter(row => monthIndex(row) < monthIndex(draft)).at(-1) || null
      const rowsBefore = sortedRows.filter(row => monthIndex(row) < monthIndex(draft))
      const payload: KpiRow = {
        ...draft,
        growth: growth(draft.deposits, previousRow?.deposits),
        churnRate: ratio(draft.churnedRenters, previousRow?.activeRenters),
        cumulativeDepositVolume: rowsBefore.reduce((sum, row) => sum + n(row.tdv), 0) + n(draft.tdv),
      }
      const response = await fetch("/api/kpi", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Enregistrement impossible.")
      setRows(Array.isArray(body.rows) ? body.rows : rows)
      setEditing(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Enregistrement impossible.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Skeleton className="h-[680px] w-full rounded-xl" />

  const projection = simulation.at(-1) || null
  const monthlyMetrics = selected && selectedDerived ? [
    { label: "CA Gando", value: euro(selected.revenue, 2), trend: selectedDerived.revenueGrowth },
    { label: "TDV sécurisé", value: euro(selected.tdv), trend: selectedDerived.tdvGrowth },
    { label: "Cautions activées", value: integer(selected.deposits), trend: selectedDerived.depositGrowth },
    { label: "Loueurs actifs", value: integer(selected.activeRenters), trend: growth(selected.activeRenters, previous?.activeRenters) },
  ] : []
  const drivers = selectedDerived ? [
    ["Take rate", percent(selectedDerived.takeRate, 2), "CA / TDV"],
    ["ARPU loueur", euro(selectedDerived.arpu, 2), "CA / loueurs actifs"],
    ["Caution moyenne", euro(selectedDerived.avgDeposit), "TDV / cautions"],
    ["CA / caution", euro(selectedDerived.revenuePerDeposit, 2), "CA / cautions"],
    ["Cautions / MAU", decimal(selectedDerived.depositsPerRenter, 2), "cautions / loueurs actifs"],
    ["Taux d’encaissement", percent(selectedDerived.cashoutRate), "encaissées / activées"],
    ["Montant moyen encaissé", euro(selectedDerived.avgCashout), "montant / encaissements"],
    ["Churn loueurs", percent(selectedDerived.churnRate), "churnés / MAU précédent"],
  ] : []

  return (
    <Tabs defaultValue="monthly" className="min-w-0">
      <Card className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-6 text-[10px] font-semibold">Pilotage mensuel</Badge>
            <span className="text-[11px] text-muted-foreground">Réel, ratios calculés et projection</span>
          </div>
          <TabsList className="h-8"><TabsTrigger value="monthly" className="h-7 text-xs">Réel</TabsTrigger><TabsTrigger value="simulation" className="h-7 text-xs">Projection</TabsTrigger></TabsList>
        </div>

        {error ? <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-2.5 text-xs text-destructive">{error}</div> : null}

        <TabsContent value="monthly" className="m-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-9 w-[180px] text-xs"><SelectValue placeholder="Choisir un mois" /></SelectTrigger>
                <SelectContent>{sortedRows.map(row => <SelectItem key={rowKey(row.year, row.monthNumber)} value={rowKey(row.year, row.monthNumber)}>{row.month} {row.year}</SelectItem>)}</SelectContent>
              </Select>
              {selected ? <span className="text-[11px] text-muted-foreground">{SOURCE_FIELDS.filter(field => selected[field.key] != null).length}/{SOURCE_FIELDS.length} sources renseignées</span> : null}
            </div>
            {canEdit ? <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setEditing(current => !current)}><Pencil size={14} />{editing ? "Fermer" : "Saisir / corriger"}</Button> : null}
          </div>

          {monthlyMetrics.length ? (
            <section className="border-b border-border">
              <div className="grid sm:grid-cols-2 xl:grid-cols-4">
                {monthlyMetrics.map((item, index) => (
                  <div key={item.label} className={`px-4 py-4 ${index ? "border-t border-border sm:border-l sm:border-t-0" : ""} ${index === 2 ? "sm:border-l-0 sm:border-t xl:border-l xl:border-t-0" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">{item.label}</span>
                      <TrendBadge value={item.trend} />
                    </div>
                    <div className="mt-2 text-[23px] font-semibold tracking-[-0.03em] tabular-nums">{item.value}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {drivers.length ? (
            <section className="border-b border-border">
              <div className="border-b border-border px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Calculé</div>
                <div className="mt-0.5 text-sm font-semibold">Drivers automatiques</div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4">
                {drivers.map(([label, value, formula], index) => <DriverCell key={label} label={label} value={value} formula={formula} index={index} />)}
              </div>
            </section>
          ) : null}

          {editing && canEdit && draft ? (
            <section className="border-b border-border">
              <div className="border-b border-border px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Sources</div>
                <div className="mt-0.5 text-sm font-semibold">{MONTHS[draft.monthNumber - 1]} {draft.year}</div>
              </div>
              <div className="space-y-5 p-4">
                {["Revenu & volume", "Usage", "Risque & recouvrement"].map(group => (
                  <div key={group}>
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">{group}</div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {SOURCE_FIELDS.filter(field => field.group === group).map(field => (
                        <label key={field.key} className="space-y-1.5">
                          <span className="text-[11px] font-semibold">{field.label}</span>
                          <div className="relative">
                            <Input className="h-9 text-xs" type="number" step="any" value={draft[field.key] ?? ""} onChange={event => setDraft(current => current ? ({ ...current, [field.key]: nullableInput(event.target.value) } as KpiRow) : current)} />
                            {field.euro ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">€</span> : null}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end gap-2 border-t border-border pt-4"><Button variant="outline" size="sm" className="h-9" onClick={() => setEditing(false)}>Annuler</Button><Button size="sm" className="h-9 gap-1.5" onClick={() => void save()} disabled={saving}>{saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}Enregistrer et recalculer</Button></div>
              </div>
            </section>
          ) : null}

          <section>
            <div className="border-b border-border px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Historique</div>
              <div className="mt-0.5 text-sm font-semibold">Réel + ratios calculés</div>
            </div>
            <Table className="min-w-[1050px] text-[11px]">
              <TableHeader className="bg-muted/35"><TableRow><TableHead className="sticky left-0 z-10 bg-muted/95 pl-4">Mois</TableHead><TableHead>CA</TableHead><TableHead>Δ CA</TableHead><TableHead>TDV</TableHead><TableHead>Take rate</TableHead><TableHead>Cautions</TableHead><TableHead>Δ cautions</TableHead><TableHead>MAU</TableHead><TableHead>Cautions / MAU</TableHead><TableHead>ARPU</TableHead><TableHead>Caution moy.</TableHead></TableRow></TableHeader>
              <TableBody>{[...actualRows].reverse().map(row => { const derived = derivedByMonth.get(rowKey(row.year, row.monthNumber)); return <TableRow key={rowKey(row.year, row.monthNumber)} onClick={() => setSelectedMonth(rowKey(row.year, row.monthNumber))} className="group cursor-pointer"><TableCell className="sticky left-0 bg-card pl-4 font-semibold group-hover:bg-muted/50">{row.month} {row.year}</TableCell><TableCell>{euro(row.revenue, 2)}</TableCell><TableCell><TrendBadge value={derived?.revenueGrowth ?? null} /></TableCell><TableCell>{euro(row.tdv)}</TableCell><TableCell>{percent(derived?.takeRate, 2)}</TableCell><TableCell>{integer(row.deposits)}</TableCell><TableCell><TrendBadge value={derived?.depositGrowth ?? null} /></TableCell><TableCell>{integer(row.activeRenters)}</TableCell><TableCell>{decimal(derived?.depositsPerRenter, 2)}</TableCell><TableCell>{euro(derived?.arpu, 2)}</TableCell><TableCell>{euro(derived?.avgDeposit)}</TableCell></TableRow> })}</TableBody>
            </Table>
          </section>
        </TabsContent>

        <TabsContent value="simulation" className="m-0">
          {!assumptions ? <div className="p-4"><Skeleton className="h-64 rounded-xl" /></div> : (
            <>
              <section className="border-b border-border">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Hypothèses</div>
                    <div className="mt-0.5 text-sm font-semibold">Scénario basé sur les moyennes historiques</div>
                  </div>
                  <Select value={horizon} onValueChange={setHorizon}><SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="6">+6 mois</SelectItem><SelectItem value="12">+12 mois</SelectItem><SelectItem value="24">+24 mois</SelectItem></SelectContent></Select>
                </div>
                <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  <AssumptionField label="Croissance cautions" value={assumptions.depositGrowth} suffix="%" percentValue onChange={value => setAssumptions(current => current && ({ ...current, depositGrowth: value }))} />
                  <AssumptionField label="Cautions / loueur" value={assumptions.depositsPerRenter} onChange={value => setAssumptions(current => current && ({ ...current, depositsPerRenter: value }))} />
                  <AssumptionField label="TDV / caution" value={assumptions.tdvPerDeposit} suffix="€" onChange={value => setAssumptions(current => current && ({ ...current, tdvPerDeposit: value }))} />
                  <AssumptionField label="Take rate" value={assumptions.takeRate} suffix="%" percentValue onChange={value => setAssumptions(current => current && ({ ...current, takeRate: value }))} />
                  <AssumptionField label="Nouveaux users / mois" value={assumptions.newUsersPerMonth} onChange={value => setAssumptions(current => current && ({ ...current, newUsersPerMonth: value }))} />
                  <AssumptionField label="Nouveaux clients / mois" value={assumptions.newClientsPerMonth} onChange={value => setAssumptions(current => current && ({ ...current, newClientsPerMonth: value }))} />
                  <AssumptionField label="Taux d’encaissement" value={assumptions.cashoutRate} suffix="%" percentValue onChange={value => setAssumptions(current => current && ({ ...current, cashoutRate: value }))} />
                  <AssumptionField label="Montant / encaissement" value={assumptions.cashoutAmount} suffix="€" onChange={value => setAssumptions(current => current && ({ ...current, cashoutAmount: value }))} />
                  <AssumptionField label="Part garantie avancée" value={assumptions.guaranteeShare} suffix="%" percentValue onChange={value => setAssumptions(current => current && ({ ...current, guaranteeShare: value }))} />
                  <AssumptionField label="Churn loueurs" value={assumptions.churnRate} suffix="%" percentValue onChange={value => setAssumptions(current => current && ({ ...current, churnRate: value }))} />
                </div>
              </section>

              {projection ? (
                <section className="border-b border-border">
                  <div className="grid sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      [ `CA à +${horizon} mois`, euro(projection.revenue, 2) ],
                      [ "TDV projeté", euro(projection.tdv) ],
                      [ "Cautions projetées", integer(projection.deposits) ],
                      [ "Loueurs actifs", integer(projection.activeRenters) ],
                    ].map(([label, value], index) => (
                      <div key={label} className={`px-4 py-4 ${index ? "border-t border-border sm:border-l sm:border-t-0" : ""} ${index === 2 ? "sm:border-l-0 sm:border-t xl:border-l xl:border-t-0" : ""}`}>
                        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">{label}</div>
                        <div className="mt-2 text-[23px] font-semibold tracking-[-0.03em] tabular-nums">{value}</div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section>
                <div className="border-b border-border px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Projection</div>
                  <div className="mt-0.5 text-sm font-semibold">Scénario mensuel</div>
                </div>
                <Table className="min-w-[900px] text-[11px]"><TableHeader className="bg-muted/35"><TableRow><TableHead className="pl-4">Mois</TableHead><TableHead>CA</TableHead><TableHead>TDV</TableHead><TableHead>Cautions</TableHead><TableHead>MAU</TableHead><TableHead>Users inscrits</TableHead><TableHead>Clients</TableHead><TableHead>Encaissements</TableHead><TableHead>Garantie avancée</TableHead></TableRow></TableHeader><TableBody>{simulation.map(row => <TableRow key={rowKey(row.year, row.monthNumber)}><TableCell className="pl-4 font-semibold">{row.month} {row.year}</TableCell><TableCell>{euro(row.revenue, 2)}</TableCell><TableCell>{euro(row.tdv)}</TableCell><TableCell>{integer(row.deposits)}</TableCell><TableCell>{integer(row.activeRenters)}</TableCell><TableCell>{integer(row.registeredUsers)}</TableCell><TableCell>{integer(row.totalClients)}</TableCell><TableCell>{integer(row.depositCashouts)}</TableCell><TableCell>{euro(row.advancedGuarantee)}</TableCell></TableRow>)}</TableBody></Table>
              </section>
            </>
          )}
        </TabsContent>
      </Card>
    </Tabs>
  )
}
