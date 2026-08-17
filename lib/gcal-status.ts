import "server-only";

import { hubspotJson } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type GoogleMeetingStatus = "COMPLETED" | "NO_SHOW" | "CANCELED" | "RESCHEDULED";

export const GCAL_SYNC_SOURCE = "Google Calendar (sync)";

type ActivityRow = {
  hubspot_id: string;
  activity_type: string;
  occurred_at: string;
  subject: string | null;
  body: string | null;
  outcome: string | null;
  raw_data: { syncedHubspotMeetingId?: string | null };
};

/** Applique les statuts enregistrÃ©s en base aux Ã©vÃ©nements Google du chargement courant. */
export async function applyGoogleOutcomes(meetings: Array<{ id: string; properties: Record<string, string | null> }>) {
  const ids = meetings.map(item => item.id);
  if (!ids.length) return;
  try {
    for (let index = 0; index < ids.length; index += 500) {
      const chunk = ids.slice(index, index + 500);
      const { data } = await getSupabaseAdmin().from("activities").select("hubspot_id,outcome,raw_data").in("hubspot_id", chunk);
      for (const row of (data ?? []) as Array<{ hubspot_id: string; outcome: string | null; raw_data: { updatedAt?: string } | null }>) {
        if (!row.outcome) continue;
        const meeting = meetings.find(item => item.id === row.hubspot_id);
        if (!meeting) continue;
        meeting.properties.hs_meeting_outcome = row.outcome;
        meeting.properties.__gcal_synced_at = row.raw_data?.updatedAt ?? null;
      }
    }
  } catch {
    // Base de donnÃ©es indisponible : statuts ignorÃ©s pour ce chargement.
  }
}

/**
 * Change le statut d'un Ã©vÃ©nement Google sans notes ni relance :
 * rÃ©utilise les derniÃ¨res infos connues (titre, horaires) enregistrÃ©es en base.
 */
export async function updateGoogleMeetingStatus(eventId: string, status: GoogleMeetingStatus): Promise<string[]> {
  let title: string | null = null;
  let startAt: string | null = null;
  let endAt: string | null = null;
  try {
    const { data } = await getSupabaseAdmin().from("activities").select("raw_data").eq("hubspot_id", `gcal-${eventId}`).maybeSingle();
    const raw = (data?.raw_data ?? null) as { title?: string | null; startAt?: string | null; endAt?: string | null } | null;
    title = raw?.title ?? null;
    startAt = raw?.startAt ?? null;
    endAt = raw?.endAt ?? null;
  } catch {
    // Base de donnÃ©es indisponible : le statut est enregistrÃ© avec les valeurs par dÃ©faut.
  }
  return saveGoogleOutcome({ eventId, status, title, startAt, endAt });
}

/**
 * Enregistre un statut de rendez-vous Google :
 * 1. RAPPELLE le rendez-vous HubSpot associÃ© (crÃ©ation si besoin) pour reflÃ©ter le statut.
 * 2. Ã‰crit dans la base de donnÃ©es (table activities, clÃ© gcal-<eventId>).
 */
export async function saveGoogleOutcome(params: {
  eventId: string;
  status: GoogleMeetingStatus;
  title?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  notes?: string;
  commercialOutcome?: string | null;
  nextAction?: string;
  dueAt?: string;
  associations?: Array<{ to: { id: string }; types: Array<{ associationCategory: "HUBSPOT_DEFINED"; associationTypeId: number }> }>;
}): Promise<string[]> {
  const hubspotId = `gcal-${params.eventId}`;
  const warnings: string[] = [];
  let syncedMeetingId: string | null = null;

  try {
    const { data: existing } = await getSupabaseAdmin().from("activities").select("hubspot_id,raw_data").eq("hubspot_id", hubspotId).maybeSingle();
    syncedMeetingId = (existing?.raw_data as ActivityRow["raw_data"] | null)?.syncedHubspotMeetingId || null;
  } catch {
    // Base de donnÃ©es indisponible : la synchro HubSpot reste tentÃ©e.
  }

  const noteLines = [
    `SynchronisÃ© depuis Google Calendar (Ã©vÃ©nement ${params.eventId}).`,
    `Statut : ${params.status}`,
    ...(params.commercialOutcome ? [`RÃ©sultat commercial : ${params.commercialOutcome}`] : []),
    ...(params.notes ? [`Notes : ${params.notes}`] : []),
    ...(params.nextAction ? [`Prochaine action : ${params.nextAction}`] : []),
    ...(params.dueAt ? [`Ã‰chÃ©ance : ${params.dueAt}`] : []),
  ];
  const properties: Record<string, string> = {
    hs_meeting_title: params.title || "Rendez-vous Google",
    hs_meeting_start_time: params.startAt || "",
    hs_meeting_end_time: params.endAt || "",
    hs_timestamp: params.startAt || new Date().toISOString(),
    hs_meeting_outcome: params.status,
    hs_meeting_source: GCAL_SYNC_SOURCE,
    hs_internal_meeting_notes: noteLines.join("\n"),
  };

  try {
    if (syncedMeetingId) {
      await hubspotJson(`/crm/objects/2026-03/meetings/${encodeURIComponent(syncedMeetingId)}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: { hs_meeting_outcome: params.status, hs_internal_meeting_notes: properties.hs_internal_meeting_notes } }),
      });
    } else {
      const created = await hubspotJson("/crm/objects/2026-03/meetings", {
        method: "POST",
        body: JSON.stringify({
          properties,
          ...(params.associations?.length ? { associations: params.associations } : {}),
        }),
      });
      syncedMeetingId = String((created as { id: string }).id);
    }
  } catch {
    warnings.push("Le statut nâ€™a pas pu Ãªtre synchronisÃ© dans HubSpot (Ã©vÃ©nement Google Calendar).");
  }

  const updatedAt = new Date().toISOString();
  const row = {
    hubspot_id: hubspotId,
    activity_type: "meeting",
    occurred_at: params.startAt || new Date().toISOString(),
    subject: params.title || null,
    body: params.notes || null,
    outcome: params.status,
    raw_data: {
      googleEventId: params.eventId,
      status: params.status,
      notes: params.notes || null,
      commercialOutcome: params.commercialOutcome || null,
      nextAction: params.nextAction || null,
      dueAt: params.dueAt || null,
      title: params.title || null,
      startAt: params.startAt || null,
      endAt: params.endAt || null,
      syncedHubspotMeetingId: syncedMeetingId,
      updatedAt,
    },
  };
  try {
    await getSupabaseAdmin().from("activities").upsert(row, { onConflict: "hubspot_id" });
  } catch {
    warnings.push("Le statut nâ€™a pas pu Ãªtre enregistrÃ© en base de donnÃ©es.");
  }
  return warnings;
}