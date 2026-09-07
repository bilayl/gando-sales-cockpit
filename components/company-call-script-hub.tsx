"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpen, Building2, Loader2, MessageSquareText, Sparkles, Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { CallScriptLibrary } from "@/components/call-script-library"
import { generateCallScript, type SalesCallScript, type ScriptContact } from "@/lib/call-scripts"

type Props = { recordId: string }

type CompanyPayload = {
  company?: { id?: string; properties?: Record<string, string | null | undefined> }
  contacts?: Array<{ id: string; properties?: Record<string, string | null | undefined> }>
}

export function CompanyCallScriptHub({ recordId }: Props) {
  const [scripts, setScripts] = useState<SalesCallScript[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [canManage, setCanManage] = useState(false)
  const [companyData, setCompanyData] = useState<CompanyPayload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
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
      .catch(error => {
        if ((error as Error).name !== "AbortError") console.error("Company scripts:", error)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [recordId])

  const selected = useMemo(() => scripts.find(item => item.id === selectedId) || scripts.find(item => item.is_default) || scripts[0], [scripts, selectedId])
  const company = companyData?.company?.properties || {}
  const contact = companyData?.contacts?.find(item => item.properties?.firstname || item.properties?.lastname || item.properties?.email) || companyData?.contacts?.[0]
  const cp = contact?.properties || {}

  const scriptContact = useMemo<ScriptContact>(() => ({
    id: contact?.id || recordId,
    properties: {
      ...cp,
      company: company.name || cp.company || "Cette entreprise",
      city: company.city || cp.city,
      state: company.state || cp.state,
      country: company.country || cp.country,
      zip: company.zip || cp.zip,
      taille_de_flo: company.taille_de_flo || company.taille_flotte || cp.taille_de_flo || cp.taille_flotte,
      taille_flotte: company.taille_flotte || company.taille_de_flo || cp.taille_flotte || cp.taille_de_flo,
      solution_paiement_reservation: company.solution_paiement_reservation || cp.solution_paiement_reservation,
      objections__retours: company.objections__retours || cp.objections__retours,
    },
  }), [companyData, recordId])

  const generated = useMemo(() => selected ? generateCallScript(selected, scriptContact) : null, [selected, scriptContact])

  function handleSaved(script: SalesCallScript) {
    setScripts(current => {
      const others = current.filter(item => item.id !== script.id).map(item => script.is_default ? { ...item, is_default: false } : item)
      return [script, ...others]
    })
    setSelectedId(script.id)
  }

  return (
    <div className="page-shell px-4 pt-4 sm:px-6 lg:px-7">
      <div className="mx-auto max-w-[1500px]">
        <Card className="border-primary/20 bg-primary/[0.025] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="gap-1"><Building2 size={12} /> Entreprise</Badge>
                <h2 className="font-display text-base font-bold">Script commercial</h2>
                {selected ? <Badge variant="outline"><BookOpen size={11} className="mr-1" />{selected.name}</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Le script est préparé au niveau de l’entreprise puis personnalisé avec le contact appelé.</p>
            </div>
            {scripts.length ? <CallScriptLibrary scripts={scripts} selectedId={selectedId} canManage={canManage} onSelect={setSelectedId} onSaved={handleSaved} /> : null}
          </div>

          {loading ? (
            <div className="grid h-24 place-items-center"><Loader2 className="animate-spin text-primary" /></div>
          ) : generated ? (
            <div className="mt-4 grid gap-2 lg:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><MessageSquareText size={13} /> 1. Introduction</div>
                <div className="text-xs leading-5">“{generated.introduction}”</div>
              </div>
              <div className="rounded-xl border border-primary/20 bg-card p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><Sparkles size={13} /> 3. Proposition adaptée</div>
                <div className="text-xs leading-5">{generated.valueProposition}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><Target size={13} /> 4. Closing</div>
                <div className="text-xs leading-5">“{generated.closing}”</div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-card p-4 text-xs text-muted-foreground">Aucun script commercial actif.</div>
          )}
        </Card>
      </div>
    </div>
  )
}
