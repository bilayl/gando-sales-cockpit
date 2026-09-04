"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Clock3, Pencil, Plus, RefreshCw, Save, Target, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type ExperimentRow = {
  id?: string
  name: string
  startDate: string
  endDate: string
  source: string | null
  acquisitionCost: number
  prospectsContacted: number | null
  conversations: number | null
  qualifiedDeals: number | null
  meetings: number | null
  rentersRegistered: number | null
  firstDepositRenters: number | null
  mau30Renters: number | null
  margin30d: number | null
  notes: string | null
}

type ExperimentDraft = ExperimentRow

function localIso(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + days)
  return localIso(date)
}

function blankDraft(): ExperimentDraft {
  const startDate = localIso()
  return {
    name: "Test acquisition 14 jours",
    startDate,
    endDate: addDays(startDate, 13),
    source: null,
    acquisitionCost: 0,
    prospectsContacted: null,
    conversations: null,
    qualifiedDeals: null,
    meetings: null,
    rentersRegistered: null,
    firstDepositRenters: null,
    mau30Renters: null,
    margin30d: null,
    notes: null,
  }
}

function n(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function ratio(top: number | null | undefined, bottom: number | null | undefined) {
  const denominator = n(bottom)
  return denominator > 0 ? n(top) / denominator : null
}

function costPer(cost: number, quantity: number | null | undefined) {
  const count = n(quantity)
  return count > 0 ? cost / count : null
}

function nullableNumber(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null
}

function nullableSignedNumber(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function integer(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)
}

function euro(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value)
}

function percent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 }).format(value)
}

function formatDate(value: string) {
  if (!value) return "—"
  const date = new Date(`${value}T12:00:00`)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(date) : value
}

function experimentStatus(row: ExperimentRow) {
  const today = localIso()
  const maturityDate = addDays(row.endDate, 30)
  if (today <= row.endDate) return { label: "Collecte", tone: "secondary" as const, maturityDate }
  if (today < maturityDate) return { label: "J+30 en attente", tone: "outline" as const, maturityDate }
  if (row.mau30Renters == null) return { label: "MAU J+30 manquant", tone: "destructive" as const, maturityDate }
  return { label: "Cohorte complète", tone: "default" as const, maturityDate }
}

function MetricCard({ label, value, helper, emphasis = false }: { label: string; value: string; helper: string; emphasis?: boolean }) {
  return <div className={`rounded-lg border p-3 ${emphasis ? "border-primary/30 bg-primary/5" : "border-border bg-background"}`}>
    <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
    <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
    <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{helper}</div>
  </div>
}

