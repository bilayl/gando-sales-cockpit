"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpen, Building2, Check, ChevronDown, ChevronUp, Circle, ExternalLink, Lightbulb, MessageSquareText, PhoneCall, Sparkles, Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { generateCallScript, type SalesCallScript, type ScriptContact } from "@/lib/call-scripts"

type Props = {
  contact: ScriptContact
  remaining: number
  script: SalesCallScript
  onOpenContact: () => void
}

function contextValue(value?: string | null) {
  return value?.trim() || "À qualifier"
}

export function CallSessionPrep({ contact, remaining, script, onOpenContact }: Props) {
  const [open, setOpen] = useState(true)
  const [checked, setChecked] = useState<number[]>([])

  useEffect(() => {
    setChecked([])
    setOpen(true)
  }, [contact.id, script.id])

  const p = contact.properties
  const generated = useMemo(() => generateCallScript(script, contact), [script, contact])
  const completed = checked.length
  const progress = generated.discoveryQuestions.length ? Math.round((completed / generated.discoveryQuestions.length) * 100) : 0
  const name = [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Contact"
  const location = [p.zip, p.city, p.state, p.country].filter(Boolean).join(" · ") || "À qualifier"

  function toggle(index: number) {
    setChecked(current => current.includes(index) ? current.filter(item => item !== index) : [...current, index])
  }

  return (
    <div className="border-y border-primary/15 bg-primary/[0.025] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="gap-1"><PhoneCall size={12} /> Script d’appel généré</Badge>
            <Badge variant="outline" className="gap-1"><BookOpen size={11} /> {script.name}</Badge>
            <span className="text-sm font-semibold">{name}</span>
            <span className="text-xs text-muted-foreground">· {remaining} contact{remaining > 1 ? "s" : ""} restant{remaining > 1 ? "s" : ""}</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Le script reprend les informations du prospect et suit 4 étapes : introduction → douleur → proposition adaptée → closing.</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="tabular-nums">Qualification {completed}/{generated.discoveryQuestions.length} · {progress}%</Badge>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onOpenContact}><ExternalLink size={13} /> Fiche</Button>
          <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={() => setOpen(value => !value)}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {open ? "Réduire" : "Afficher"}</Button>
        </div>
      </div>

      {open ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 rounded-xl border border-border bg-card p-3 text-[11px] sm:grid-cols-2 xl:grid-cols-5">
            <div><span className="text-muted-foreground">Entreprise</span><div className="mt-0.5 font-semibold">{contextValue(p.company)}</div></div>
            <div><span className="text-muted-foreground">Localisation</span><div className="mt-0.5 font-semibold">{location}</div></div>
            <div><span className="text-muted-foreground">Fonction</span><div className="mt-0.5 font-semibold">{contextValue(p.jobtitle)}</div></div>
            <div><span className="text-muted-foreground">Flotte</span><div className="mt-0.5 font-semibold">{contextValue(p.taille_de_flo || p.taille_flotte)}</div></div>
            <div><span className="text-muted-foreground">Paiement actuel</span><div className="mt-0.5 font-semibold">{contextValue(p.solution_paiement_reservation)}</div></div>
          </div>

          <div className="grid gap-3 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-2"><Badge className="h-5 w-5 justify-center rounded-full p-0">1</Badge><div className="text-xs font-bold">Introduction</div><MessageSquareText size={14} className="ml-auto text-primary" /></div>
              <div className="rounded-lg bg-muted/55 p-3 text-xs leading-5">“{generated.introduction}”</div>
              <div className="mt-2 text-[10px] text-muted-foreground">Objectif : obtenir 30 à 60 secondes pour comprendre la situation actuelle avant de présenter Gando.</div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-2"><Badge className="h-5 w-5 justify-center rounded-full p-0">2</Badge><div className="text-xs font-bold">Pain point & qualification</div><Target size={14} className="ml-auto text-primary" /></div>
              <div className="max-h-[330px] space-y-1.5 overflow-y-auto pr-1">
                {generated.discoveryQuestions.map((question, index) => {
                  const done = checked.includes(index)
                  return (
                    <button key={`${index}-${question}`} type="button" onClick={() => toggle(index)} className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] leading-4 transition-colors ${done ? "border-primary/30 bg-primary/[0.05]" : "border-border hover:bg-muted/50"}`}>
                      {done ? <Check className="mt-0.5 size-3.5 shrink-0 text-primary" /> : <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
                      <span>{question}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/[0.035] p-3">
              <div className="mb-2 flex items-center gap-2"><Badge className="h-5 w-5 justify-center rounded-full p-0">3</Badge><div className="text-xs font-bold">Proposition sur mesure</div><Sparkles size={14} className="ml-auto text-primary" /></div>
              <div className="text-xs leading-5">{generated.valueProposition}</div>
              {p.objections__retours ? <div className="mt-3 rounded-lg border border-border bg-card p-2 text-[10px] leading-4"><strong>Contexte connu :</strong> {p.objections__retours}</div> : null}
              <div className="mt-3 text-[10px] text-muted-foreground">Ne présenter cette partie qu’après avoir identifié un problème concret. Le texte est adapté aux informations déjà présentes dans le Cockpit.</div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-2"><Badge className="h-5 w-5 justify-center rounded-full p-0">4</Badge><div className="text-xs font-bold">Close & convert</div><Building2 size={14} className="ml-auto text-primary" /></div>
              <div className="rounded-lg bg-muted/55 p-3 text-xs leading-5">“{generated.closing}”</div>
              <div className="mt-3 space-y-1.5">
                {generated.qualificationRules.map(rule => <div key={rule} className="flex gap-1.5 text-[10px] leading-4"><Check size={12} className="mt-0.5 shrink-0 text-primary" /><span>{rule}</span></div>)}
              </div>
            </div>
          </div>

          {generated.objections.length ? (
            <div className="rounded-xl border border-border bg-card px-3 py-2.5">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><Lightbulb size={13} /> Réponses aux objections</div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {generated.objections.map(item => <div key={item} className="rounded-lg border border-border bg-muted/25 p-2 text-[10px] leading-4">{item}</div>)}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
