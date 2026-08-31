"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Pencil, Plus, RefreshCw, Save, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/kpi-shadcn/ui/progress"

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

type CoreKpiRow = {
  year: number
  monthNumber: number
  revenue: number | null
  tdv: number | null
  deposits: number | null
  activeRenters: number | null
  churnRate: number | null
}

type ValueRow = {
  id?: string
  year: number
  monthNumber: number
  prospectsContacted: number | null
  callsMade: number | null
  meetings: number | null
  rentersRegistered: number | null
  rentersActivated: number | null
  firstDepositRenters: number | null
  paidSpend: number | null
  salesCost: number | null
  toolingCost: number | null
  agencyCost: number | null
  creativeCost: number | null
  otherAcquisitionCost: number | null
  paidLeads: number | null
  organicLeads: number | null
  signedRevenue: number | null
  cashCollected: number | null
  mrr: number | null
  refunds: number | null
  netMargin: number | null
  avgClosingDays: number | null
  medianClosingDays: number | null
  avgDealAgeDays: number | null
  oldestOpenDealDays: number | null
  openDealsCount: number | null
  dealsOver40Days: number | null
  decisionsTaken: number | null
}

type CampaignRow = {
  id?: string
  year: number
  monthNumber: number
  source: string
  campaign: string
  spend: number | null
  salesCost: number | null
  toolingCost: number | null
  agencyCost: number | null
  creativeCost: number | null
  otherCost: number | null
  leads: number | null
  meetings: number | null
  clients: number | null
  signedRevenue: number | null
  cashCollected: number | null
}

type NumericKey = Exclude<keyof ValueRow, "id" | "year" | "monthNumber">

const VALUE_FIELDS: Array<{ key: NumericKey; label: string; group: string; euro?: boolean; days?: boolean }> = [
  { key: "prospectsContacted", label: "Prospects contactés", group: "Acquisition" },
  { key: "callsMade", label: "Appels réalisés", group: "Acquisition" },
  { key: "meetings", label: "RDV qualifiés", group: "Acquisition" },
  { key: "paidLeads", label: "Leads paid", group: "Acquisition" },
  { key: "organicLeads", label: "Leads organiques", group: "Acquisition" },
  { key: "paidSpend", label: "Budget média / Ads", group: "Coûts acquisition", euro: true },
  { key: "salesCost", label: "Coût commercial", group: "Coûts acquisition", euro: true },
  { key: "toolingCost", label: "Outils / data", group: "Coûts acquisition", euro: true },
  { key: "agencyCost", label: "Agence / freelance", group: "Coûts acquisition", euro: true },
  { key: "creativeCost", label: "Création de contenu", group: "Coûts acquisition", euro: true },
  { key: "otherAcquisitionCost", label: "Autres coûts acquisition", group: "Coûts acquisition", euro: true },
  { key: "rentersRegistered", label: "Loueurs inscrits", group: "Activation" },
  { key: "rentersActivated", label: "Loueurs activés", group: "Activation" },
  { key: "firstDepositRenters", label: "Loueurs avec 1re caution", group: "Activation" },
  { key: "signedRevenue", label: "CA signé", group: "Finance", euro: true },
  { key: "cashCollected", label: "Cash encaissé", group: "Finance", euro: true },
  { key: "mrr", label: "MRR", group: "Finance", euro: true },
  { key: "refunds", label: "Remboursements", group: "Finance", euro: true },
  { key: "netMargin", label: "Marge nette Gando", group: "Finance", euro: true },
  { key: "avgClosingDays", label: "Closing moyen", group: "Temps des deals", days: true },
  { key: "medianClosingDays", label: "Closing médian", group: "Temps des deals", days: true },
  { key: "avgDealAgeDays", label: "Âge moyen deals ouverts", group: "Temps des deals", days: true },
  { key: "oldestOpenDealDays", label: "Plus vieux deal ouvert", group: "Temps des deals", days: true },
  { key: "openDealsCount", label: "Deals ouverts", group: "Temps des deals" },
  { key: "dealsOver40Days", label: "Deals > 40 jours", group: "Temps des deals" },
  { key: "decisionsTaken", label: "Décisions prises grâce aux KPI", group: "Pilotage" },
]

