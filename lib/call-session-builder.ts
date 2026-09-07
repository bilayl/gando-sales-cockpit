import { getCallRecommendations, getSalesCallSession } from "@/lib/call-recommendations"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export async function createFilteredSalesCallSession(input?: {
  owner?: string
  location?: string
  targetCount?: number
  createdBy?: string | null
}) {
  const targetCount = Math.min(Math.max(input?.targetCount || 80, 1), 500)
  const locationNeedle = input?.location?.trim().toLowerCase() || ""
  const recommendations = await getCallRecommendations({
    bucket: "ACTIONABLE",
    owner: input?.owner,
    limit: 2000,
    forceRefresh: true,
  })

  const selected = recommendations.results
    .filter(contact => {
      if (!locationNeedle) return true
      const p = contact.properties
      const location = [p.zip, p.city, p.state, p.country].filter(Boolean).join(" ").toLowerCase()
      return location.includes(locationNeedle)
    })
    .slice(0, targetCount)

  const hubspotIds = selected.map(contact => contact.id)
  if (!hubspotIds.length) {
    throw new Error(input?.location
      ? `Aucun contact disponible pour une session sur « ${input.location} ».`
      : "Aucun contact disponible pour cette session.")
  }

  const supabase = getSupabaseAdmin()
  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id,hubspot_id")
    .in("hubspot_id", hubspotIds)
  if (contactsError) throw contactsError
  const uuidByHubspotId = new Map((contacts || []).map(row => [String(row.hubspot_id), String(row.id)]))

  const now = new Date()
  const locationSuffix = input?.location?.trim() ? ` · ${input.location.trim()}` : ""
  const sessionName = `Session d’appels ${new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now)}${locationSuffix}`

  const { data: session, error: sessionError } = await supabase.from("sales_call_sessions").insert({
    name: sessionName,
    owner_hubspot_id: input?.owner || null,
    target_count: targetCount,
    location_filter: input?.location?.trim() || null,
    created_by: input?.createdBy || null,
  }).select("id,name,owner_hubspot_id,target_count,status,location_filter,created_at").single()
  if (sessionError) throw sessionError

  const items = hubspotIds
    .map((hubspotId, index) => ({
      session_id: session.id,
      contact_id: uuidByHubspotId.get(hubspotId),
      position: index + 1,
    }))
    .filter(item => Boolean(item.contact_id))
  if (items.length) {
    const { error } = await supabase.from("sales_call_session_items").insert(items)
    if (error) throw error
  }

  return getSalesCallSession(String(session.id))
}
