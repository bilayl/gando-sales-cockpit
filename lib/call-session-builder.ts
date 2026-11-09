import { getCallRecommendations, getSalesCallSession } from "@/lib/call-recommendations"
import {
  activeContactFilterCount,
  contactFilterSummary,
  contactMatchesFilters,
  sanitizeContactFilters,
  type ContactFilters,
} from "@/lib/contact-multi-filters"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { getBestCallTimeForProperties } from "@/lib/call-timing"
import { getWithAlloStatus } from "@/lib/withallo"

export async function createFilteredSalesCallSession(input?: {
  owner?: string
  location?: string
  filters?: ContactFilters
  targetCount?: number
  createdBy?: string | null
}) {
  const targetCount = Math.min(Math.max(input?.targetCount || 80, 1), 500)
  const filters = sanitizeContactFilters(input?.filters)

  if (input?.owner?.trim() && !filters.owner?.length) {
    filters.owner = [input.owner.trim()]
  }

  const legacyLocationNeedle = input?.location?.trim().toLocaleLowerCase("fr-FR") || ""
  const now = new Date()
  const recommendations = await getCallRecommendations({
    bucket: "ACTIONABLE",
    limit: 2000,
    forceRefresh: true,
  })

  const eligible = recommendations.results
    .filter(contact => {
      if (!contactMatchesFilters(contact.properties, filters)) return false
      if (!legacyLocationNeedle) return true
      const p = contact.properties
      const location = [p.zip, p.city, p.state, p.country]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("fr-FR")
      return location.includes(legacyLocationNeedle)
    })
    .map(contact => ({ contact, timing: getBestCallTimeForProperties(contact.properties, now) }))
    .sort((a, b) => Number(b.contact.properties.db_call_score || 0) - Number(a.contact.properties.db_call_score || 0))
    .map(item => ({
      ...item.contact,
      properties: {
        ...item.contact.properties,
        db_call_local_time: item.timing.localTime,
        db_call_timezone: item.timing.timezone,
        db_call_timing_reason: item.timing.reason,
      } as Record<string, string | null | undefined>,
    }))
  // Shared SDR queue: assignment is informational, never an exclusivity lock.
  // Every SDR may open and prepare a contact even if it is assigned to someone else.
  // No contact or company is assigned when a session starts.
  const supabase = getSupabaseAdmin()
  const selected = eligible
    .filter(contact => Boolean(String(contact.properties.phone || contact.properties.mobilephone || "").trim()))
    .slice(0, targetCount)

  const hubspotIds = selected.map(contact => contact.id)
  if (!hubspotIds.length) {
    const summaries = contactFilterSummary(filters)
    throw new Error(summaries.length
      ? `Aucun contact disponible avec les filtres sélectionnés (${summaries.join(" · ")}).`
      : input?.location
        ? `Aucun contact disponible pour une session sur « ${input.location} ».`
        : "Aucun contact avec numéro dans la sélection. La prospection et les fiches restent consultables.")
  }

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id,hubspot_id")
    .in("hubspot_id", hubspotIds)
  if (contactsError) throw contactsError
  const uuidByHubspotId = new Map((contacts || []).map(row => [String(row.hubspot_id), String(row.id)]))

  const summaries = contactFilterSummary(filters)
  const filterCount = activeContactFilterCount(filters)
  const suffix = filterCount
    ? ` · ${filterCount} filtre${filterCount > 1 ? "s" : ""}`
    : input?.location?.trim()
      ? ` · ${input.location.trim()}`
      : ""
  const sessionName = `Session d’appels ${new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now)}${suffix}`

  const locationValues = [filters.zip, filters.city, filters.state, filters.country]
    .flatMap(values => values || [])
  const locationFilter = locationValues.length
    ? locationValues.join(", ")
    : input?.location?.trim() || null

  const { data: session, error: sessionError } = await supabase.from("sales_call_sessions").insert({
    name: sessionName,
    owner_hubspot_id: filters.owner?.length === 1 ? filters.owner[0] : input?.owner || null,
    target_count: targetCount,
    location_filter: locationFilter,
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

  const withallo = await getWithAlloStatus().catch(() => ({ configured: false, connected: false }))

  return {
    ...(await getSalesCallSession(String(session.id))),
    appliedFilters: filters,
    filterSummary: summaries,
    withallo,
  }
}
