"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, BadgeEuro, Gauge, Plus, Save, Trash2, TrendingUp, WalletCards } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Family = "acquisition" | "transaction" | "risk" | "partners" | "structure"

type CostEntry = {
  id: string
  year: number
  monthNumber: number
  incurredOn: string | null
  family: Family
  category: string
  label: string
  amount: number
  source: string | null
  campaign: string | null
  notes: string | null
}

type Budget = {
  id: string
  year: number
  monthNumber: number
  family: Family
  budgetAmount: number
  notes: string | null
}

type CoreRow = {
  year: number
  monthNumber: number
  revenue: number | null
  tdv: number | null
  deposits: number | null
  activeRenters: number | null
}

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
const FAMILIES: Family[] = ["acquisition", "transaction", "risk", "partners", "structure"]
const FAMILY_LABEL: Record<Family, string> = {
  acquisition: "Acquisition",
  transaction: "Transaction",
  risk: "Risque",
  partners: "Partenaires",
  structure: "Structure",
}
const FAMILY_HELP: Record<Family, string> = {
  acquisition: "Ads, setters, enrichissement, agence",
  transaction: "PSP, open banking, frais de paiement",
  risk: "Pertes, garantie, recouvrement",
  partners: "Revenue share, ERP, affiliation",
  structure: "SaaS, hébergement, juridique, équipe",
}
const CATEGORY_OPTIONS: Record<Family, Array<[string, string]>> = {
  acquisition: [["ads", "Ads / média"], ["sales", "Commercial"], ["tooling", "Outils / data"], ["agency", "Agence / freelance"], ["creative", "Créa / contenu"], ["other", "Autre acquisition"]],
  transaction: [["psp", "PSP / paiement"], ["open_banking", "Open banking"], ["cashout", "Encaissement"], ["chargeback", "Chargeback"], ["other", "Autre transaction"]],
  risk: [["loss", "Perte définitive"], ["guarantee", "Garantie"], ["recovery", "Recouvrement"], ["fraud", "Fraude"], ["other", "Autre risque"]],
  partners: [["revenue_share", "Revenue share"], ["erp", "ERP / intégration"], ["affiliate", "Affiliation"], ["other", "Autre partenaire"]],
  structure: [["saas", "SaaS"], ["hosting", "Hébergement"], ["legal", "Juridique / conformité"], ["team", "Équipe"], ["finance", "Finance / compta"], ["other", "Autre structure"]],
}