function blankValue(year: number, monthNumber: number): ValueRow {
  return {
    year,
    monthNumber,
    prospectsContacted: null,
    callsMade: null,
    meetings: null,
    rentersRegistered: null,
    rentersActivated: null,
    firstDepositRenters: null,
    paidSpend: null,
    salesCost: null,
    toolingCost: null,
    agencyCost: null,
    creativeCost: null,
    otherAcquisitionCost: null,
    paidLeads: null,
    organicLeads: null,
    signedRevenue: null,
    cashCollected: null,
    mrr: null,
    refunds: null,
    netMargin: null,
    avgClosingDays: null,
    medianClosingDays: null,
    avgDealAgeDays: null,
    oldestOpenDealDays: null,
    openDealsCount: null,
    dealsOver40Days: null,
    decisionsTaken: null,
  }
}

function blankCampaign(year: number, monthNumber: number): CampaignRow {
  return {
    year,
    monthNumber,
    source: "",
    campaign: "",
    spend: null,
    salesCost: null,
    toolingCost: null,
    agencyCost: null,
    creativeCost: null,
    otherCost: null,
    leads: null,
    meetings: null,
    clients: null,
    signedRevenue: null,
    cashCollected: null,
  }
}

function rowKey(year: number, monthNumber: number) {
  return `${year}-${String(monthNumber).padStart(2, "0")}`
}

