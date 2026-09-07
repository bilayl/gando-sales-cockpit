"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Check, ChevronDown, ChevronUp, Circle, ExternalLink, PhoneCall, Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Contact = { id: string; properties: Record<string, string | null | undefined> }

type Props = {
  contact: Contact
  remaining: number
  onOpenContact: () => void
}

const QUESTIONS = [
  "Comment gérez-vous les cautions aujourd’hui : préautorisation, empreinte, virement ou autre ?",
  "Quel est le montant moyen de caution demandé à vos locataires ?",
  "Quel volume de locations / cautions traitez-vous chaque mois ?",
  "Quelle est la friction principale : plafond, refus de carte, fonds bloqués, temps opérationnel ou fraude ?",
  "Quel ERP et quelle solution de paiement utilisez-vous aujourd’hui ?",
  "Qui décide sur ce sujet et quel serait le bon timing pour tester une autre approche ?",
]

function firstName(properties: Contact["properties"]) {
  return properties.firstname || properties.lastname || ""
}

function companyName(properties: Contact["properties"]) {
  return properties.company || properties.hs_parent_company_name || "votre agence"
}

function contextValue(value?: string | null) {
  return value?.trim() || "À qualifier"
}

export function CallSessionPrep({ contact, remaining, onOpenContact }: Props) {
  const [open, setOpen] = useState(true)
  const [checked, setChecked] = useState<number[]>([])

  useEffect(() => {
    setChecked([])
    setOpen(true)
  }, [contact.id])

  const p = contact.properties
  const completed = checked.length
  const progress = Math.round((completed / QUESTIONS.length) * 100)
  const name = [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Contact"
  const opening = useMemo(() => {
    const intro = firstName(p) ? `Bonjour ${firstName(p)},` : "Bonjour,"
    return `${intro} je vous appelle de Gando. Je voulais comprendre rapidement comment ${companyName(p)} gère aujourd’hui les cautions et voir si le blocage de fonds crée une friction pour vos clients ou vos équipes.`
  }, [contact.id])

  function toggle(index: number) {
    setChecked(current => current.includes(index) ? current.filter(item => item !== index) : [...current, index])
  }

  return (
    <div className="border-y border-primary/15 bg-primary/[0.035] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="gap-1"><PhoneCall size={12} /> Préparation de l’appel</Badge>
            <span className="text-sm font-semibold">{name}</span>
            <span className="text-xs text-muted-foreground">· {remaining} contact{remaining > 1 ? "s" : ""} restant{remaining > 1 ? "s" : ""}</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Objectif : identifier un problème réel autour de la caution et obtenir une prochaine étape claire.</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="tabular-nums">{completed}/{QUESTIONS.length} · {progress}%</Badge>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onOpenContact}><ExternalLink size={13} /> Fiche</Button>
          <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={() => setOpen(value => !value)}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {open ? "Réduire" : "Afficher le guide"}</Button>
        </div>
      </div>

      {open ? (
        <div className="mt-3 grid gap-3 xl:grid-cols-[1.1fr_1.4fr_0.9fr]">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground"><Building2 size={13} /> Contexte prospect</div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Entreprise</span><strong className="text-right">{contextValue(p.company)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Fonction</span><strong className="text-right">{contextValue(p.jobtitle)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Taille flotte</span><strong className="text-right">{contextValue(p.taille_de_flo || p.taille_flotte)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Paiement actuel</span><strong className="text-right">{contextValue(p.solution_paiement_reservation)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Dernier statut</span><strong className="text-right">{contextValue(p.statut_prospection)}</strong></div>
            </div>
            {p.objections__retours ? <div className="mt-3 rounded-lg bg-muted/60 p-2 text-[11px]"><strong>Objection connue :</strong> {p.objections__retours}</div> : null}
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground"><Target size={13} /> Script + qualification</div>
            <div className="mb-3 rounded-lg border border-primary/15 bg-primary/[0.04] px-3 py-2 text-xs leading-5">“{opening}”</div>
            <div className="grid gap-1.5">
              {QUESTIONS.map((question, index) => {
                const done = checked.includes(index)
                return (
                  <button key={question} type="button" onClick={() => toggle(index)} className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] leading-4 transition-colors ${done ? "border-primary/25 bg-primary/[0.04]" : "border-border hover:bg-muted/50"}`}>
                    {done ? <Check className="mt-0.5 size-3.5 shrink-0 text-primary" /> : <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
                    <span>{question}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Décision de sortie</div>
            <div className="mt-2 space-y-2 text-[11px] leading-4">
              <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-2"><strong className="text-primary">RDV / opportunité</strong><br />Besoin identifié + volume intéressant + interlocuteur ou décideur + timing concret.</div>
              <div className="rounded-lg border border-border p-2"><strong>À relancer</strong><br />Besoin potentiel mais timing ou décideur non disponible.</div>
              <div className="rounded-lg border border-border p-2"><strong>À recycler</strong><br />Pas prioritaire aujourd’hui, mais profil compatible avec Gando.</div>
              <div className="rounded-lg border border-border p-2"><strong>Hors cible</strong><br />Pas de caution, très faible volume ou aucun problème que Gando peut résoudre.</div>
            </div>
            <div className="mt-3 text-[10px] text-muted-foreground">Ne pas pitcher trop tôt : qualifier d’abord la situation actuelle, le volume, la douleur et le décideur.</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
