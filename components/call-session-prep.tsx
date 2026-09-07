"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronUp, ExternalLink, Mail, PhoneCall, Sparkles } from "lucide-react"
import { AiCallPrep } from "@/components/ai-call-prep"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PostCallEmailButton } from "@/components/post-call-email-button"
import { buildCallObjectionCoach } from "@/lib/call-objection-coach"

type CallPrepContact = {
  id: string
  properties: Record<string, string | null | undefined>
}

type Props = {
  contact: CallPrepContact
  remaining: number
  onOpenContact: () => void
}

function contextValue(value?: string | null) {
  return value?.trim() || "À qualifier"
}

export function CallSessionPrep({ contact, remaining, onOpenContact }: Props) {
  const [open, setOpen] = useState(true)
  const [activityData, setActivityData] = useState<any>(null)

  useEffect(() => {
    const controller = new AbortController()
    setActivityData(null)
    if (!contact.id) return () => controller.abort()
    fetch(`/api/contacts/${encodeURIComponent(contact.id)}/centralized`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || "Contexte CRM indisponible")
        setActivityData(payload)
      })
      .catch(error => {
        if ((error as Error).name !== "AbortError") console.warn("Call context:", error)
      })
    return () => controller.abort()
  }, [contact.id])

  useEffect(() => {
    setOpen(true)
  }, [contact.id])

  const crmProperties = activityData?.contact?.properties || {}
  const preparedContact = useMemo<CallPrepContact>(() => ({
    id: contact.id,
    properties: { ...contact.properties, ...crmProperties },
  }), [contact, crmProperties])
  const p = preparedContact.properties
  const name = [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Contact"
  const location = [p.zip || p.postal_code, p.city, p.state, p.country].filter(Boolean).join(" · ") || "À qualifier"
  const companyName = p.company || activityData?.companies?.[0]?.properties?.name || p.name || ""
  const email = p.email || ""
  const coach = useMemo(() => buildCallObjectionCoach({
    properties: p,
    notes: activityData?.notes || [],
    calls: activityData?.calls || [],
  }), [activityData, p])
  const latestCall = coach.latestCall
  const latestCallProperties = latestCall?.properties || {}
  const prepContext = activityData ? {
    ...activityData,
    contact: {
      ...(activityData.contact || {}),
      id: contact.id,
      properties: preparedContact.properties,
    },
  } : null

  return (
    <div className="border-y border-primary/15 bg-primary/[0.025] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="gap-1"><Sparkles size={12} /> Assistant IA avant appel</Badge>
            <span className="text-sm font-semibold">{name}</span>
            <span className="text-xs text-muted-foreground">· {remaining} contact{remaining > 1 ? "s" : ""} restant{remaining > 1 ? "s" : ""}</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">L’IA relit le contexte CRM pour préparer le SDR : résumé, objectif, ouverture, questions et objections à anticiper.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PostCallEmailButton
            contactId={contact.id}
            callId={latestCall?.id ? String(latestCall.id) : undefined}
            email={email}
            firstName={p.firstname || undefined}
            companyName={companyName}
            callTitle={latestCallProperties.hs_call_title || undefined}
            callBody={latestCallProperties.hs_call_body || latestCallProperties.hs_call_summary || undefined}
            transcription={coach.transcript}
            buttonLabel="Générer un email"
            buttonClassName="h-8 gap-1.5"
          />
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onOpenContact}><ExternalLink size={13} /> Fiche</Button>
          <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={() => setOpen(value => !value)}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {open ? "Réduire" : "Afficher"}</Button>
        </div>
      </div>

      {open ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 rounded-xl border border-border bg-card p-3 text-[11px] sm:grid-cols-2 xl:grid-cols-6">
            <div><span className="text-muted-foreground">Entreprise</span><div className="mt-0.5 font-semibold">{contextValue(companyName)}</div></div>
            <div><span className="text-muted-foreground">Email</span><div className="mt-0.5 flex items-center gap-1 font-semibold"><Mail size={11} className="text-primary" /><span className="truncate">{contextValue(email)}</span></div></div>
            <div><span className="text-muted-foreground">Localisation</span><div className="mt-0.5 font-semibold">{location}</div></div>
            <div><span className="text-muted-foreground">Fonction</span><div className="mt-0.5 font-semibold">{contextValue(p.jobtitle)}</div></div>
            <div><span className="text-muted-foreground">Flotte</span><div className="mt-0.5 font-semibold">{contextValue(p.taille_de_flo || p.taille_flotte)}</div></div>
            <div><span className="text-muted-foreground">Paiement actuel</span><div className="mt-0.5 font-semibold">{contextValue(p.solution_paiement_reservation)}</div></div>
          </div>
          {prepContext ? (
            <AiCallPrep context={prepContext} contactId={contact.id} compact />
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card p-5 text-center text-xs text-muted-foreground">Chargement du contexte CRM avant préparation IA…</div>
          )}
        </div>
      ) : null}
    </div>
  )
}