export function KpiAcquisitionExperiment({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<ExperimentRow[]>([])
  const [draft, setDraft] = useState<ExperimentDraft>(() => blankDraft())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState("")

  async function load() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/kpi/acquisition-experiments", { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Impossible de charger les tests.")
      setRows(Array.isArray(body.rows) ? body.rows : [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de charger les tests.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const current = rows[0] || null
  const metrics = useMemo(() => {
    if (!current) return null
    return {
      cacMeeting: costPer(current.acquisitionCost, current.meetings),
      cacActivation: costPer(current.acquisitionCost, current.firstDepositRenters),
      cacMau30: costPer(current.acquisitionCost, current.mau30Renters),
      dealToActivation: ratio(current.firstDepositRenters, current.qualifiedDeals),
      activationToMau30: ratio(current.mau30Renters, current.firstDepositRenters),
      conversationToDeal: ratio(current.qualifiedDeals, current.conversations),
      payback30: current.margin30d != null && current.acquisitionCost > 0 ? current.margin30d / current.acquisitionCost : null,
    }
  }, [current])

  async function save() {
    if (!draft.name.trim() || !draft.startDate || !draft.endDate) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/kpi/acquisition-experiments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Impossible d’enregistrer le test.")
      setRows(Array.isArray(body.rows) ? body.rows : [])
      setDraft(blankDraft())
      setEditing(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’enregistrer le test.")
    } finally {
      setSaving(false)
    }
  }

  async function remove(id?: string) {
    if (!id) return
    const response = await fetch("/api/kpi/acquisition-experiments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    const body = await response.json()
    if (response.ok) setRows(Array.isArray(body.rows) ? body.rows : [])
    else setError(body.error || "Impossible de supprimer le test.")
  }

  function edit(row: ExperimentRow) {
    setDraft({ ...row })
    setEditing(true)
  }

  if (loading) return <Skeleton className="h-[360px] w-full rounded-xl" />

  const status = current ? experimentStatus(current) : null
  const funnel = current ? [
    ["Prospects", current.prospectsContacted],
    ["Conversations", current.conversations],
    ["Deals qualifiés", current.qualifiedDeals],
    ["RDV", current.meetings],
    ["Inscrits", current.rentersRegistered],
    ["1re caution", current.firstDepositRenters],
    ["MAU J+30", current.mau30Renters],
  ] as const : []

  return <Card className="overflow-hidden">
    <div className="border-b border-border px-4 py-4 lg:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Target size={16} />
            <div className="text-sm font-semibold">Test CAC → loueur réellement actif</div>
            {status ? <Badge variant={status.tone}>{status.label}</Badge> : null}
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
            Ici, un deal n’est pas un client. L’acquisition est validée à la première caution activée ; le CAC de référence devient le CAC MAU J+30 de la même cohorte.
          </p>
        </div>
        {canEdit ? <Button size="sm" className="h-9 gap-1.5" onClick={() => { setDraft(blankDraft()); setEditing(true) }}>
          <Plus size={14} />Nouveau test 14 jours
        </Button> : null}
      </div>
    </div>

    <div className="grid border-b border-border lg:grid-cols-[1.25fr_.75fr]">
      <div className="border-b border-border p-4 lg:border-b-0 lg:border-r lg:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Règle deal pertinent</div>
            <div className="mt-1 text-sm font-semibold">Créer / conserver un deal seulement après qualification</div>
          </div>
          <Badge variant="outline">ICP + besoin + décideur + next step</Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["ICP", "Loueur correspondant à la cible Gando"],
            ["Besoin", "Friction caution identifiée et réelle"],
            ["Interlocuteur", "Personne capable de faire avancer le sujet"],
            ["Next step", "Prochaine action datée ou clairement convenue"],
          ].map(([title, text]) => <div key={title} className="flex gap-2 rounded-md border border-border bg-muted/20 p-2.5">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            <div><div className="text-xs font-semibold">{title}</div><div className="text-[11px] text-muted-foreground">{text}</div></div>
          </div>)}
        </div>
      </div>

      <div className="p-4 lg:p-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Cohorte en cours / dernière cohorte</div>
        {current ? <div className="mt-2">
          <div className="flex items-start justify-between gap-3">
            <div><div className="text-sm font-semibold">{current.name}</div><div className="text-xs text-muted-foreground">{formatDate(current.startDate)} → {formatDate(current.endDate)}{current.source ? ` · ${current.source}` : ""}</div></div>
            {canEdit ? <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => edit(current)}><Pencil size={13} /></Button> : null}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 size={13} />Mesure MAU mature le {formatDate(status?.maturityDate || "")}</div>
        </div> : <div className="mt-2 text-sm text-muted-foreground">Aucun test créé. Lance une cohorte de 14 jours pour obtenir un vrai CAC d’activation.</div>}
      </div>
    </div>

    {current && metrics ? <>
      <div className="grid gap-2 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-4 lg:p-5">
        <MetricCard label="CAC RDV" value={euro(metrics.cacMeeting)} helper="Coût total ÷ RDV obtenus" />
        <MetricCard label="CAC activation" value={euro(metrics.cacActivation)} helper="Coût total ÷ 1res cautions activées" emphasis />
        <MetricCard label="CAC MAU J+30" value={euro(metrics.cacMau30)} helper="Coût total ÷ loueurs de la cohorte encore actifs à J+30" emphasis />
        <MetricCard label="Payback 30 j" value={metrics.payback30 == null ? "—" : `${metrics.payback30.toFixed(1)}×`} helper="Marge 30 j de la cohorte ÷ coût d’acquisition" />
      </div>

      <div className="border-b border-border p-4 lg:p-5">
        <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span>Conversation → deal : <strong className="text-foreground">{percent(metrics.conversationToDeal)}</strong></span>
          <span>Deal → 1re caution : <strong className="text-foreground">{percent(metrics.dealToActivation)}</strong></span>
          <span>Activation → MAU J+30 : <strong className="text-foreground">{percent(metrics.activationToMau30)}</strong></span>
          <span>Coût total : <strong className="text-foreground">{euro(current.acquisitionCost)}</strong></span>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4 lg:grid-cols-7">
          {funnel.map(([label, value]) => <div key={label} className="bg-background p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-1 text-lg font-semibold">{integer(value)}</div>
          </div>)}
        </div>
      </div>
    </> : null}

    {editing && canEdit ? <div className="border-b border-border bg-muted/15 p-4 lg:p-5">
      <div className="mb-3 flex items-center justify-between"><div><div className="text-sm font-semibold">{draft.id ? "Mettre à jour la cohorte" : "Nouveau test acquisition"}</div><div className="text-xs text-muted-foreground">Inclure Ads + setter/commercial + outils + freelance dans le coût total.</div></div></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Nom du test" value={draft.name} onChange={event => setDraft(currentDraft => ({ ...currentDraft, name: event.target.value }))} />
        <Input placeholder="Source / équipe" value={draft.source || ""} onChange={event => setDraft(currentDraft => ({ ...currentDraft, source: event.target.value || null }))} />
        <Input type="date" value={draft.startDate} onChange={event => setDraft(currentDraft => ({ ...currentDraft, startDate: event.target.value }))} />
        <Input type="date" value={draft.endDate} onChange={event => setDraft(currentDraft => ({ ...currentDraft, endDate: event.target.value }))} />
        <Input type="number" min="0" step="any" placeholder="Coût total €" value={draft.acquisitionCost || ""} onChange={event => setDraft(currentDraft => ({ ...currentDraft, acquisitionCost: nullableNumber(event.target.value) || 0 }))} />
        {[
          ["prospectsContacted", "Prospects contactés"],
          ["conversations", "Conversations réelles"],
          ["qualifiedDeals", "Deals qualifiés"],
          ["meetings", "RDV"],
          ["rentersRegistered", "Loueurs inscrits"],
          ["firstDepositRenters", "1res cautions activées"],
          ["mau30Renters", "MAU de cohorte à J+30"],
        ].map(([key, label]) => <Input key={key} type="number" min="0" step="any" placeholder={label} value={(draft as unknown as Record<string, number | null>)[key] ?? ""} onChange={event => setDraft(currentDraft => ({ ...currentDraft, [key]: nullableNumber(event.target.value) }))} />)}
        <Input type="number" step="any" placeholder="Marge cohorte à 30 j €" value={draft.margin30d ?? ""} onChange={event => setDraft(currentDraft => ({ ...currentDraft, margin30d: nullableSignedNumber(event.target.value) }))} />
        <Input className="sm:col-span-2 lg:col-span-3" placeholder="Notes / hypothèse testée" value={draft.notes || ""} onChange={event => setDraft(currentDraft => ({ ...currentDraft, notes: event.target.value || null }))} />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => { setDraft(blankDraft()); setEditing(false) }}>Annuler</Button>
        <Button size="sm" className="gap-1.5" disabled={saving} onClick={() => void save()}>{saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}Enregistrer</Button>
      </div>
    </div> : null}

    {error ? <div className="border-b border-border px-4 py-3 text-xs text-destructive">{error}</div> : null}

    {rows.length ? <div className="overflow-x-auto">
      <div className="border-b border-border px-4 py-3"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Historique des cohortes</div></div>
      <Table className="min-w-[980px] text-[11px]">
        <TableHeader className="bg-muted/35"><TableRow><TableHead className="pl-4">Test</TableHead><TableHead>Deals qualifiés</TableHead><TableHead>1res cautions</TableHead><TableHead>MAU J+30</TableHead><TableHead>CAC activation</TableHead><TableHead>CAC MAU</TableHead><TableHead>Deal → activation</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
        <TableBody>{rows.map(row => <TableRow key={row.id || `${row.name}-${row.startDate}`}>
          <TableCell className="pl-4"><div className="font-semibold">{row.name}</div><div className="text-[10px] text-muted-foreground">{formatDate(row.startDate)} → {formatDate(row.endDate)}</div></TableCell>
          <TableCell>{integer(row.qualifiedDeals)}</TableCell>
          <TableCell className="font-semibold">{integer(row.firstDepositRenters)}</TableCell>
          <TableCell className="font-semibold">{integer(row.mau30Renters)}</TableCell>
          <TableCell>{euro(costPer(row.acquisitionCost, row.firstDepositRenters))}</TableCell>
          <TableCell>{euro(costPer(row.acquisitionCost, row.mau30Renters))}</TableCell>
          <TableCell>{percent(ratio(row.firstDepositRenters, row.qualifiedDeals))}</TableCell>
          <TableCell>{canEdit ? <div className="flex"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => edit(row)}><Pencil size={13} /></Button><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void remove(row.id)}><Trash2 size={13} /></Button></div> : null}</TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </div> : null}
  </Card>
}
