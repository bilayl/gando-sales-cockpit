"use client"

import { GitBranch, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ScriptFlowAnswer, ScriptFlowNode } from "@/lib/call-scripts"

type Props = {
  value: ScriptFlowNode[]
  onChange: (value: ScriptFlowNode[]) => void
}

function newId(prefix: string, existing: ScriptFlowNode[]) {
  const base = `${prefix}_${existing.length + 1}`
  if (!existing.some(node => node.id === base)) return base
  return `${prefix}_${Date.now().toString(36)}`
}

export function CallScriptFlowEditor({ value, onChange }: Props) {
  function updateNode(index: number, patch: Partial<ScriptFlowNode>) {
    onChange(value.map((node, nodeIndex) => nodeIndex === index ? { ...node, ...patch } : node))
  }

  function addNode(type: ScriptFlowNode["type"] = "question") {
    const id = newId(type, value)
    const node: ScriptFlowNode = type === "question"
      ? { id, type, title: "Nouvelle question", text: "", answers: [] }
      : type === "close"
        ? { id, type, title: "Nouvelle sortie", text: "", outcome: "" }
        : { id, type, title: "Nouvelle transition", text: "", next_id: null }
    onChange([...value, node])
  }

  function removeNode(index: number) {
    const removedId = value[index]?.id
    onChange(value
      .filter((_, nodeIndex) => nodeIndex !== index)
      .map(node => ({
        ...node,
        next_id: node.next_id === removedId ? null : node.next_id,
        answers: node.answers?.map(answer => answer.next_id === removedId ? { ...answer, next_id: "" } : answer),
      })))
  }

  function updateNodeId(index: number, id: string) {
    const previousId = value[index]?.id
    const normalized = id.trim().replace(/[^a-zA-Z0-9_-]/g, "_")
    onChange(value.map((node, nodeIndex) => ({
      ...node,
      id: nodeIndex === index ? normalized : node.id,
      next_id: node.next_id === previousId ? normalized : node.next_id,
      answers: node.answers?.map(answer => answer.next_id === previousId ? { ...answer, next_id: normalized } : answer),
    })))
  }

  function addAnswer(nodeIndex: number) {
    const node = value[nodeIndex]
    const answers = node.answers || []
    const answer: ScriptFlowAnswer = {
      id: `answer_${answers.length + 1}`,
      label: "Nouvelle réponse",
      next_id: value[nodeIndex + 1]?.id || value.find(item => item.id !== node.id)?.id || "",
    }
    updateNode(nodeIndex, { answers: [...answers, answer] })
  }

  function updateAnswer(nodeIndex: number, answerIndex: number, patch: Partial<ScriptFlowAnswer>) {
    const answers = value[nodeIndex].answers || []
    updateNode(nodeIndex, { answers: answers.map((answer, index) => index === answerIndex ? { ...answer, ...patch } : answer) })
  }

  function removeAnswer(nodeIndex: number, answerIndex: number) {
    const answers = value[nodeIndex].answers || []
    updateNode(nodeIndex, { answers: answers.filter((_, index) => index !== answerIndex) })
  }

  const textareaClass = "min-h-[76px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"

  return (
    <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/[0.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2"><GitBranch size={15} className="text-primary" /><Label className="font-bold">Flux conditionnel SI / ALORS</Label></div>
          <p className="mt-1 text-[10px] text-muted-foreground">Chaque réponse pointe vers une autre étape. Le SDR ne voit donc que la branche pertinente pendant l’appel.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => addNode("question")}><Plus size={12} /> Question</Button>
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => addNode("message")}><Plus size={12} /> Argument</Button>
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => addNode("close")}><Plus size={12} /> Sortie</Button>
        </div>
      </div>

      <div className="space-y-3">
        {value.map((node, nodeIndex) => (
          <div key={`${node.id}-${nodeIndex}`} className="rounded-xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="h-5 w-5 justify-center rounded-full p-0 text-[9px]">{nodeIndex + 1}</Badge>
              <Select value={node.type} onValueChange={type => updateNode(nodeIndex, { type: type as ScriptFlowNode["type"], answers: type === "question" ? (node.answers || []) : undefined, outcome: type === "close" ? (node.outcome || "") : undefined })}>
                <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="question">Question</SelectItem><SelectItem value="message">Argument</SelectItem><SelectItem value="close">Sortie</SelectItem></SelectContent>
              </Select>
              <Input value={node.id} onChange={event => updateNodeId(nodeIndex, event.target.value)} className="h-8 w-[150px] font-mono text-[10px]" placeholder="id_etape" />
              <Input value={node.title} onChange={event => updateNode(nodeIndex, { title: event.target.value })} className="h-8 min-w-[180px] flex-1 text-xs" placeholder="Titre de l’étape" />
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeNode(nodeIndex)}><Trash2 size={13} /></Button>
            </div>

            <div className="mt-3 space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Ce que le SDR dit / demande</Label>
              <textarea className={textareaClass} value={node.text} onChange={event => updateNode(nodeIndex, { text: event.target.value })} placeholder="Texte de cette étape…" />
            </div>

            {node.type === "question" ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between"><Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Réponses et branches</Label><Button type="button" size="sm" variant="ghost" className="h-7 gap-1 text-[10px]" onClick={() => addAnswer(nodeIndex)}><Plus size={11} /> Réponse</Button></div>
                {(node.answers || []).map((answer, answerIndex) => (
                  <div key={`${answer.id}-${answerIndex}`} className="grid items-center gap-2 rounded-lg border border-border bg-muted/20 p-2 md:grid-cols-[44px_minmax(0,1fr)_44px_minmax(0,1fr)_32px]">
                    <Badge variant="secondary" className="justify-center text-[9px]">SI</Badge>
                    <Input value={answer.label} onChange={event => updateAnswer(nodeIndex, answerIndex, { label: event.target.value })} className="h-8 text-xs" placeholder="Réponse du prospect" />
                    <Badge variant="outline" className="justify-center text-[9px] text-primary">ALORS</Badge>
                    <Select value={answer.next_id || "__none__"} onValueChange={nextId => updateAnswer(nodeIndex, answerIndex, { next_id: nextId === "__none__" ? "" : nextId })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Étape suivante" /></SelectTrigger>
                      <SelectContent><SelectItem value="__none__">Choisir une étape</SelectItem>{value.filter(item => item.id && item.id !== node.id).map(item => <SelectItem key={item.id} value={item.id}>{item.title || item.id}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeAnswer(nodeIndex, answerIndex)}><Trash2 size={12} /></Button>
                  </div>
                ))}
                {!node.answers?.length ? <div className="rounded-lg border border-dashed border-border p-3 text-center text-[10px] text-muted-foreground">Ajoute au moins une réponse pour créer une branche.</div> : null}
              </div>
            ) : node.type === "message" ? (
              <div className="mt-3 grid gap-1.5 md:max-w-md">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Étape suivante</Label>
                <Select value={node.next_id || "__end__"} onValueChange={nextId => updateNode(nodeIndex, { next_id: nextId === "__end__" ? null : nextId })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__end__">Fin du flux</SelectItem>{value.filter(item => item.id && item.id !== node.id).map(item => <SelectItem key={item.id} value={item.id}>{item.title || item.id}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div className="mt-3 grid gap-1.5 md:max-w-md"><Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Résultat / qualification</Label><Input value={node.outcome || ""} onChange={event => updateNode(nodeIndex, { outcome: event.target.value })} className="h-8 text-xs" placeholder="RDV À BOOKER, À RELANCER…" /></div>
            )}
          </div>
        ))}
        {!value.length ? <div className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">Aucune logique conditionnelle. Ajoute une première question pour construire le flux.</div> : null}
      </div>
    </div>
  )
}