function key(year: number, monthNumber: number) {
  return `${year}-${String(monthNumber).padStart(2, "0")}`
}
function n(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
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
function ratio(top: number, bottom: number) {
  return bottom > 0 ? top / bottom : null
}
function monthShift(year: number, monthNumber: number, delta: number) {
  const date = new Date(year, monthNumber - 1 + delta, 1)
  return { year: date.getFullYear(), monthNumber: date.getMonth() + 1 }
}

export function KpiCostControl({ canEdit }: { canEdit: boolean }) {
  const now = new Date()
  const currentKey = key(now.getFullYear(), now.getMonth() + 1)
  const [entries, setEntries] = useState<CostEntry[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [coreRows, setCoreRows] = useState<CoreRow[]>([])
  const [selectedMonth, setSelectedMonth] = useState(currentKey)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [budgetDraft, setBudgetDraft] = useState<Record<Family, string>>({ acquisition: "", transaction: "", risk: "", partners: "", structure: "" })
  const [draft, setDraft] = useState({
    family: "transaction" as Family,
    category: "psp",
    label: "",
    amount: "",
    incurredOn: "",
    source: "",
    campaign: "",
    notes: "",
  })

  async function load() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/kpi/cost-control", { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Impossible de charger les coûts.")
      setEntries(Array.isArray(body.entries) ? body.entries : [])
      setBudgets(Array.isArray(body.budgets) ? body.budgets : [])
      setCoreRows(Array.isArray(body.coreRows) ? body.coreRows : [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de charger les coûts.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const monthOptions = useMemo(() => {
    const keys = new Set<string>([currentKey])
    entries.forEach(row => keys.add(key(row.year, row.monthNumber)))
    budgets.forEach(row => keys.add(key(row.year, row.monthNumber)))
    coreRows.forEach(row => {
      if (row.revenue != null || row.tdv != null || row.deposits != null || row.activeRenters != null) keys.add(key(row.year, row.monthNumber))
    })
    return [...keys].sort().reverse()
  }, [budgets, coreRows, currentKey, entries])

  const [year, monthNumber] = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number)
    return [y || now.getFullYear(), m || now.getMonth() + 1]
  }, [selectedMonth])

  const monthEntries = entries.filter(row => row.year === year && row.monthNumber === monthNumber)
  const core = coreRows.find(row => row.year === year && row.monthNumber === monthNumber) || null
  const previous = monthShift(year, monthNumber, -1)
  const previousEntries = entries.filter(row => row.year === previous.year && row.monthNumber === previous.monthNumber)

  useEffect(() => {
    const next = { acquisition: "", transaction: "", risk: "", partners: "", structure: "" } as Record<Family, string>
    FAMILIES.forEach(family => {
      const row = budgets.find(item => item.year === year && item.monthNumber === monthNumber && item.family === family)
      next[family] = row ? String(row.budgetAmount) : ""
    })
    setBudgetDraft(next)
  }, [budgets, year, monthNumber])

  const summary = useMemo(() => {
    const totalCost = monthEntries.reduce((sum, row) => sum + n(row.amount), 0)
    const totalBudget = FAMILIES.reduce((sum, family) => {
      const row = budgets.find(item => item.year === year && item.monthNumber === monthNumber && item.family === family)
      return sum + n(row?.budgetAmount)
    }, 0)
    const revenue = core?.revenue ?? null
    const tdv = core?.tdv ?? null
    const deposits = core?.deposits ?? null
    const activeRenters = core?.activeRenters ?? null
    return {
      totalCost,
      totalBudget,
      costPerDeposit: deposits && deposits > 0 ? totalCost / deposits : null,
      costPerMau: activeRenters && activeRenters > 0 ? totalCost / activeRenters : null,
      costPer1000Tdv: tdv && tdv > 0 ? (totalCost / tdv) * 1000 : null,
      contributionMargin: revenue != null && revenue > 0 ? (revenue - totalCost) / revenue : null,
      contributionAmount: revenue != null ? revenue - totalCost : null,
    }
  }, [budgets, core, monthEntries, year, monthNumber])

  const familyRows = useMemo(() => FAMILIES.map(family => {
    const actual = monthEntries.filter(row => row.family === family).reduce((sum, row) => sum + n(row.amount), 0)
    const prior = previousEntries.filter(row => row.family === family).reduce((sum, row) => sum + n(row.amount), 0)
    const budget = budgets.find(row => row.year === year && row.monthNumber === monthNumber && row.family === family)?.budgetAmount ?? 0
    return {
      family,
      actual,
      budget,
      variance: actual - budget,
      shareRevenue: core?.revenue && core.revenue > 0 ? actual / core.revenue : null,
      costPerDeposit: core?.deposits && core.deposits > 0 ? actual / core.deposits : null,
      costPerMau: core?.activeRenters && core.activeRenters > 0 ? actual / core.activeRenters : null,
      trend: prior > 0 ? (actual - prior) / prior : null,
    }
  }), [budgets, core, monthEntries, previousEntries, year, monthNumber])

  const history = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => monthShift(year, monthNumber, index - 5)).map(period => {
      const actual = entries.filter(row => row.year === period.year && row.monthNumber === period.monthNumber).reduce((sum, row) => sum + n(row.amount), 0)
      const budget = budgets.filter(row => row.year === period.year && row.monthNumber === period.monthNumber).reduce((sum, row) => sum + n(row.budgetAmount), 0)
      const periodKey = key(period.year, period.monthNumber)
      let forecast = actual
      if (periodKey === currentKey) {
        const daysInMonth = new Date(period.year, period.monthNumber, 0).getDate()
        forecast = now.getDate() > 0 ? actual / now.getDate() * daysInMonth : actual
      }
      return { ...period, actual, budget, forecast, variance: forecast - budget }
    })
  }, [budgets, currentKey, entries, year, monthNumber])

  const largestFamily = [...familyRows].sort((a, b) => b.actual - a.actual)[0]
  const overBudget = familyRows.filter(row => row.budget > 0 && row.actual > row.budget)

  async function saveBudgets() {
    setSaving(true)
    setError("")
    try {
      const requests = FAMILIES.map(async family => {
        const budgetAmount = Number(budgetDraft[family] || 0)
        const response = await fetch("/api/kpi/cost-control", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "budget", year, monthNumber, family, budgetAmount }),
        })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || "Impossible d’enregistrer le budget.")
        return body
      })
      const results = await Promise.all(requests)
      const latest = results[results.length - 1]
      setEntries(Array.isArray(latest.entries) ? latest.entries : [])
      setBudgets(Array.isArray(latest.budgets) ? latest.budgets : [])
      setCoreRows(Array.isArray(latest.coreRows) ? latest.coreRows : [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’enregistrer le budget.")
    } finally {
      setSaving(false)
    }
  }

  async function saveEntry() {
    const amount = Number(draft.amount)
    if (!draft.label.trim() || !draft.category || !Number.isFinite(amount) || amount < 0) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/kpi/cost-control", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "entry",
          year,
          monthNumber,
          family: draft.family,
          category: draft.category,
          label: draft.label,
          amount,
          incurredOn: draft.incurredOn || null,
          source: draft.source || null,
          campaign: draft.campaign || null,
          notes: draft.notes || null,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Impossible d’enregistrer la dépense.")
      setEntries(Array.isArray(body.entries) ? body.entries : [])
      setBudgets(Array.isArray(body.budgets) ? body.budgets : [])
      setCoreRows(Array.isArray(body.coreRows) ? body.coreRows : [])
      setDraft({ ...draft, label: "", amount: "", incurredOn: "", source: "", campaign: "", notes: "" })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’enregistrer la dépense.")
    } finally {
      setSaving(false)
    }
  }

  async function deleteEntry(id: string) {
    const response = await fetch("/api/kpi/cost-control", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    const body = await response.json()
    if (!response.ok) return setError(body.error || "Impossible de supprimer la dépense.")
    setEntries(Array.isArray(body.entries) ? body.entries : [])
    setBudgets(Array.isArray(body.budgets) ? body.budgets : [])
    setCoreRows(Array.isArray(body.coreRows) ? body.coreRows : [])
  }

  if (loading) return <Skeleton className="h-[820px] w-full rounded-xl" />

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error}</div> : null}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Cost Control</div>
            <div className="mt-0.5 text-sm font-semibold">Comprendre où part chaque euro et combien il coûte à l’unité.</div>
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{monthOptions.map(value => { const [y, m] = value.split("-").map(Number); return <SelectItem key={value} value={value}>{MONTHS[m - 1]} {y}</SelectItem> })}</SelectContent>
          </Select>
        </div>
        <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-5">
          {[
            ["Coûts réels", euro(summary.totalCost), summary.totalBudget > 0 ? `Budget ${euro(summary.totalBudget)}` : "Budget à définir"],
            ["Coût / caution", euro(summary.costPerDeposit, 2), `${integer(core?.deposits)} cautions`],
            ["Coût / MAU", euro(summary.costPerMau, 2), `${integer(core?.activeRenters)} loueurs actifs`],
            ["Coût / 1 000 €", euro(summary.costPer1000Tdv, 2), `${euro(core?.tdv)} sécurisés`],
            ["Marge contributive", percent(summary.contributionMargin), summary.contributionAmount == null ? "CA manquant" : euro(summary.contributionAmount)],
          ].map(([label, value, detail]) => (
            <div key={label} className="px-4 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">{label}</div>
              <div className="mt-2 text-[23px] font-semibold tracking-[-0.03em] tabular-nums">{value}</div>
              <div className="mt-1 text-[10px] font-medium text-muted-foreground">{detail}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.35fr)]">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <WalletCards className="size-4 text-primary" />
            <div>
              <div className="text-sm font-semibold">Budget vs réel par famille</div>
              <div className="text-[10px] text-muted-foreground">Chaque poste est ramené aux unités économiques Gando.</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Poste</TableHead><TableHead className="text-right">Budget</TableHead><TableHead className="text-right">Réel</TableHead><TableHead className="text-right">Écart</TableHead><TableHead className="text-right">% CA</TableHead><TableHead className="text-right">€/caution</TableHead><TableHead className="text-right">€/MAU</TableHead><TableHead className="text-right">Tendance</TableHead></TableRow></TableHeader>
              <TableBody>
                {familyRows.map(row => (
                  <TableRow key={row.family}>
                    <TableCell><div className="font-semibold">{FAMILY_LABEL[row.family]}</div><div className="text-[9px] text-muted-foreground">{FAMILY_HELP[row.family]}</div></TableCell>
                    <TableCell className="text-right tabular-nums">{row.budget > 0 ? euro(row.budget) : "—"}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{euro(row.actual)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${row.budget > 0 && row.variance > 0 ? "text-destructive" : ""}`}>{row.budget > 0 ? `${row.variance > 0 ? "+" : ""}${euro(row.variance)}` : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{percent(row.shareRevenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{euro(row.costPerDeposit, 2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{euro(row.costPerMau, 2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.trend == null ? "—" : `${row.trend > 0 ? "+" : ""}${percent(row.trend)}`}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3"><Gauge className="size-4 text-primary" /><div className="text-sm font-semibold">Diagnostic</div></div>
          <div className="divide-y divide-border">
            <div className="px-4 py-3"><div className="text-[10px] text-muted-foreground">Premier poste de coût</div><div className="mt-1 text-sm font-semibold">{largestFamily ? FAMILY_LABEL[largestFamily.family] : "—"}</div><div className="text-[10px] text-muted-foreground">{largestFamily ? euro(largestFamily.actual) : "Aucune dépense"}</div></div>
            <div className="px-4 py-3"><div className="text-[10px] text-muted-foreground">Budget</div><div className="mt-1 text-sm font-semibold">{summary.totalBudget > 0 ? `${summary.totalCost > summary.totalBudget ? "+" : ""}${euro(summary.totalCost - summary.totalBudget)}` : "À définir"}</div><div className="text-[10px] text-muted-foreground">écart réel vs budget</div></div>
            <div className="px-4 py-3"><div className="text-[10px] text-muted-foreground">Postes en dépassement</div><div className="mt-1 text-sm font-semibold">{overBudget.length}</div><div className="text-[10px] text-muted-foreground">sur {FAMILIES.length} familles</div></div>
            {overBudget.length ? <div className="flex gap-2 px-4 py-3 text-[10px] leading-4 text-destructive"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /><span>{overBudget.map(row => FAMILY_LABEL[row.family]).join(", ")} dépassent leur budget.</span></div> : null}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2"><TrendingUp className="size-4 text-primary" /><div><div className="text-sm font-semibold">Budget vs réel vs forecast</div><div className="text-[10px] text-muted-foreground">Le mois en cours est projeté au rythme de dépenses actuel.</div></div></div>
        </div>
        <div className="overflow-x-auto">
          <Table><TableHeader><TableRow><TableHead>Mois</TableHead><TableHead className="text-right">Budget</TableHead><TableHead className="text-right">Réel</TableHead><TableHead className="text-right">Forecast</TableHead><TableHead className="text-right">Écart prévu</TableHead></TableRow></TableHeader><TableBody>
            {history.map(row => <TableRow key={key(row.year, row.monthNumber)}><TableCell className="font-medium">{MONTHS[row.monthNumber - 1]} {row.year}</TableCell><TableCell className="text-right tabular-nums">{row.budget > 0 ? euro(row.budget) : "—"}</TableCell><TableCell className="text-right tabular-nums">{euro(row.actual)}</TableCell><TableCell className="text-right font-semibold tabular-nums">{euro(row.forecast)}</TableCell><TableCell className={`text-right tabular-nums ${row.budget > 0 && row.variance > 0 ? "text-destructive" : ""}`}>{row.budget > 0 ? `${row.variance > 0 ? "+" : ""}${euro(row.variance)}` : "—"}</TableCell></TableRow>)}
          </TableBody></Table>
        </div>
      </Card>

      {canEdit ? <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><div className="text-sm font-semibold">Budgets du mois</div><div className="text-[10px] text-muted-foreground">Fixe la limite avant de dépenser.</div></div><Button size="sm" className="h-8 gap-1.5" onClick={() => void saveBudgets()} disabled={saving}><Save className="size-3.5" /> Enregistrer</Button></div>
          <div className="divide-y divide-border">
            {FAMILIES.map(family => <div key={family} className="grid grid-cols-[1fr_140px] items-center gap-3 px-4 py-3"><div><div className="text-[11px] font-semibold">{FAMILY_LABEL[family]}</div><div className="text-[9px] text-muted-foreground">{FAMILY_HELP[family]}</div></div><Input type="number" min="0" step="1" value={budgetDraft[family]} onChange={event => setBudgetDraft(current => ({ ...current, [family]: event.target.value }))} placeholder="0 €" className="h-8 text-right text-xs" /></div>)}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3"><div className="text-sm font-semibold">Ajouter une dépense</div><div className="text-[10px] text-muted-foreground">Une dépense = une famille + une catégorie + un montant.</div></div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Select value={draft.family} onValueChange={value => { const family = value as Family; setDraft(current => ({ ...current, family, category: CATEGORY_OPTIONS[family][0][0] })) }}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{FAMILIES.map(family => <SelectItem key={family} value={family}>{FAMILY_LABEL[family]}</SelectItem>)}</SelectContent></Select>
            <Select value={draft.category} onValueChange={category => setDraft(current => ({ ...current, category }))}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{CATEGORY_OPTIONS[draft.family].map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
            <Input value={draft.label} onChange={event => setDraft(current => ({ ...current, label: event.target.value }))} placeholder="Ex. Stripe août" className="h-9" />
            <Input type="number" min="0" step="0.01" value={draft.amount} onChange={event => setDraft(current => ({ ...current, amount: event.target.value }))} placeholder="Montant €" className="h-9" />
            <Input type="date" value={draft.incurredOn} onChange={event => setDraft(current => ({ ...current, incurredOn: event.target.value }))} className="h-9" />
            <Input value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} placeholder="Note / détail" className="h-9" />
            {draft.family === "acquisition" ? <><Input value={draft.source} onChange={event => setDraft(current => ({ ...current, source: event.target.value }))} placeholder="Source" className="h-9" /><Input value={draft.campaign} onChange={event => setDraft(current => ({ ...current, campaign: event.target.value }))} placeholder="Campagne" className="h-9" /></> : null}
            <div className="sm:col-span-2"><Button className="h-9 gap-1.5" onClick={() => void saveEntry()} disabled={saving || !draft.label.trim() || !draft.amount}><Plus className="size-3.5" /> Ajouter au ledger</Button></div>
          </div>
        </Card>
      </div> : null}

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3"><BadgeEuro className="size-4 text-primary" /><div><div className="text-sm font-semibold">Ledger du mois</div><div className="text-[10px] text-muted-foreground">La source unique utilisée pour calculer les coûts.</div></div><Badge variant="secondary" className="ml-auto text-[9px]">{monthEntries.length} lignes</Badge></div>
        <div className="overflow-x-auto">
          <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Famille</TableHead><TableHead>Catégorie</TableHead><TableHead>Dépense</TableHead><TableHead className="text-right">Montant</TableHead>{canEdit ? <TableHead className="w-12" /> : null}</TableRow></TableHeader><TableBody>
            {monthEntries.length ? monthEntries.map(row => <TableRow key={row.id}><TableCell className="text-xs text-muted-foreground">{row.incurredOn || "—"}</TableCell><TableCell><Badge variant="outline" className="text-[9px]">{FAMILY_LABEL[row.family]}</Badge></TableCell><TableCell className="text-xs">{CATEGORY_OPTIONS[row.family].find(([value]) => value === row.category)?.[1] || row.category}</TableCell><TableCell><div className="text-xs font-medium">{row.label}</div>{row.notes ? <div className="text-[9px] text-muted-foreground">{row.notes}</div> : null}</TableCell><TableCell className="text-right font-semibold tabular-nums">{euro(row.amount, 2)}</TableCell>{canEdit ? <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void deleteEntry(row.id)}><Trash2 className="size-3.5" /></Button></TableCell> : null}</TableRow>) : <TableRow><TableCell colSpan={canEdit ? 6 : 5} className="h-24 text-center text-xs text-muted-foreground">Aucune dépense enregistrée pour ce mois.</TableCell></TableRow>}
          </TableBody></Table>
        </div>
      </Card>
    </div>
  )
}
