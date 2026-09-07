import { getCallRecommendations, getSalesCallSession } from "@/lib/call-recommendations"
import {
  activeContactFilterCount,
  contactFilterSummary,
  contactMatchesFilters,
  sanitizeContactFilters,
  type ContactFilters,
} from "@/lib/contact-multi-filters"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

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
  const recommendations = await getCallRecommendations({
    bucket: "ACTIONABLE",
    limit: 2000,
    forceRefresh: true,
  })

  const selected = recommendations.results
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
    .slice(0, targetCount)

  const hubspotIds = selected.map(contact => contact.id)
  if (!hubspotIds.length) {
    const summaries = contactFilterSummary(filters)
    throw new Error(summaries.length
      ? `Aucun contact disponible avec les filtres sélectionnés (${summaries.join(" · ")}).`
      : input?.location
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

  return {
    ...(await getSalesCallSession(String(session.id))),
    appliedFilters: filters,
    filterSummary: summaries,
  }
}
