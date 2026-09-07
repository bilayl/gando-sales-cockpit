"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpen, Check, Loader2, Plus, Save, Settings2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { SalesCallScript } from "@/lib/call-scripts"

type Props = {
  scripts: SalesCallScript[]
  selectedId: string
  canManage: boolean
  onSelect: (id: string) => void
  onSaved: (script: SalesCallScript) => void
}

type Draft = {
  id?: string
  name: string
  segment: string
  description: string
  source_url: string
  introduction: string
  discovery_questions: string
  value_proposition: string
  closing: string
  qualification_rules: string
  objections: string
  is_active: boolean
  is_default: boolean
}

const EMPTY: Draft = {
  name: "",
  segment: "Loueurs indépendants",
  description: "",
  source_url: "",
  introduction: "",
  discovery_questions: "",
  value_proposition: "",
  closing: "",
  qualification_rules: "",
  objections: "",
  is_active: true,
  is_default: false,
}

function toDraft(script?: SalesCallScript): Draft {
  if (!script) return { ...EMPTY }
  return {
    id: script.id,
    name: script.name,
    segment: script.segment || "",
    description: script.description || "",
    source_url: script.source_url || "",
    introduction: script.introduction,
    discovery_questions: (script.discovery_questions || []).join("\n"),
    value_proposition: script.value_proposition,
    closing: script.closing,
    qualification_rules: (script.qualification_rules || []).join("\n"),
    objections: (script.objections || []).join("\n"),
    is_active: script.is_active,
    is_default: script.is_default,
  }
}

function lines(value: string) {
  return value.split("\n").map(item => item.trim()).filter(Boolean)
}

