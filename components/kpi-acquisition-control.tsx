"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Plus, RefreshCw, Save, Target, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/kpi-shadcn/ui/progress"

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
const COST_CATEGORIES = [
  ["ads", "Ads / média"],
  ["sales", "Commercial"],
  ["tooling", "Outils / data"],
  ["agency", "Agence / freelance"],
  ["creative", "Créa / contenu"],
  ["other", "Autre"],
] as const

type ValueRow = {
  year: number
  monthNumber: number
  paidLeads: number | null
  organicLeads: number | null
  meetings: number | null
  rentersActivated: number | null
  firstDepositRenters: number | null
  signedRevenue: number | null
  cashCollected: number | null
  paidSpend: number | null
  salesCost: number | null
  toolingCost: number | null
  agencyCost: number | null
  creativeCost: number | null
  otherAcquisitionCost: number | null
  avgClosingDays: number | null
  medianClosingDays: number | null
  avgDealAgeDays: number | null
  oldestOpenDealDays: number | null
  openDealsCount: number | null
  dealsOver40Days: number | null
  dealVelocitySource?: string | null
}

type CampaignRow = {
  id?: string
  year: number
  monthNumber: number
  source: string
  campaign: string
  spend?: number | null
  salesCost?: number | null
  toolingCost?: number | null
  agencyCost?: number | null
  creativeCost?: number | null
  otherCost?: number | null
  leads: number | null
  meetings: number | null
  clients: number | null
  signedRevenue: number | null
  cashCollected: number | null
}

type CostEntry = {
  id?: string
  year: number
  monthNumber: number
  incurredOn: string | null
  category: string
  label: string
  amount: number
  source: string | null
  campaign: string | null
  notes: string | null
}

type TargetRow = {
  id?: string
  year: number
  monthNumber: number
  targetLeads: number | null
  targetMeetings: number | null
  targetClients: number | null
  targetFirstDepositRenters: number | null
  targetSignedRevenue: number | null
  targetCashCollected: number | null
  maxTotalCost: number | null
  maxCac: number | null
  minCashRoi: number | null
  minSignedRoi: number | null
  notes: string | null
}

type CostDraft = Omit<CostEntry, "id">
type CampaignDraft = Omit<CampaignRow, "id" | "spend" | "salesCost" | "toolingCost" | "agencyCost" | "creativeCost" | "otherCost">

function n(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}
function nullableInput(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
function rowKey(year: number, monthNumber: number) {
  return `${year}-${String(monthNumber).padStart(2, "0")}`
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
function percent(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: digits }).format(value)
}
function ratio(top: number, bottom: number) {
  return bottom > 0 ? top / bottom : null
}
function roi(returnValue: number, cost: number) {
  return cost > 0 ? (returnValue - cost) / cost : null
}
function normalized(value: string | null | undefined) {
  return (value || "").trim().toLocaleLowerCase("fr")
}
function legacyCampaignCost(row: CampaignRow) {
  return n(row.spend) + n(row.salesCost) + n(row.toolingCost) + n(row.agencyCost) + n(row.creativeCost) + n(row.otherCost)
}
function legacyMonthCost(row?: ValueRow | null) {
  if (!row) return 0
  return n(row.paidSpend) + n(row.salesCost) + n(row.toolingCost) + n(row.agencyCost) + n(row.creativeCost) + n(row.otherAcquisitionCost)
}
function blankCost(year: number, monthNumber: number): CostDraft {
  return { year, monthNumber, incurredOn: null, category: "ads", label: "", amount: 0, source: null, campaign: null, notes: null }
}
function blankCampaign(year: number, monthNumber: number): CampaignDraft {
  return { year, monthNumber, source: "", campaign: "", leads: null, meetings: null, clients: null, signedRevenue: null, cashCollected: null }
}
function blankTarget(year: number, monthNumber: number): TargetRow {
  return {
    year, monthNumber,
    targetLeads: null, targetMeetings: null, targetClients: null, targetFirstDepositRenters: null,
    targetSignedRevenue: null, targetCashCollected: null, maxTotalCost: null, maxCac: null,
    minCashRoi: null, minSignedRoi: null, notes: null,
  }
}
function targetProgress(actual: number, target: number | null | undefined) {
  if (target == null || target <= 0) return null
  return actual / target
}

