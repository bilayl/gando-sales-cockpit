"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronUp, Clock3, ExternalLink, Mail, PhoneCall } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PostCallEmailButton } from "@/components/post-call-email-button"
import { buildCallObjectionCoach } from "@/lib/call-objection-coach"

type Contact = {
  id: string
  properties: Record<string, string | null | undefined>
}

type Props = {
  contact: Contact
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
  const properties = useMemo(
    () => ({ ...contact.properties, ...crmProperties }),
    [contact.properties, crmProperties],
  )
  const p = properties
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

  return (
    <div className="border-y border-primary/15 bg-primary/[0.025] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="gap-1"><PhoneCall size={12} /> Appel en cours</Badge>
            <span className="text-sm font-semibold">{name}</span>
            {p.db_call_local_time ? <Badge variant="secondary" className="gap-1"><Clock3 size={11} /> {p.db_call_local_time} heure locale · {p.db_call_timezone}</Badge> : null}
            <span className="text-xs text-muted-foreground">· {remaining} contact{remaining > 1 ? "s" : ""} restant{remaining > 1 ? "s" : ""}</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Le Cockpit centralise uniquement les informations utiles du CRM pour préparer l’appel.</div>
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
        <div className="mt-3 grid gap-2 rounded-xl border border-border bg-card p-3 text-[11px] sm:grid-cols-2 xl:grid-cols-6">
          <div><span className="text-muted-foreground">Entreprise</span><div className="mt-0.5 font-semibold">{contextValue(companyName)}</div></div>
          <div><span className="text-muted-foreground">Email</span><div className="mt-0.5 flex items-center gap-1 font-semibold"><Mail size={11} className="text-primary" /><span className="truncate">{contextValue(email)}</span></div></div>
          <div><span className="text-muted-foreground">Localisation</span><div className="mt-0.5 font-semibold">{location}</div></div>
          <div><span className="text-muted-foreground">Fonction</span><div className="mt-0.5 font-semibold">{contextValue(p.jobtitle)}</div></div>
          <div><span className="text-muted-foreground">Flotte</span><div className="mt-0.5 font-semibold">{contextValue(p.taille_de_flo || p.taille_flotte)}</div></div>
          <div><span className="text-muted-foreground">Paiement actuel</span><div className="mt-0.5 font-semibold">{contextValue(p.solution_paiement_reservation)}</div></div>
        </div>
      ) : null}
    </div>
  )
}
