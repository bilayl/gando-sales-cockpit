import { getCallRecommendations, getSalesCallSession } from "@/lib/call-recommendations"
import {
  activeContactFilterCount,
  contactFilterSummary,
  contactMatchesFilters,
  sanitizeContactFilters,
  type ContactFilters,
} from "@/lib/contact-multi-filters"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { getBestCallTimeForProperties, isWithinFrenchCallWindow, CALL_WINDOW_LABEL } from "@/lib/call-timing"
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
  // No outbound session is started outside the French SDR windows. Preparation remains accessible.
  if (!isWithinFrenchCallWindow(now)) {
    throw new Error(`Les appels sont ouverts du lundi au vendredi de ${CALL_WINDOW_LABEL} (heure de Paris). La file de contacts reste consultable entre les créneaux.`)
  }
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
    .filter(item => item.timing.callNow)
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
  // Manual contact ownership only. Unassigned contacts remain available in the pool.
  // Never claim or reassign a company when opening a call session.
  const supabase = getSupabaseAdmin()
  const actorEmail = String(input?.createdBy || "").trim().toLowerCase()
  if (!actorEmail) throw new Error("Reconnectez-vous au Cockpit pour ouvrir une session d’appels.")
  const { data: assignedContacts, error: assignmentError } = await supabase
    .from("cockpit_contact_assignments")
    .select("contact_id,assignee_cockpit_email")
  if (assignmentError) throw assignmentError
  const assignments = new Map((assignedContacts || []).map(row => [
    String(row.contact_id),
    String(row.assignee_cockpit_email || "").trim().toLowerCase(),
  ]))
  const selected = eligible
    .filter(contact => {
      const phone = String(contact.properties.phone || contact.properties.mobilephone || "").trim()
      const assignee = assignments.get(String(contact.id))
      return Boolean(phone) && (!assignee || assignee === actorEmail)
    })
    .sort((a, b) => {
      const aMine = assignments.get(String(a.id)) === actorEmail ? 1 : 0
      const bMine = assignments.get(String(b.id)) === actorEmail ? 1 : 0
      return bMine - aMine || Number(b.properties.db_call_score || 0) - Number(a.properties.db_call_score || 0)
    })
    .slice(0, targetCount)

  const hubspotIds = selected.map(contact => contact.id)
  if (!hubspotIds.length) {
    const summaries = contactFilterSummary(filters)
    throw new Error(summaries.length
      ? `Aucun contact disponible avec les filtres sélectionnés (${summaries.join(" · ")}).`
      : input?.location
        ? `Aucun contact disponible pour une session sur « ${input.location} ».`
        : "Aucun contact joignable dans le créneau de France. Vérifiez les filtres et les numéros de téléphone.")
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