export function CallScriptLibrary({ scripts, selectedId, canManage, onSelect, onSaved }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [saving, setSaving] = useState(false)
  const selected = useMemo(() => scripts.find(script => script.id === selectedId) || scripts[0], [scripts, selectedId])

  useEffect(() => {
    if (open) setDraft(toDraft(selected))
  }, [open, selected?.id])

  function edit(script: SalesCallScript) {
    onSelect(script.id)
    setDraft(toDraft(script))
  }

  async function save() {
    if (!canManage || saving) return
    if (!draft.name.trim() || !draft.introduction.trim() || !draft.value_proposition.trim() || !draft.closing.trim()) {
      toast.error("Nom, introduction, proposition de valeur et closing sont requis.")
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/call-scripts", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          name: draft.name,
          segment: draft.segment,
          description: draft.description,
          source_url: draft.source_url,
          introduction: draft.introduction,
          discovery_questions: lines(draft.discovery_questions),
          value_proposition: draft.value_proposition,
          closing: draft.closing,
          qualification_rules: lines(draft.qualification_rules),
          objections: lines(draft.objections),
          is_active: draft.is_active,
          is_default: draft.is_default,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Impossible d’enregistrer le script")
      onSaved(payload)
      onSelect(payload.id)
      setDraft(toDraft(payload))
      toast.success(draft.id ? "Script mis à jour." : "Script créé.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d’enregistrer le script")
    } finally {
      setSaving(false)
    }
  }

  const textareaClass = "min-h-[96px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"

  return (
    <>
      <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setOpen(true)}>
        <BookOpen size={14} /> Scripts
        {selected ? <Badge variant="secondary" className="ml-1 max-w-[120px] truncate text-[9px]">{selected.name}</Badge> : null}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="flex items-center gap-2"><Settings2 size={18} className="text-primary" /> Bibliothèque de scripts commerciaux</DialogTitle>
            <DialogDescription>Choisissez le script utilisé dans les sessions d’appels. Les responsables peuvent modifier les étapes et les arguments.</DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 flex-1 md:grid-cols-[260px_1fr]">
            <div className="border-r border-border bg-muted/20 p-3">
              <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Scripts</span>{canManage ? <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDraft({ ...EMPTY })}><Plus size={14} /></Button> : null}</div>
              <div className="space-y-1.5">
                {scripts.map(script => (
                  <button key={script.id} type="button" onClick={() => edit(script)} className={`w-full rounded-lg border px-3 py-2.5 text-left ${draft.id === script.id ? "border-primary/30 bg-primary/[0.05]" : "border-border bg-card hover:bg-muted/50"}`}>
                    <div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold">{script.name}</span>{selectedId === script.id ? <Check size={13} className="shrink-0 text-primary" /> : null}</div>
                    <div className="mt-1 flex gap-1"><Badge variant="outline" className="text-[9px]">{script.segment}</Badge>{script.is_default ? <Badge className="text-[9px]">Défaut</Badge> : null}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              {!canManage ? (
                <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3 text-sm">Script sélectionné : <strong>{selected?.name || "Aucun"}</strong>. Les commerciaux peuvent l’utiliser pendant une session, mais seuls les responsables peuvent modifier la bibliothèque.</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label>Nom du script</Label><Input value={draft.name} onChange={e => setDraft(current => ({ ...current, name: e.target.value }))} placeholder="Loueurs indépendants — Gando" /></div>
                    <div className="space-y-1.5"><Label>Segment</Label><Input value={draft.segment} onChange={e => setDraft(current => ({ ...current, segment: e.target.value }))} placeholder="Loueurs indépendants" /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Description</Label><Input value={draft.description} onChange={e => setDraft(current => ({ ...current, description: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Source / playbook Notion</Label><Input value={draft.source_url} onChange={e => setDraft(current => ({ ...current, source_url: e.target.value }))} placeholder="https://..." /></div>
                  <div className="space-y-1.5"><Label>1. Introduction</Label><textarea className={textareaClass} value={draft.introduction} onChange={e => setDraft(current => ({ ...current, introduction: e.target.value }))} /><p className="text-[10px] text-muted-foreground">Variables : {"{{firstname}}"}, {"{{company}}"}, {"{{city}}"}, {"{{fleet}}"}, {"{{payment}}"}, {"{{deposit_hint}}"}.</p></div>
                  <div className="space-y-1.5"><Label>2. Questions douleur / découverte <span className="text-muted-foreground">(1 par ligne)</span></Label><textarea className={`${textareaClass} min-h-[150px]`} value={draft.discovery_questions} onChange={e => setDraft(current => ({ ...current, discovery_questions: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>3. Proposition de valeur</Label><textarea className={textareaClass} value={draft.value_proposition} onChange={e => setDraft(current => ({ ...current, value_proposition: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>4. Closing / conversion</Label><textarea className={textareaClass} value={draft.closing} onChange={e => setDraft(current => ({ ...current, closing: e.target.value }))} /></div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="space-y-1.5"><Label>Qualification <span className="text-muted-foreground">(1 règle par ligne)</span></Label><textarea className={`${textareaClass} min-h-[130px]`} value={draft.qualification_rules} onChange={e => setDraft(current => ({ ...current, qualification_rules: e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label>Objections / réponses <span className="text-muted-foreground">(1 par ligne)</span></Label><textarea className={`${textareaClass} min-h-[130px]`} value={draft.objections} onChange={e => setDraft(current => ({ ...current, objections: e.target.value }))} /></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant={draft.is_default ? "secondary" : "outline"} size="sm" onClick={() => setDraft(current => ({ ...current, is_default: !current.is_default }))}>{draft.is_default ? "Script par défaut" : "Définir par défaut"}</Button>
                    <Button type="button" variant={draft.is_active ? "outline" : "secondary"} size="sm" onClick={() => setDraft(current => ({ ...current, is_active: !current.is_active }))}>{draft.is_active ? "Actif" : "Inactif"}</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="border-t border-border px-5 py-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>Fermer</Button>
            {canManage ? <Button onClick={() => void save()} disabled={saving} className="gap-1.5">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer</Button> : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