function n(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function ratio(top: number | null | undefined, bottom: number | null | undefined) {
  const b = n(bottom)
  return b > 0 ? n(top) / b : null
}

function roi(returnValue: number | null | undefined, cost: number | null | undefined) {
  const c = n(cost)
  return c > 0 ? (n(returnValue) - c) / c : null
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

function campaignTotalCost(row: CampaignRow) {
  return n(row.spend) + n(row.salesCost) + n(row.toolingCost) + n(row.agencyCost) + n(row.creativeCost) + n(row.otherCost)
}

export function KpiFunnelShadcn({ canEdit }: { canEdit: boolean }) {
  const [coreRows, setCoreRows] = useState<CoreKpiRow[]>([])
  const [valueRows, setValueRows] = useState<ValueRow[]>([])
  const [campaignRows, setCampaignRows] = useState<CampaignRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedMonth, setSelectedMonth] = useState("")
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<ValueRow | null>(null)
  const [campaignDraft, setCampaignDraft] = useState<CampaignRow>(() => blankCampaign(new Date().getFullYear(), new Date().getMonth() + 1))

  async function load() {
    setLoading(true)
    setError("")
    try {
      const [coreResponse, valueResponse, campaignResponse] = await Promise.all([
        fetch("/api/kpi", { cache: "no-store" }),
        fetch("/api/kpi/value-funnel", { cache: "no-store" }),
        fetch("/api/kpi/campaigns", { cache: "no-store" }),
      ])
      const [coreBody, valueBody, campaignBody] = await Promise.all([
        coreResponse.json(),
        valueResponse.json(),
        campaignResponse.json(),
      ])
      if (!coreResponse.ok) throw new Error(coreBody.error || "Impossible de charger les KPI business.")
      if (!valueResponse.ok) throw new Error(valueBody.error || "Impossible de charger le funnel KPI.")
      if (!campaignResponse.ok) throw new Error(campaignBody.error || "Impossible de charger les campagnes.")
      setCoreRows(Array.isArray(coreBody.rows) ? coreBody.rows : [])
      setValueRows(Array.isArray(valueBody.rows) ? valueBody.rows : [])
      setCampaignRows(Array.isArray(campaignBody.rows) ? campaignBody.rows : [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de charger les KPI.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const monthOptions = useMemo(() => {
    const keys = new Set<string>()
    coreRows.forEach(row => keys.add(rowKey(row.year, row.monthNumber)))
    valueRows.forEach(row => keys.add(rowKey(row.year, row.monthNumber)))
    const now = new Date()
    keys.add(rowKey(now.getFullYear(), now.getMonth() + 1))
    return [...keys].sort().reverse()
  }, [coreRows, valueRows])

  useEffect(() => {
    if (selectedMonth || !monthOptions.length) return
    const filled = [...valueRows]
      .filter(row => VALUE_FIELDS.some(field => row[field.key] != null))
      .sort((a, b) => (b.year * 12 + b.monthNumber) - (a.year * 12 + a.monthNumber))
    setSelectedMonth(filled[0] ? rowKey(filled[0].year, filled[0].monthNumber) : monthOptions[0])
  }, [monthOptions, selectedMonth, valueRows])

  const [year, monthNumber] = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number)
    return [y || new Date().getFullYear(), m || new Date().getMonth() + 1]
  }, [selectedMonth])

  const core = coreRows.find(row => row.year === year && row.monthNumber === monthNumber) || null
  const value = valueRows.find(row => row.year === year && row.monthNumber === monthNumber) || blankValue(year, monthNumber)
  const campaigns = campaignRows.filter(row => row.year === year && row.monthNumber === monthNumber)

  useEffect(() => {
    setDraft({ ...value })
    setCampaignDraft(blankCampaign(year, monthNumber))
  }, [year, monthNumber, valueRows])

  const derived = useMemo(() => {
    const totalLeads = n(value.paidLeads) + n(value.organicLeads)
    const acquisitionCost = n(value.paidSpend) + n(value.salesCost) + n(value.toolingCost) + n(value.agencyCost) + n(value.creativeCost) + n(value.otherAcquisitionCost)
    const cac = n(value.rentersActivated) > 0 ? acquisitionCost / n(value.rentersActivated) : null
    const arpu = ratio(core?.revenue, core?.activeRenters)
    const churn = n(core?.churnRate)
    const lifetimeMonths = churn > 0 ? Math.min(24, 1 / churn) : 24
    const ltv24 = arpu == null ? null : arpu * lifetimeMonths
    const ltvCac = ltv24 != null && cac != null && cac > 0 ? ltv24 / cac : null
    const collectionRate = ratio(value.cashCollected, value.signedRevenue)
    const marginRate = ratio(value.netMargin, core?.revenue)
    const organicShare = totalLeads > 0 ? n(value.organicLeads) / totalLeads : null
    return {
      totalLeads,
      acquisitionCost,
      cplPaid: ratio(value.paidSpend, value.paidLeads),
      cac,
      arpu,
      ltv24,
      ltvCac,
      closingRate: ratio(value.rentersActivated, value.meetings),
      collectionRate,
      takeRate: ratio(core?.revenue, core?.tdv),
      marginRate,
      organicShare,
      cashRoi: roi(value.cashCollected, acquisitionCost),
      signedRoi: roi(value.signedRevenue, acquisitionCost),
      cashAfterAcquisition: n(value.cashCollected) - acquisitionCost,
      staleDealShare: ratio(value.dealsOver40Days, value.openDealsCount),
    }
  }, [value, core])

  const alerts = useMemo(() => {
    const items: string[] = []
    if (derived.ltvCac != null && derived.ltvCac < 3) items.push(`LTV / CAC à ${decimal(derived.ltvCac, 1)}× : sous le repère 3×.`)
    if (n(value.avgDealAgeDays) > 40) items.push(`Âge moyen des deals ouverts : ${decimal(value.avgDealAgeDays, 0)} jours.`)
    if (n(value.oldestOpenDealDays) > 40) items.push(`Le plus vieux deal ouvert a ${decimal(value.oldestOpenDealDays, 0)} jours.`)
    if (n(value.dealsOver40Days) > 0) items.push(`${integer(value.dealsOver40Days)} deal(s) ont plus de 40 jours.`)
    if (derived.collectionRate != null && derived.collectionRate < 0.9) items.push(`Seulement ${percent(derived.collectionRate)} du CA signé est encaissé.`)
    if (derived.cashRoi != null && derived.cashRoi < 0) items.push(`ROI cash négatif : ${percent(derived.cashRoi)} après coûts d’acquisition.`)
    if (derived.organicShare != null && derived.organicShare < 0.2 && n(value.paidLeads) > 0) items.push(`Dépendance paid élevée : ${percent(1 - derived.organicShare)} des leads viennent du paid.`)
    if (derived.marginRate != null && derived.marginRate < 0) items.push("Marge nette négative sur le mois.")
    return items
  }, [derived, value])

  async function saveValue() {
    if (!draft) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/kpi/value-funnel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Impossible d’enregistrer.")
      setValueRows(Array.isArray(body.rows) ? body.rows : [])
      setEditing(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’enregistrer.")
    } finally {
      setSaving(false)
    }
  }

  async function saveCampaign() {
    if (!campaignDraft.source.trim() || !campaignDraft.campaign.trim()) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/kpi/campaigns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...campaignDraft, year, monthNumber }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Impossible d’enregistrer la campagne.")
      setCampaignRows(Array.isArray(body.rows) ? body.rows : [])
      setCampaignDraft(blankCampaign(year, monthNumber))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’enregistrer la campagne.")
    } finally {
      setSaving(false)
    }
  }

  async function deleteCampaign(id?: string) {
    if (!id) return
    const response = await fetch("/api/kpi/campaigns", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    const body = await response.json()
    if (response.ok) setCampaignRows(Array.isArray(body.rows) ? body.rows : [])
  }

  if (loading) return <Skeleton className="h-[680px] w-full rounded-xl" />

  const funnelSteps = [
    { label: "Prospects", value: value.prospectsContacted, previous: null },
    { label: "RDV", value: value.meetings, previous: value.prospectsContacted },
    { label: "Inscrits", value: value.rentersRegistered, previous: value.meetings },
    { label: "Activés", value: value.rentersActivated, previous: value.rentersRegistered },
    { label: "1re caution", value: value.firstDepositRenters, previous: value.rentersActivated },
  ]

  const economics = [
    { label: "Coût acquisition total", value: euro(derived.acquisitionCost), detail: "Ads + commercial + outils + agence + créa + autres" },
    { label: "CAC complet", value: euro(derived.cac), detail: "Tous les coûts / loueur activé" },
    { label: "ROI cash", value: percent(derived.cashRoi), detail: `${euro(derived.cashAfterAcquisition)} après acquisition` },
    { label: "ROI CA signé", value: percent(derived.signedRoi), detail: `${euro(value.signedRevenue)} de CA signé` },
    { label: "LTV / CAC", value: derived.ltvCac == null ? "—" : `${decimal(derived.ltvCac, 1)}×`, detail: "Repère : > 3×" },
    { label: "CA signé → cash", value: percent(derived.collectionRate), detail: `${euro(value.cashCollected)} encaissés` },
  ]

  const costBreakdown = [
    ["Ads / média", value.paidSpend],
    ["Commercial", value.salesCost],
    ["Outils / data", value.toolingCost],
    ["Agence", value.agencyCost],
    ["Créa / contenu", value.creativeCost],
    ["Autres", value.otherAcquisitionCost],
  ] as const

  const dealVelocity = [
    ["Closing moyen", value.avgClosingDays == null ? "—" : `${decimal(value.avgClosingDays)} j`],
    ["Closing médian", value.medianClosingDays == null ? "—" : `${decimal(value.medianClosingDays)} j`],
    ["Âge moyen ouverts", value.avgDealAgeDays == null ? "—" : `${decimal(value.avgDealAgeDays)} j`],
    ["Plus vieux deal", value.oldestOpenDealDays == null ? "—" : `${decimal(value.oldestOpenDealDays)} j`],
    ["Deals ouverts", integer(value.openDealsCount)],
    ["> 40 jours", `${integer(value.dealsOver40Days)}${derived.staleDealShare == null ? "" : ` · ${percent(derived.staleDealShare)}`}`],
  ] as const

  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-6 text-[10px] font-semibold">Funnel business</Badge>
          <span className="text-[11px] text-muted-foreground">Acquisition → activation → valeur → ROI</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-9 w-[175px] text-xs"><SelectValue placeholder="Choisir un mois" /></SelectTrigger>
            <SelectContent>
              {monthOptions.map(month => {
                const [y, m] = month.split("-").map(Number)
                return <SelectItem key={month} value={month}>{MONTHS[m - 1]} {y}</SelectItem>
              })}
            </SelectContent>
          </Select>
          {canEdit ? <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setEditing(current => !current)}><Pencil size={14} />{editing ? "Fermer" : "Saisir"}</Button> : null}
        </div>
      </div>

      {error ? <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-2.5 text-xs text-destructive">{error}</div> : null}

      <section className="border-b border-border">
        <div className="border-b border-border px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Économie</div>
          <div className="mt-0.5 text-sm font-semibold">Unit economics réels du mois</div>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3">
          {economics.map((item, index) => (
            <div key={item.label} className={`px-4 py-4 ${index ? "border-t border-border sm:border-l sm:border-t-0" : ""} ${index === 2 ? "sm:border-l-0 sm:border-t xl:border-l xl:border-t-0" : ""} ${index >= 3 ? "xl:border-t" : ""}`}>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">{item.label}</div>
              <div className="mt-2 text-[22px] font-semibold tracking-[-0.03em] tabular-nums">{item.value}</div>
              <div className="mt-1.5 text-[11px] font-medium text-muted-foreground">{item.detail}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-border">
        <div className="border-b border-border px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Coûts</div>
          <div className="mt-0.5 text-sm font-semibold">Ce que l’acquisition nous a réellement coûté</div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {costBreakdown.map(([label, amount], index) => (
            <div key={label} className={`${index ? "border-t border-border sm:border-l sm:border-t-0" : ""} px-4 py-3`}>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">{label}</div>
              <div className="mt-1.5 text-lg font-semibold tabular-nums">{euro(amount)}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid border-b border-border xl:grid-cols-[minmax(0,1.45fr)_minmax(310px,0.55fr)]">
        <section className="min-w-0 xl:border-r xl:border-border">
          <div className="border-b border-border px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Conversion</div>
            <div className="mt-0.5 text-sm font-semibold">Funnel commercial & activation</div>
          </div>
          <div className="grid md:grid-cols-5">
            {funnelSteps.map((step, index) => {
              const conversion = index === 0 ? null : ratio(step.value, step.previous)
              return (
                <div key={step.label} className={`${index ? "border-t border-border md:border-l md:border-t-0" : ""} px-4 py-4`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">{step.label}</span>
                    {conversion != null ? <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{percent(conversion)}</span> : null}
                  </div>
                  <div className="mt-2 text-[22px] font-semibold tabular-nums">{integer(step.value)}</div>
                  {conversion != null ? <Progress className="mt-3 h-1" value={Math.max(0, Math.min(100, conversion * 100))} /> : <div className="mt-3 h-1" />}
                </div>
              )
            })}
          </div>
        </section>

        <section>
          <div className="border-b border-border px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Vélocité</div>
            <div className="mt-0.5 text-sm font-semibold">Temps des deals</div>
          </div>
          <div className="grid grid-cols-2">
            {dealVelocity.map(([label, metric], index) => (
              <div key={label} className={`${index % 2 ? "border-l border-border" : ""} ${index >= 2 ? "border-t border-border" : ""} px-3 py-3`}>
                <div className="text-[10px] text-muted-foreground">{label}</div>
                <div className="mt-1 text-sm font-semibold tabular-nums">{metric}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="border-b border-border">
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
          <AlertTriangle className="size-3.5 text-amber-500" />
          <span className="text-sm font-semibold">À surveiller</span>
        </div>
        <div className="grid divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
          {alerts.length ? alerts.slice(0, 6).map(alert => <div key={alert} className="px-4 py-3 text-[11px] leading-4 text-amber-800 dark:text-amber-200">{alert}</div>) : <div className="px-4 py-4 text-[11px] text-muted-foreground">Aucun signal critique avec les données disponibles.</div>}
        </div>
      </section>

      <section className="border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Attribution</div>
            <div className="mt-0.5 text-sm font-semibold">Campagnes → coût complet → cash → ROI</div>
          </div>
          <span className="text-[11px] text-muted-foreground">{campaigns.length} campagne{campaigns.length > 1 ? "s" : ""}</span>
        </div>
        <Table className="min-w-[1120px] text-[11px]">
          <TableHeader className="bg-muted/35">
            <TableRow>
              <TableHead className="pl-4">Campagne</TableHead>
              <TableHead>Média</TableHead>
              <TableHead>Coût total</TableHead>
              <TableHead>Leads</TableHead>
              <TableHead>RDV</TableHead>
              <TableHead>Clients</TableHead>
              <TableHead>CAC complet</TableHead>
              <TableHead>CA signé</TableHead>
              <TableHead>Cash</TableHead>
              <TableHead>ROI cash</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map(row => {
              const totalCost = campaignTotalCost(row)
              return (
                <TableRow key={row.id || `${row.source}-${row.campaign}`}>
                  <TableCell className="pl-4"><div className="font-semibold">{row.campaign}</div><div className="text-[10px] text-muted-foreground">{row.source}</div></TableCell>
                  <TableCell>{euro(row.spend)}</TableCell>
                  <TableCell className="font-semibold">{euro(totalCost)}</TableCell>
                  <TableCell>{integer(row.leads)}</TableCell>
                  <TableCell>{integer(row.meetings)}</TableCell>
                  <TableCell>{integer(row.clients)}</TableCell>
                  <TableCell>{euro(ratio(totalCost, row.clients))}</TableCell>
                  <TableCell>{euro(row.signedRevenue)}</TableCell>
                  <TableCell className="font-semibold">{euro(row.cashCollected)}</TableCell>
                  <TableCell className={roi(row.cashCollected, totalCost) != null && n(roi(row.cashCollected, totalCost)) < 0 ? "font-semibold text-destructive" : "font-semibold"}>{percent(roi(row.cashCollected, totalCost))}</TableCell>
                  <TableCell>{canEdit ? <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => void deleteCampaign(row.id)} aria-label="Supprimer"><Trash2 size={14} /></Button> : null}</TableCell>
                </TableRow>
              )
            })}
            {!campaigns.length ? <TableRow><TableCell colSpan={11} className="h-24 text-center text-muted-foreground">Aucune campagne renseignée pour ce mois.</TableCell></TableRow> : null}
          </TableBody>
        </Table>

        {canEdit ? (
          <div className="border-t border-border bg-muted/20 p-3">
            <div className="mb-2 text-[11px] text-muted-foreground">Le coût commercial peut inclure le fixe + variable + commissions attribuables à cette campagne. Les autres coûts permettent d’obtenir un vrai CAC et un vrai ROI.</div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
              <Input className="h-9 text-xs" placeholder="Source (Meta, SEO…)" value={campaignDraft.source} onChange={event => setCampaignDraft(current => ({ ...current, source: event.target.value }))} />
              <Input className="h-9 text-xs" placeholder="Campagne" value={campaignDraft.campaign} onChange={event => setCampaignDraft(current => ({ ...current, campaign: event.target.value }))} />
              <Input className="h-9 text-xs" type="number" placeholder="Ads €" value={campaignDraft.spend ?? ""} onChange={event => setCampaignDraft(current => ({ ...current, spend: nullableInput(event.target.value) }))} />
              <Input className="h-9 text-xs" type="number" placeholder="Commercial €" value={campaignDraft.salesCost ?? ""} onChange={event => setCampaignDraft(current => ({ ...current, salesCost: nullableInput(event.target.value) }))} />
              <Input className="h-9 text-xs" type="number" placeholder="Outils €" value={campaignDraft.toolingCost ?? ""} onChange={event => setCampaignDraft(current => ({ ...current, toolingCost: nullableInput(event.target.value) }))} />
              <Input className="h-9 text-xs" type="number" placeholder="Agence €" value={campaignDraft.agencyCost ?? ""} onChange={event => setCampaignDraft(current => ({ ...current, agencyCost: nullableInput(event.target.value) }))} />
              <Input className="h-9 text-xs" type="number" placeholder="Créa €" value={campaignDraft.creativeCost ?? ""} onChange={event => setCampaignDraft(current => ({ ...current, creativeCost: nullableInput(event.target.value) }))} />
              <Input className="h-9 text-xs" type="number" placeholder="Autres coûts €" value={campaignDraft.otherCost ?? ""} onChange={event => setCampaignDraft(current => ({ ...current, otherCost: nullableInput(event.target.value) }))} />
              <Input className="h-9 text-xs" type="number" placeholder="Leads" value={campaignDraft.leads ?? ""} onChange={event => setCampaignDraft(current => ({ ...current, leads: nullableInput(event.target.value) }))} />
              <Input className="h-9 text-xs" type="number" placeholder="RDV" value={campaignDraft.meetings ?? ""} onChange={event => setCampaignDraft(current => ({ ...current, meetings: nullableInput(event.target.value) }))} />
              <Input className="h-9 text-xs" type="number" placeholder="Clients" value={campaignDraft.clients ?? ""} onChange={event => setCampaignDraft(current => ({ ...current, clients: nullableInput(event.target.value) }))} />
              <Input className="h-9 text-xs" type="number" placeholder="CA signé €" value={campaignDraft.signedRevenue ?? ""} onChange={event => setCampaignDraft(current => ({ ...current, signedRevenue: nullableInput(event.target.value) }))} />
              <Input className="h-9 text-xs" type="number" placeholder="Cash €" value={campaignDraft.cashCollected ?? ""} onChange={event => setCampaignDraft(current => ({ ...current, cashCollected: nullableInput(event.target.value) }))} />
              <Button size="sm" className="h-9 gap-1.5 md:col-span-2 xl:col-span-5" onClick={() => void saveCampaign()} disabled={saving || !campaignDraft.source.trim() || !campaignDraft.campaign.trim()}><Plus size={14} />Ajouter la campagne et calculer le ROI</Button>
            </div>
          </div>
        ) : null}
      </section>

      {editing && canEdit && draft ? (
        <section>
          <div className="border-b border-border px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Sources</div>
            <div className="mt-0.5 text-sm font-semibold">Saisir les KPI du mois</div>
          </div>
          <div className="space-y-5 p-4">
            {["Acquisition", "Coûts acquisition", "Activation", "Finance", "Temps des deals", "Pilotage"].map(group => (
              <div key={group}>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">{group}</div>
                {group === "Coûts acquisition" ? <p className="mb-2 text-[11px] text-muted-foreground">Exemple : coût commercial = fixe + variable + commissions du mois. Le ROI cash utilise tous ces coûts.</p> : null}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {VALUE_FIELDS.filter(field => field.group === group).map(field => (
                    <label key={field.key} className="space-y-1.5">
                      <span className="text-[11px] font-semibold">{field.label}</span>
                      <div className="relative">
                        <Input className="h-9 text-xs" type="number" step="any" value={draft[field.key] ?? ""} onChange={event => setDraft(current => current ? ({ ...current, [field.key]: nullableInput(event.target.value) } as ValueRow) : current)} />
                        {field.euro || field.days ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{field.euro ? "€" : "j"}</span> : null}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2 border-t border-border pt-4"><Button variant="outline" size="sm" className="h-9" onClick={() => setEditing(false)}>Annuler</Button><Button size="sm" className="h-9 gap-1.5" onClick={() => void saveValue()} disabled={saving}>{saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}Enregistrer</Button></div>
          </div>
        </section>
      ) : null}
    </Card>
  )
}
