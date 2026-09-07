"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpen, ChevronDown, ChevronUp, ExternalLink, PhoneCall } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CallScriptFlow } from "@/components/call-script-flow"
import { CallScriptLibrary } from "@/components/call-script-library"
import type { SalesCallScript, ScriptContact } from "@/lib/call-scripts"

type Props = {
  contact: ScriptContact
  remaining: number
  onOpenContact: () => void
}

function contextValue(value?: string | null) {
  return value?.trim() || "À qualifier"
}

export function CallSessionPrep({ contact, remaining, onOpenContact }: Props) {
  const [open, setOpen] = useState(true)
  const [scripts, setScripts] = useState<SalesCallScript[]>([])
  const [selectedScriptId, setSelectedScriptId] = useState("")
  const [canManageScripts, setCanManageScripts] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/call-scripts", { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || "Impossible de charger les scripts")
        const loaded = (payload.results || []) as SalesCallScript[]
        setScripts(loaded)
        setCanManageScripts(Boolean(payload.canManage))
        setSelectedScriptId(current => current || loaded.find(item => item.is_default)?.id || loaded[0]?.id || "")
      })
      .catch(error => {
        if ((error as Error).name !== "AbortError") console.error("Call scripts:", error)
      })
    return () => controller.abort()
  }, [])

  const selectedScript = useMemo(() => scripts.find(item => item.id === selectedScriptId) || scripts.find(item => item.is_default) || scripts[0], [scripts, selectedScriptId])

  useEffect(() => {
    setOpen(true)
  }, [contact.id, selectedScriptId])

  const p = contact.properties
  const name = [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Contact"
  const location = [p.zip || p.postal_code, p.city, p.state, p.country].filter(Boolean).join(" · ") || "À qualifier"

  function handleSaved(script: SalesCallScript) {
    setScripts(current => {
      const without = current.filter(item => item.id !== script.id).map(item => script.is_default ? { ...item, is_default: false } : item)
      return [script, ...without]
    })
    setSelectedScriptId(script.id)
  }

  return (
    <div className="border-y border-primary/15 bg-primary/[0.025] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="gap-1"><PhoneCall size={12} /> Script d’appel SI → ALORS</Badge>
            {selectedScript ? <Badge variant="outline" className="gap-1"><BookOpen size={11} /> {selectedScript.name}</Badge> : <Badge variant="outline">Chargement du script…</Badge>}
            <span className="text-sm font-semibold">{name}</span>
            <span className="text-xs text-muted-foreground">· {remaining} contact{remaining > 1 ? "s" : ""} restant{remaining > 1 ? "s" : ""}</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Choisissez la réponse du prospect : la prochaine question, l’argument ou le closing apparaît automatiquement.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scripts.length ? <CallScriptLibrary scripts={scripts} selectedId={selectedScriptId} canManage={canManageScripts} onSelect={setSelectedScriptId} onSaved={handleSaved} /> : null}
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onOpenContact}><ExternalLink size={13} /> Fiche</Button>
          <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={() => setOpen(value => !value)}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {open ? "Réduire" : "Afficher"}</Button>
        </div>
      </div>

      {open && selectedScript ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 rounded-xl border border-border bg-card p-3 text-[11px] sm:grid-cols-2 xl:grid-cols-5">
            <div><span className="text-muted-foreground">Entreprise</span><div className="mt-0.5 font-semibold">{contextValue(p.company || p.name)}</div></div>
            <div><span className="text-muted-foreground">Localisation</span><div className="mt-0.5 font-semibold">{location}</div></div>
            <div><span className="text-muted-foreground">Fonction</span><div className="mt-0.5 font-semibold">{contextValue(p.jobtitle)}</div></div>
            <div><span className="text-muted-foreground">Flotte</span><div className="mt-0.5 font-semibold">{contextValue(p.taille_de_flo || p.taille_flotte)}</div></div>
            <div><span className="text-muted-foreground">Paiement actuel</span><div className="mt-0.5 font-semibold">{contextValue(p.solution_paiement_reservation)}</div></div>
          </div>
          <CallScriptFlow script={selectedScript} contact={contact} />
        </div>
      ) : open ? <div className="mt-3 rounded-xl border border-dashed border-border bg-card p-5 text-center text-xs text-muted-foreground">Aucun script commercial actif. Un responsable peut en créer un depuis la bibliothèque.</div> : null}
    </div>
  )
}