export function KpiAcquisitionControl({ canEdit }: { canEdit: boolean }) {
  const [valueRows, setValueRows] = useState<ValueRow[]>([])
  const [campaignRows, setCampaignRows] = useState<CampaignRow[]>([])
  const [costRows, setCostRows] = useState<CostEntry[]>([])
  const [targetRows, setTargetRows] = useState<TargetRow[]>([])
  const [selectedMonth, setSelectedMonth] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [editingTargets, setEditingTargets] = useState(false)

  const now = new Date()
  const initialYear = now.getFullYear()
  const initialMonth = now.getMonth() + 1
  const [costDraft, setCostDraft] = useState<CostDraft>(() => blankCost(initialYear, initialMonth))
  const [campaignDraft, setCampaignDraft] = useState<CampaignDraft>(() => blankCampaign(initialYear, initialMonth))
  const [targetDraft, setTargetDraft] = useState<TargetRow>(() => blankTarget(initialYear, initialMonth))

  async function load() {
    setLoading(true)
    setError("")
    try {
      const [valueResponse, campaignResponse, costResponse, targetResponse] = await Promise.all([
        fetch("/api/kpi/value-funnel", { cache: "no-store" }),
        fetch("/api/kpi/campaigns", { cache: "no-store" }),
        fetch("/api/kpi/acquisition-costs", { cache: "no-store" }),
        fetch("/api/kpi/acquisition-targets", { cache: "no-store" }),
      ])
      const [valueBody, campaignBody, costBody, targetBody] = await Promise.all([
        valueResponse.json(), campaignResponse.json(), costResponse.json(), targetResponse.json(),
      ])
      if (!valueResponse.ok) throw new Error(valueBody.error || "Impossible de charger le funnel.")
      if (!campaignResponse.ok) throw new Error(campaignBody.error || "Impossible de charger les campagnes.")
      if (!costResponse.ok) throw new Error(costBody.error || "Impossible de charger les coûts.")
      if (!targetResponse.ok) throw new Error(targetBody.error || "Impossible de charger les objectifs.")
      setValueRows(Array.isArray(valueBody.rows) ? valueBody.rows : [])
      setCampaignRows(Array.isArray(campaignBody.rows) ? campaignBody.rows : [])
      setCostRows(Array.isArray(costBody.rows) ? costBody.rows : [])
      setTargetRows(Array.isArray(targetBody.rows) ? targetBody.rows : [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de charger le pilotage acquisition.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const monthOptions = useMemo(() => {
    const keys = new Set<string>([rowKey(initialYear, initialMonth)])
    valueRows.forEach(row => keys.add(rowKey(row.year, row.monthNumber)))
    campaignRows.forEach(row => keys.add(rowKey(row.year, row.monthNumber)))
    costRows.forEach(row => keys.add(rowKey(row.year, row.monthNumber)))
    targetRows.forEach(row => keys.add(rowKey(row.year, row.monthNumber)))
    return [...keys].sort().reverse()
  }, [campaignRows, costRows, initialMonth, initialYear, targetRows, valueRows])

  useEffect(() => {
    if (!selectedMonth && monthOptions.length) setSelectedMonth(monthOptions[0])
  }, [monthOptions, selectedMonth])

  const [year, monthNumber] = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number)
    return [y || initialYear, m || initialMonth]
  }, [initialMonth, initialYear, selectedMonth])

  const value = valueRows.find(row => row.year === year && row.monthNumber === monthNumber) || null
  const campaigns = campaignRows.filter(row => row.year === year && row.monthNumber === monthNumber)
  const costs = costRows.filter(row => row.year === year && row.monthNumber === monthNumber)
  const target = targetRows.find(row => row.year === year && row.monthNumber === monthNumber) || blankTarget(year, monthNumber)

  useEffect(() => {
    setCostDraft(blankCost(year, monthNumber))
    setCampaignDraft(blankCampaign(year, monthNumber))
    setTargetDraft({ ...target })
    setEditingTargets(false)
  }, [year, monthNumber, targetRows])

  const actual = useMemo(() => {
    const campaignLeads = campaigns.reduce((sum, row) => sum + n(row.leads), 0)
    const campaignMeetings = campaigns.reduce((sum, row) => sum + n(row.meetings), 0)
    const campaignClients = campaigns.reduce((sum, row) => sum + n(row.clients), 0)
    const campaignSigned = campaigns.reduce((sum, row) => sum + n(row.signedRevenue), 0)
    const campaignCash = campaigns.reduce((sum, row) => sum + n(row.cashCollected), 0)
    return {
      leads: campaigns.length ? campaignLeads : n(value?.paidLeads) + n(value?.organicLeads),
      meetings: campaigns.length ? campaignMeetings : n(value?.meetings),
      clients: campaigns.length ? campaignClients : n(value?.rentersActivated),
      firstDeposits: n(value?.firstDepositRenters),
      signedRevenue: campaigns.length ? campaignSigned : n(value?.signedRevenue),
      cashCollected: campaigns.length ? campaignCash : n(value?.cashCollected),
    }
  }, [campaigns, value])

  const ledgerTotal = costs.reduce((sum, row) => sum + n(row.amount), 0)
  const usesLedger = costs.length > 0
  const totalCost = usesLedger ? ledgerTotal : legacyMonthCost(value)
  const sharedCost = costs.filter(row => !row.campaign).reduce((sum, row) => sum + n(row.amount), 0)
  const linkedCost = ledgerTotal - sharedCost
  const cac = actual.clients > 0 ? totalCost / actual.clients : null
  const cashRoi = roi(actual.cashCollected, totalCost)
  const signedRoi = roi(actual.signedRevenue, totalCost)

  const objectiveCards = [
    { label: "Leads", actual: actual.leads, target: target.targetLeads, format: integer },
    { label: "RDV", actual: actual.meetings, target: target.targetMeetings, format: integer },
    { label: "Clients", actual: actual.clients, target: target.targetClients, format: integer },
    { label: "1res cautions", actual: actual.firstDeposits, target: target.targetFirstDepositRenters, format: integer },
    { label: "CA signé", actual: actual.signedRevenue, target: target.targetSignedRevenue, format: euro },
    { label: "Cash encaissé", actual: actual.cashCollected, target: target.targetCashCollected, format: euro },
  ]

  async function saveCost() {
    if (!costDraft.label.trim() || costDraft.amount < 0) return
    setSaving(true); setError("")
    try {
      const response = await fetch("/api/kpi/acquisition-costs", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...costDraft, year, monthNumber }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Impossible d’enregistrer le coût.")
      setCostRows(Array.isArray(body.rows) ? body.rows : [])
      setCostDraft(blankCost(year, monthNumber))
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Impossible d’enregistrer le coût.") }
    finally { setSaving(false) }
  }

  async function deleteCost(id?: string) {
    if (!id) return
    const response = await fetch("/api/kpi/acquisition-costs", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    const body = await response.json()
    if (response.ok) setCostRows(Array.isArray(body.rows) ? body.rows : [])
  }

  async function saveCampaign() {
    if (!campaignDraft.source.trim() || !campaignDraft.campaign.trim()) return
    setSaving(true); setError("")
    try {
      const response = await fetch("/api/kpi/campaigns", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...campaignDraft, year, monthNumber }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Impossible d’enregistrer la campagne.")
      setCampaignRows(Array.isArray(body.rows) ? body.rows : [])
      setCampaignDraft(blankCampaign(year, monthNumber))
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Impossible d’enregistrer la campagne.") }
    finally { setSaving(false) }
  }

  async function deleteCampaign(id?: string) {
    if (!id) return
    const response = await fetch("/api/kpi/campaigns", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    const body = await response.json()
    if (response.ok) setCampaignRows(Array.isArray(body.rows) ? body.rows : [])
  }

  async function saveTargets() {
    setSaving(true); setError("")
    try {
      const response = await fetch("/api/kpi/acquisition-targets", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...targetDraft, year, monthNumber }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Impossible d’enregistrer les objectifs.")
      setTargetRows(Array.isArray(body.rows) ? body.rows : [])
      setEditingTargets(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Impossible d’enregistrer les objectifs.") }
    finally { setSaving(false) }
  }

  if (loading) return <Skeleton className="h-[720px] w-full rounded-xl" />

  const performanceChecks = [
    { label: "Budget total", value: euro(totalCost), target: target.maxTotalCost, good: target.maxTotalCost == null ? null : totalCost <= target.maxTotalCost, targetText: target.maxTotalCost == null ? "Pas d’objectif" : `≤ ${euro(target.maxTotalCost)}` },
    { label: "CAC complet", value: euro(cac), target: target.maxCac, good: target.maxCac == null || cac == null ? null : cac <= target.maxCac, targetText: target.maxCac == null ? "Pas d’objectif" : `≤ ${euro(target.maxCac)}` },
    { label: "ROI cash", value: percent(cashRoi), target: target.minCashRoi, good: target.minCashRoi == null || cashRoi == null ? null : cashRoi >= target.minCashRoi, targetText: target.minCashRoi == null ? "Pas d’objectif" : `≥ ${percent(target.minCashRoi)}` },
    { label: "ROI signé", value: percent(signedRoi), target: target.minSignedRoi, good: target.minSignedRoi == null || signedRoi == null ? null : signedRoi >= target.minSignedRoi, targetText: target.minSignedRoi == null ? "Pas d’objectif" : `≥ ${percent(target.minSignedRoi)}` },
  ]

  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-2.5">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Acquisition</div>
          <div className="mt-0.5 text-sm font-semibold">Objectifs → coûts → campagnes → ROI</div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-9 w-[175px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{monthOptions.map(month => { const [y, m] = month.split("-").map(Number); return <SelectItem key={month} value={month}>{MONTHS[m - 1]} {y}</SelectItem> })}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => void load()}><RefreshCw size={13} />Actualiser</Button>
        </div>
      </div>
      {error ? <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-2.5 text-xs text-destructive">{error}</div> : null}

      <section className="border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">1 · Objectifs du mois</div><div className="mt-0.5 text-sm font-semibold">Ce que l’acquisition doit produire</div></div>
          {canEdit ? <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setEditingTargets(v => !v)}><Target size={13} />{editingTargets ? "Fermer" : "Définir les objectifs"}</Button> : null}
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-6">
          {objectiveCards.map((item, index) => {
            const progress = targetProgress(item.actual, item.target)
            return <div key={item.label} className={`${index ? "border-t border-border sm:border-l sm:border-t-0" : ""} px-4 py-4`}>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">{item.label}</div>
              <div className="mt-2 flex items-end gap-1.5"><span className="text-xl font-semibold tabular-nums">{item.format(item.actual)}</span><span className="pb-0.5 text-[10px] text-muted-foreground">/ {item.target == null ? "—" : item.format(item.target)}</span></div>
              <Progress className="mt-3 h-1" value={progress == null ? 0 : Math.min(100, Math.max(0, progress * 100))} />
              <div className="mt-1.5 text-[10px] font-medium text-muted-foreground">{progress == null ? "Objectif non défini" : `${percent(progress)} atteint`}</div>
            </div>
          })}
        </div>
        {editingTargets && canEdit ? <div className="border-t border-border bg-muted/20 p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["targetLeads", "Objectif leads", false], ["targetMeetings", "Objectif RDV", false], ["targetClients", "Objectif clients", false], ["targetFirstDepositRenters", "Objectif 1res cautions", false],
              ["targetSignedRevenue", "CA signé cible €", false], ["targetCashCollected", "Cash cible €", false], ["maxTotalCost", "Budget max €", false], ["maxCac", "CAC max €", false],
              ["minCashRoi", "ROI cash min (ex: 0.5)", true], ["minSignedRoi", "ROI signé min (ex: 1)", true],
            ].map(([key, label]) => <Input key={String(key)} className="h-9 text-xs" type="number" step="any" placeholder={String(label)} value={(targetDraft as unknown as Record<string, number | null>)[String(key)] ?? ""} onChange={e => setTargetDraft(current => ({ ...current, [String(key)]: nullableInput(e.target.value) }))} />)}
          </div>
          <div className="mt-3 flex justify-end"><Button size="sm" className="h-9 gap-1.5" disabled={saving} onClick={() => void saveTargets()}>{saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}Enregistrer les objectifs</Button></div>
        </div> : null}
      </section>

      <section className="border-b border-border">
        <div className="border-b border-border px-4 py-3"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">2 · Coûts engagés</div><div className="mt-0.5 text-sm font-semibold">Chaque dépense est ajoutée séparément</div></div>
        <div className="grid sm:grid-cols-4">
          <div className="px-4 py-4"><div className="text-[10px] uppercase text-muted-foreground">Total acquisition</div><div className="mt-1 text-xl font-semibold tabular-nums">{euro(totalCost)}</div><div className="mt-1 text-[10px] text-muted-foreground">{usesLedger ? `${costs.length} dépense${costs.length > 1 ? "s" : ""}` : "Historique legacy"}</div></div>
          <div className="border-t px-4 py-4 sm:border-l sm:border-t-0"><div className="text-[10px] uppercase text-muted-foreground">Rattaché campagnes</div><div className="mt-1 text-xl font-semibold tabular-nums">{euro(linkedCost)}</div></div>
          <div className="border-t px-4 py-4 sm:border-l sm:border-t-0"><div className="text-[10px] uppercase text-muted-foreground">Coûts communs</div><div className="mt-1 text-xl font-semibold tabular-nums">{euro(sharedCost)}</div></div>
          <div className="border-t px-4 py-4 sm:border-l sm:border-t-0"><div className="text-[10px] uppercase text-muted-foreground">Écart budget</div><div className="mt-1 text-xl font-semibold tabular-nums">{target.maxTotalCost == null ? "—" : euro(target.maxTotalCost - totalCost)}</div></div>
        </div>
        <Table className="min-w-[760px] text-[11px]"><TableHeader className="bg-muted/35"><TableRow><TableHead className="pl-4">Dépense</TableHead><TableHead>Catégorie</TableHead><TableHead>Campagne</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Montant</TableHead><TableHead className="w-12" /></TableRow></TableHeader><TableBody>
          {costs.map(row => <TableRow key={row.id}><TableCell className="pl-4"><div className="font-semibold">{row.label}</div>{row.notes ? <div className="text-[10px] text-muted-foreground">{row.notes}</div> : null}</TableCell><TableCell>{COST_CATEGORIES.find(([key]) => key === row.category)?.[1] || row.category}</TableCell><TableCell>{row.campaign ? <><div className="font-medium">{row.campaign}</div><div className="text-[10px] text-muted-foreground">{row.source}</div></> : <Badge variant="secondary" className="text-[9px]">Coût commun</Badge>}</TableCell><TableCell>{row.incurredOn || "—"}</TableCell><TableCell className="text-right font-semibold">{euro(row.amount)}</TableCell><TableCell>{canEdit ? <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void deleteCost(row.id)}><Trash2 size={13} /></Button> : null}</TableCell></TableRow>)}
          {!costs.length ? <TableRow><TableCell colSpan={6} className="h-20 text-center text-muted-foreground">Aucune dépense séparée ce mois-ci. Le calcul conserve le fallback historique s’il existe.</TableCell></TableRow> : null}
        </TableBody></Table>
        {canEdit ? <div className="border-t bg-muted/20 p-3"><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
          <Select value={costDraft.category} onValueChange={category => setCostDraft(current => ({ ...current, category }))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{COST_CATEGORIES.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select>
          <Input className="h-9 text-xs" placeholder="Libellé (ex. Meta Sept.)" value={costDraft.label} onChange={e => setCostDraft(c => ({ ...c, label: e.target.value }))} />
          <Input className="h-9 text-xs" type="number" step="any" placeholder="Montant €" value={costDraft.amount || ""} onChange={e => setCostDraft(c => ({ ...c, amount: n(nullableInput(e.target.value)) }))} />
          <Input className="h-9 text-xs" type="date" value={costDraft.incurredOn || ""} onChange={e => setCostDraft(c => ({ ...c, incurredOn: e.target.value || null }))} />
          <Input className="h-9 text-xs" placeholder="Source (optionnel)" value={costDraft.source || ""} onChange={e => setCostDraft(c => ({ ...c, source: e.target.value || null }))} />
          <Input className="h-9 text-xs" placeholder="Campagne (optionnel)" value={costDraft.campaign || ""} onChange={e => setCostDraft(c => ({ ...c, campaign: e.target.value || null }))} />
          <Button size="sm" className="h-9 gap-1.5" disabled={saving || !costDraft.label.trim()} onClick={() => void saveCost()}><Plus size={13} />Ajouter le coût</Button>
        </div></div> : null}
      </section>

      <section className="border-b border-border">
        <div className="border-b border-border px-4 py-3"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">3 · Campagnes</div><div className="mt-0.5 text-sm font-semibold">On saisit uniquement ce qu’elles produisent</div></div>
        <Table className="min-w-[1080px] text-[11px]"><TableHeader className="bg-muted/35"><TableRow><TableHead className="pl-4">Campagne</TableHead><TableHead>Coût attribué</TableHead><TableHead>Leads</TableHead><TableHead>RDV</TableHead><TableHead>Clients</TableHead><TableHead>CPL</TableHead><TableHead>CAC</TableHead><TableHead>CA signé</TableHead><TableHead>Cash</TableHead><TableHead>ROI cash</TableHead><TableHead className="w-12" /></TableRow></TableHeader><TableBody>
          {campaigns.map(row => {
            const linked = costs.filter(cost => normalized(cost.source) === normalized(row.source) && normalized(cost.campaign) === normalized(row.campaign))
            const campaignCost = linked.length ? linked.reduce((sum, cost) => sum + n(cost.amount), 0) : legacyCampaignCost(row)
            return <TableRow key={row.id || `${row.source}-${row.campaign}`}><TableCell className="pl-4"><div className="font-semibold">{row.campaign}</div><div className="text-[10px] text-muted-foreground">{row.source}</div></TableCell><TableCell className="font-semibold">{euro(campaignCost)}</TableCell><TableCell>{integer(row.leads)}</TableCell><TableCell>{integer(row.meetings)}</TableCell><TableCell>{integer(row.clients)}</TableCell><TableCell>{euro(ratio(campaignCost, n(row.leads)))}</TableCell><TableCell>{euro(ratio(campaignCost, n(row.clients)))}</TableCell><TableCell>{euro(row.signedRevenue)}</TableCell><TableCell className="font-semibold">{euro(row.cashCollected)}</TableCell><TableCell>{percent(roi(n(row.cashCollected), campaignCost))}</TableCell><TableCell>{canEdit ? <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void deleteCampaign(row.id)}><Trash2 size={13} /></Button> : null}</TableCell></TableRow>
          })}
          {!campaigns.length ? <TableRow><TableCell colSpan={11} className="h-20 text-center text-muted-foreground">Aucune campagne renseignée pour ce mois.</TableCell></TableRow> : null}
        </TableBody></Table>
        {canEdit ? <div className="border-t bg-muted/20 p-3"><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-8">
          <Input className="h-9 text-xs" placeholder="Source" value={campaignDraft.source} onChange={e => setCampaignDraft(c => ({ ...c, source: e.target.value }))} />
          <Input className="h-9 text-xs" placeholder="Campagne" value={campaignDraft.campaign} onChange={e => setCampaignDraft(c => ({ ...c, campaign: e.target.value }))} />
          <Input className="h-9 text-xs" type="number" placeholder="Leads" value={campaignDraft.leads ?? ""} onChange={e => setCampaignDraft(c => ({ ...c, leads: nullableInput(e.target.value) }))} />
          <Input className="h-9 text-xs" type="number" placeholder="RDV" value={campaignDraft.meetings ?? ""} onChange={e => setCampaignDraft(c => ({ ...c, meetings: nullableInput(e.target.value) }))} />
          <Input className="h-9 text-xs" type="number" placeholder="Clients" value={campaignDraft.clients ?? ""} onChange={e => setCampaignDraft(c => ({ ...c, clients: nullableInput(e.target.value) }))} />
          <Input className="h-9 text-xs" type="number" placeholder="CA signé €" value={campaignDraft.signedRevenue ?? ""} onChange={e => setCampaignDraft(c => ({ ...c, signedRevenue: nullableInput(e.target.value) }))} />
          <Input className="h-9 text-xs" type="number" placeholder="Cash €" value={campaignDraft.cashCollected ?? ""} onChange={e => setCampaignDraft(c => ({ ...c, cashCollected: nullableInput(e.target.value) }))} />
          <Button size="sm" className="h-9 gap-1.5" disabled={saving || !campaignDraft.source.trim() || !campaignDraft.campaign.trim()} onClick={() => void saveCampaign()}><Plus size={13} />Ajouter</Button>
        </div></div> : null}
      </section>

      <section>
        <div className="border-b border-border px-4 py-3"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">4 · Performance du mois</div><div className="mt-0.5 text-sm font-semibold">Résultat réel et retour sur investissement</div></div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4">
          {performanceChecks.map((item, index) => <div key={item.label} className={`${index ? "border-t sm:border-l sm:border-t-0" : ""} px-4 py-4`}><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">{item.label}</span>{item.good == null ? null : item.good ? <ArrowUpRight size={14} className="text-emerald-600" /> : <ArrowDownRight size={14} className="text-destructive" />}</div><div className="mt-2 text-[22px] font-semibold tabular-nums">{item.value}</div><div className="mt-1 text-[10px] text-muted-foreground">Objectif {item.targetText}</div></div>)}
        </div>
        <div className="grid border-t border-border lg:grid-cols-[1fr_360px]">
          <div className="grid sm:grid-cols-3">
            <div className="px-4 py-4"><div className="text-[10px] uppercase text-muted-foreground">Cash après acquisition</div><div className="mt-1 text-lg font-semibold">{euro(actual.cashCollected - totalCost)}</div></div>
            <div className="border-t px-4 py-4 sm:border-l sm:border-t-0"><div className="text-[10px] uppercase text-muted-foreground">Conversion RDV → client</div><div className="mt-1 text-lg font-semibold">{percent(ratio(actual.clients, actual.meetings))}</div></div>
            <div className="border-t px-4 py-4 sm:border-l sm:border-t-0"><div className="text-[10px] uppercase text-muted-foreground">Coût / RDV</div><div className="mt-1 text-lg font-semibold">{euro(ratio(totalCost, actual.meetings))}</div></div>
          </div>
          <div className="border-t border-border px-4 py-4 lg:border-l lg:border-t-0"><div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground"><AlertTriangle size={12} />Lecture</div><div className="mt-2 text-[11px] leading-5 text-muted-foreground">Le ROI mensuel inclut <strong className="text-foreground">tous les coûts du registre</strong>. Le ROI d’une campagne inclut uniquement ses coûts rattachés. Les coûts communs restent dans le ROI global du mois.</div></div>
        </div>
      </section>
    </Card>
  )
}
