"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpen, Building2, Database, Loader2, MapPin, UserRound, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { CallScriptFlow } from "@/components/call-script-flow"
import { CallScriptLibrary } from "@/components/call-script-library"
import type { SalesCallScript, ScriptContact } from "@/lib/call-scripts"

type Props = { recordId: string }

type CompanyPayload = {
  source?: "cockpit" | "cockpit+hubspot" | "hubspot"
  company?: { id?: string; properties?: Record<string, string | null | undefined> }
  contacts?: Array<{ id: string; properties?: Record<string, string | null | undefined> }>
}

export function CompanyCallScriptHub({ recordId }: Props) {
  const [scripts, setScripts] = useState<SalesCallScript[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [canManage, setCanManage] = useState(false)
  const [companyData, setCompanyData] = useState<CompanyPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError("")
    Promise.all([
      fetch("/api/call-scripts", { cache: "no-store", signal: controller.signal }).then(async response => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || "Impossible de charger les scripts")
        return payload
      }),
      fetch(`/api/companies/${encodeURIComponent(recordId)}/centralized`, { cache: "no-store", signal: controller.signal }).then(async response => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || "Impossible de charger l’entreprise")
        return payload as CompanyPayload
      }),
    ])
      .then(([scriptPayload, companyPayload]) => {
        const loaded = (scriptPayload.results || []) as SalesCallScript[]
        setScripts(loaded)
        setCanManage(Boolean(scriptPayload.canManage))
        setSelectedId(loaded.find(item => item.is_default)?.id || loaded[0]?.id || "")
        setCompanyData(companyPayload)
      })
      .catch(cause => {
        if ((cause as Error).name !== "AbortError") setError(cause instanceof Error ? cause.message : "Impossible de préparer le script")
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [recordId])

  const selected = useMemo(() => scripts.find(item => item.id === selectedId) || scripts.find(item => item.is_default) || scripts[0], [scripts, selectedId])
  const company = companyData?.company?.properties || {}
  const contact = companyData?.contacts?.find(item => item.properties?.firstname || item.properties?.lastname || item.properties?.email) || companyData?.contacts?.[0]
  const cp = contact?.properties || {}

  const scriptContact = useMemo<ScriptContact>(() => ({
    id: `${recordId}:${contact?.id || "company"}`,
    properties: {
      ...company,
      ...cp,
      company: company.name || cp.company || "Cette entreprise",
      name: company.name,
      city: company.city || cp.city,
      state: company.state || cp.state,
      country: company.country || cp.country,
      zip: company.zip || company.postal_code || cp.zip,
      postal_code: company.postal_code || company.zip || cp.zip,
      taille_de_flo: company.taille_de_flo || company.taille_flotte || cp.taille_de_flo || cp.taille_flotte,
      taille_flotte: company.taille_flotte || company.taille_de_flo || cp.taille_flotte || cp.taille_de_flo,
      solution_paiement_reservation: company.solution_paiement_reservation || cp.solution_paiement_reservation,
      objections__retours: company.objections__retours || cp.objections__retours,
    },
  }), [companyData, recordId, company, cp, contact?.id])

  function handleSaved(script: SalesCallScript) {
    setScripts(current => {
      const others = current.filter(item => item.id !== script.id).map(item => script.is_default ? { ...item, is_default: false } : item)
      return [script, ...others]
    })
    setSelectedId(script.id)
  }

  const contactName = [cp.firstname, cp.lastname].filter(Boolean).join(" ") || cp.email || "Aucun contact sélectionné"
  const location = [company.zip || company.postal_code, company.city, company.state, company.country].filter(Boolean).join(" · ") || "À qualifier"
  const fleet = company.taille_flotte || company.taille_de_flo || cp.taille_flotte || cp.taille_de_flo || "À qualifier"
  const payment = company.solution_paiement_reservation || cp.solution_paiement_reservation || "À qualifier"

  return (
    <div className="page-shell px-4 pt-4 sm:px-6 lg:px-7">
      <div className="mx-auto max-w-[1500px]">
        <Card className="border-primary/20 bg-primary/[0.025] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="gap-1"><Building2 size={12} /> Entreprise</Badge>
                <h2 className="font-display text-base font-bold">Script commercial conditionnel</h2>
                {selected ? <Badge variant="outline"><BookOpen size={11} className="mr-1" />{selected.name}</Badge> : null}
                {companyData?.source ? <Badge variant="outline" className="gap-1 text-[9px]"><Database size={10} />{companyData.source === "cockpit" ? "Données Cockpit" : "Cockpit + HubSpot"}</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Le SDR choisit la réponse du prospect ; le Cockpit applique le SI → ALORS et affiche automatiquement la bonne question, objection ou sortie.</p>
            </div>
            {scripts.length ? <CallScriptLibrary scripts={scripts} selectedId={selectedId} canManage={canManage} onSelect={setSelectedId} onSaved={handleSaved} /> : null}
          </div>

          {loading ? (
            <div className="grid h-28 place-items-center"><Loader2 className="animate-spin text-primary" /></div>
          ) : error ? (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">{error}</div>
          ) : selected ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-xl border border-border bg-card p-3"><div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"><Building2 size={11} /> Entreprise</div><div className="mt-1 text-xs font-semibold">{company.name || "Entreprise"}</div></div>
                <div className="rounded-xl border border-border bg-card p-3"><div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"><UserRound size={11} /> Contact appelé</div><div className="mt-1 text-xs font-semibold">{contactName}</div></div>
                <div className="rounded-xl border border-border bg-card p-3"><div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"><MapPin size={11} /> Localisation</div><div className="mt-1 text-xs font-semibold">{location}</div></div>
                <div className="rounded-xl border border-border bg-card p-3"><div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"><Users size={11} /> Flotte</div><div className="mt-1 text-xs font-semibold">{fleet}</div></div>
                <div className="rounded-xl border border-border bg-card p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Paiement actuel</div><div className="mt-1 text-xs font-semibold">{payment}</div></div>
              </div>

              <CallScriptFlow script={selected} contact={scriptContact} />
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-card p-4 text-xs text-muted-foreground">Aucun script commercial actif.</div>
          )}
        </Card>
      </div>
    </div>
  )
}
