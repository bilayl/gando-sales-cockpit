"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Calculator, Megaphone, Pencil, Plus, RefreshCw, Save, Trash2, TrendingUp, Wallet } from "lucide-react"
import { Badge } from "@/components/kpi-shadcn/ui/badge"
import { Button } from "@/components/kpi-shadcn/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/kpi-shadcn/ui/card"
import { Input } from "@/components/kpi-shadcn/ui/input"
import { Progress } from "@/components/kpi-shadcn/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/kpi-shadcn/ui/select"
import { Skeleton } from "@/components/kpi-shadcn/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/kpi-shadcn/ui/table"

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
  paidLeads: number | null
  organicLeads: number | null
  signedRevenue: number | null
  cashCollected: number | null
  mrr: number | null
  refunds: number | null
  netMargin: number | null
  avgClosingDays: number | null
  avgDealAgeDays: number | null
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
  { key: "paidSpend", label: "Dépenses paid", group: "Acquisition", euro: true },
  { key: "salesCost", label: "Coût commercial", group: "Acquisition", euro: true },
  { key: "paidLeads", label: "Leads paid", group: "Acquisition" },
  { key: "organicLeads", label: "Leads organiques", group: "Acquisition" },
  { key: "rentersRegistered", label: "Loueurs inscrits", group: "Activation" },
  { key: "rentersActivated", label: "Loueurs activés", group: "Activation" },
  { key: "firstDepositRenters", label: "Loueurs avec 1re caution", group: "Activation" },
  { key: "signedRevenue", label: "CA signé", group: "Finance", euro: true },
  { key: "cashCollected", label: "Cash encaissé", group: "Finance", euro: true },
  { key: "mrr", label: "MRR", group: "Finance", euro: true },
  { key: "refunds", label: "Remboursements", group: "Finance", euro: true },
  { key: "netMargin", label: "Marge nette Gando", group: "Finance", euro: true },
  { key: "avgClosingDays", label: "Délai moyen de closing", group: "Qualité sales", days: true },
  { key: "avgDealAgeDays", label: "Âge moyen des deals", group: "Qualité sales", days: true },
  { key: "dealsOver40Days", label: "Deals > 40 jours", group: "Qualité sales" },
  { key: "decisionsTaken", label: "Décisions prises grâce aux KPI", group: "Qualité sales" },
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
    paidLeads: null,
    organicLeads: null,
    signedRevenue: null,
    cashCollected: null,
    mrr: null,
    refunds: null,
    netMargin: null,
    avgClosingDays: null,
    avgDealAgeDays: null,
    dealsOver40Days: null,
    decisionsTaken: null,
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
  const [campaignDraft, setCampaignDraft] = useState<CampaignRow>({
    year: new Date().getFullYear(),
    monthNumber: new Date().getMonth() + 1,
    source: "",
    campaign: "",
    spend: null,
    leads: null,
    meetings: null,
    clients: null,
    signedRevenue: null,
    cashCollected: null,
  })

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
    setCampaignDraft(current => ({ ...current, year, monthNumber, source: "", campaign: "", spend: null, leads: null, meetings: null, clients: null, signedRevenue: null, cashCollected: null }))
  }, [year, monthNumber, valueRows])

  const derived = useMemo(() => {
    const totalLeads = n(value.paidLeads) + n(value.organicLeads)
    const acquisitionCost = n(value.paidSpend) + n(value.salesCost)
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
    }
  }, [value, core])

  const alerts = useMemo(() => {
    const items: string[] = []
    if (derived.ltvCac != null && derived.ltvCac < 3) items.push(`LTV / CAC à ${decimal(derived.ltvCac, 1)}× : sous le repère 3×.`)
    if (n(value.avgDealAgeDays) > 40) items.push(`Âge moyen des deals à ${decimal(value.avgDealAgeDays, 0)} jours.`)
    if (n(value.dealsOver40Days) > 0) items.push(`${integer(value.dealsOver40Days)} deal(s) ont plus de 40 jours.`)
    if (derived.collectionRate != null && derived.collectionRate < 0.9) items.push(`Seulement ${percent(derived.collectionRate)} du CA signé est encaissé.`)
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
      setCampaignDraft(current => ({ ...current, source: "", campaign: "", spend: null, leads: null, meetings: null, clients: null, signedRevenue: null, cashCollected: null }))
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

  if (loading) {
    return <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-40 rounded-xl" />)}</div>
  }

  const funnelSteps = [
    { label: "Prospects", value: value.prospectsContacted, previous: null },
    { label: "RDV", value: value.meetings, previous: value.prospectsContacted },
    { label: "Inscrits", value: value.rentersRegistered, previous: value.meetings },
    { label: "Activés", value: value.rentersActivated, previous: value.rentersRegistered },
    { label: "1re caution", value: value.firstDepositRenters, previous: value.rentersActivated },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge variant="outline">Funnel business</Badge>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Acquisition → activation → valeur</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Une lecture unique des conversions, du CAC, du cash et des campagnes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Choisir un mois" /></SelectTrigger>
            <SelectContent>
              {monthOptions.map(month => {
                const [y, m] = month.split("-").map(Number)
                return <SelectItem key={month} value={month}>{MONTHS[m - 1]} {y}</SelectItem>
              })}
            </SelectContent>
          </Select>
          {canEdit ? <Button variant="outline" onClick={() => setEditing(current => !current)}><Pencil className="size-4" />{editing ? "Fermer" : "Saisir"}</Button> : null}
        </div>
      </div>

      {error ? <Card className="border-destructive/30"><CardContent className="pt-6 text-sm text-destructive">{error}</CardContent></Card> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "CAC complet", value: euro(derived.cac), detail: "Paid + coût commercial / loueur activé", icon: Calculator },
          { label: "LTV 24 mois", value: euro(derived.ltv24), detail: `ARPU ${euro(derived.arpu, 2)}`, icon: TrendingUp },
          { label: "LTV / CAC", value: derived.ltvCac == null ? "—" : `${decimal(derived.ltvCac, 1)}×`, detail: "Repère : > 3×", icon: TrendingUp },
          { label: "CA signé → cash", value: percent(derived.collectionRate), detail: `${euro(value.cashCollected)} encaissés`, icon: Wallet },
        ].map(item => {
          const Icon = item.icon
          return (
            <Card key={item.label} className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardDescription className="text-xs">{item.label}</CardDescription>
                  <div className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="size-4" /></div>
                </div>
              </CardHeader>
              <CardContent><CardTitle className="text-2xl tabular-nums">{item.value}</CardTitle><p className="mt-2 text-xs text-muted-foreground">{item.detail}</p></CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Funnel commercial & activation</CardTitle><CardDescription>Chaque étape affiche son taux de conversion depuis l’étape précédente.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-5">
            {funnelSteps.map((step, index) => {
              const conversion = index === 0 ? null : ratio(step.value, step.previous)
              return (
                <div key={step.label} className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{step.label}</span>{conversion != null ? <Badge variant="outline">{percent(conversion)}</Badge> : null}</div>
                  <div className="mt-3 text-2xl font-semibold tabular-nums">{integer(step.value)}</div>
                  {conversion != null ? <Progress className="mt-3 h-1.5" value={Math.max(0, Math.min(100, conversion * 100))} /> : <div className="mt-3 h-1.5" />}
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader><div className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-500" /><CardTitle className="text-base">À surveiller</CardTitle></div><CardDescription>Alertes calculées pour le mois.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {alerts.length ? alerts.map(alert => <div key={alert} className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-xs leading-5 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">{alert}</div>) : <div className="rounded-lg border bg-muted/20 px-3 py-3 text-xs text-muted-foreground">Aucun signal critique avec les données disponibles.</div>}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader><div className="flex items-center gap-2"><Megaphone className="size-4 text-primary" /><CardTitle className="text-base">Attribution campagnes → cash</CardTitle></div><CardDescription>Leads, clients, CA signé et cash par campagne.</CardDescription></CardHeader>
        <CardContent className="p-0">
          <Table className="min-w-[900px]">
            <TableHeader className="bg-muted/35"><TableRow><TableHead className="pl-6">Campagne</TableHead><TableHead>Spend</TableHead><TableHead>Leads</TableHead><TableHead>CPL</TableHead><TableHead>RDV</TableHead><TableHead>Clients</TableHead><TableHead>CAC</TableHead><TableHead>CA signé</TableHead><TableHead>Cash</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
            <TableBody>
              {campaigns.map(row => (
                <TableRow key={row.id || `${row.source}-${row.campaign}`}>
                  <TableCell className="pl-6"><div className="font-medium">{row.campaign}</div><div className="text-xs text-muted-foreground">{row.source}</div></TableCell>
                  <TableCell>{euro(row.spend)}</TableCell><TableCell>{integer(row.leads)}</TableCell><TableCell>{euro(ratio(row.spend, row.leads), 2)}</TableCell><TableCell>{integer(row.meetings)}</TableCell><TableCell>{integer(row.clients)}</TableCell><TableCell>{euro(ratio(row.spend, row.clients))}</TableCell><TableCell>{euro(row.signedRevenue)}</TableCell><TableCell className="font-medium">{euro(row.cashCollected)}</TableCell>
                  <TableCell>{canEdit ? <Button type="button" size="icon" variant="ghost" onClick={() => void deleteCampaign(row.id)} aria-label="Supprimer"><Trash2 className="size-4" /></Button> : null}</TableCell>
                </TableRow>
              ))}
              {!campaigns.length ? <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">Aucune campagne renseignée pour ce mois.</TableCell></TableRow> : null}
            </TableBody>
          </Table>
        </CardContent>
        {canEdit ? (
          <div className="border-t p-4">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              <Input placeholder="Source (Meta, SEO…)" value={campaignDraft.source} onChange={event => setCampaignDraft(current => ({ ...current, source: event.target.value }))} />
              <Input placeholder="Campagne" value={campaignDraft.campaign} onChange={event => setCampaignDraft(current => ({ ...current, campaign: event.target.value }))} />
              <Input type="number" placeholder="Spend €" value={campaignDraft.spend ?? ""} onChange={event => setCampaignDraft(current => ({ ...current, spend: nullableInput(event.target.value) }))} />
              <Input type="number" placeholder="Leads" value={campaignDraft.leads ?? ""} onChange={event => setCampaignDraft(current => ({ ...current, leads: nullableInput(event.target.value) }))} />
              <Input type="number" placeholder="RDV" value={campaignDraft.meetings ?? ""} onChange={event => setCampaignDraft(current => ({ ...current, meetings: nullableInput(event.target.value) }))} />
              <Input type="number" placeholder="Clients" value={campaignDraft.clients ?? ""} onChange={event => setCampaignDraft(current => ({ ...current, clients: nullableInput(event.target.value) }))} />
              <Input type="number" placeholder="CA signé €" value={campaignDraft.signedRevenue ?? ""} onChange={event => setCampaignDraft(current => ({ ...current, signedRevenue: nullableInput(event.target.value) }))} />
              <Input type="number" placeholder="Cash €" value={campaignDraft.cashCollected ?? ""} onChange={event => setCampaignDraft(current => ({ ...current, cashCollected: nullableInput(event.target.value) }))} />
              <Button className="xl:col-span-2" onClick={() => void saveCampaign()} disabled={saving || !campaignDraft.source.trim() || !campaignDraft.campaign.trim()}><Plus className="size-4" />Ajouter la campagne</Button>
            </div>
          </div>
        ) : null}
      </Card>

      {editing && canEdit && draft ? (
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Saisir les KPI sources</CardTitle><CardDescription>Les ratios sont calculés automatiquement à partir de ces valeurs.</CardDescription></CardHeader>
          <CardContent className="space-y-6">
            {["Acquisition", "Activation", "Finance", "Qualité sales"].map(group => (
              <div key={group}>
                <div className="mb-3 text-xs font-medium text-muted-foreground">{group}</div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {VALUE_FIELDS.filter(field => field.group === group).map(field => (
                    <label key={field.key} className="space-y-1.5">
                      <span className="text-xs font-medium">{field.label}</span>
                      <div className="relative">
                        <Input type="number" step="any" value={draft[field.key] ?? ""} onChange={event => setDraft(current => current ? ({ ...current, [field.key]: nullableInput(event.target.value) } as ValueRow) : current)} />
                        {field.euro || field.days ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{field.euro ? "€" : "j"}</span> : null}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(false)}>Annuler</Button><Button onClick={() => void saveValue()} disabled={saving}>{saving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}Enregistrer</Button></div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
