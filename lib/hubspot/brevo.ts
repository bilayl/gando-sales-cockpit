import "server-only";

import { hubspotJson } from "@/lib/hubspot";

export const BREVO_DOMAIN = "meet.brevo.com";
export const PRESENTATION_MARKER = "meet.brevo.com/gando-presentation";
export const BREVO_OWNER_EMAIL = (process.env.BREVO_OWNER_EMAIL || "sales@gando.app").trim().toLowerCase();

type HubSpotOwner = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

type MeetingRecord = {
  properties?: Record<string, string | null | undefined>;
};

export type BrevoMeetingScope = {
  provider: "brevo";
  marker: string;
  ownerId: string | null;
  ownerEmail: string | null;
};

export function isBrevoMeeting(meeting: MeetingRecord) {
  const properties = meeting.properties || {};
  return [
    properties.hs_meeting_body,
    properties.hs_meeting_location,
  ].some(value => value?.toLowerCase().includes(BREVO_DOMAIN));
}

export function isGandoPresentationMeeting(meeting: MeetingRecord) {
  const properties = meeting.properties || {};
  return [
    properties.hs_meeting_title,
    properties.hs_meeting_body,
    properties.hs_meeting_location,
    properties.hs_meeting_source,
    properties.hs_object_source_label,
  ].some(value => value?.toLowerCase().includes(PRESENTATION_MARKER));
}

export async function getBrevoMeetingScope(): Promise<BrevoMeetingScope> {
  let after: string | undefined;

  try {
    do {
      const params = new URLSearchParams({ limit: "100", archived: "false" });
      if (after) params.set("after", after);
      const data = await hubspotJson(`/crm/owners/2026-03?${params.toString()}`);
      const owners = (data.results || []) as HubSpotOwner[];
      const owner = owners.find(candidate => candidate.email?.trim().toLowerCase() === BREVO_OWNER_EMAIL);

      if (owner) {
        return {
          provider: "brevo",
          marker: BREVO_DOMAIN,
          ownerId: String(owner.id),
          ownerEmail: owner.email?.trim().toLowerCase() || BREVO_OWNER_EMAIL,
        };
      }

      after = data.paging?.next?.after ? String(data.paging.next.after) : undefined;
    } while (after);
  } catch {
    // Le périmètre est purement informatif : sans résolution, on liste tous les rendez-vous.
  }

  return {
    provider: "brevo",
    marker: BREVO_DOMAIN,
    ownerId: null,
    ownerEmail: null,
  };
}
