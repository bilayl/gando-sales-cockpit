import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";
import { processMeetingAction, type MeetingActionInput } from "@/lib/hubspot/meetings";
import { updateGoogleMeetingStatus } from "@/lib/gcal-status";

const allowed = [
  "hs_meeting_title",
  "hs_meeting_start_time",
  "hs_meeting_end_time",
  "hs_meeting_location",
  "hs_meeting_outcome",
  "hubspot_owner_id",
];

const GOOGLE_MEETING_STATUSES = new Set(["COMPLETED", "NO_SHOW", "CANCELED", "RESCHEDULED"]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (id.startsWith("gcal-")) {
      const outcome = body.properties?.hs_meeting_outcome as string | undefined;
      if (!outcome || !GOOGLE_MEETING_STATUSES.has(outcome)) {
        return NextResponse.json({ error: "Statut non pris en charge pour un événement Google Calendar" }, { status: 400 });
      }
      const warnings = await updateGoogleMeetingStatus(id.slice("gcal-".length), outcome as "COMPLETED" | "NO_SHOW" | "CANCELED" | "RESCHEDULED");
      return NextResponse.json({ id, warnings });
    }
    const properties = Object.fromEntries(Object.entries(body.properties ?? {}).filter(([key]) => allowed.includes(key)));
    const data = await hubspotJson(`/crm/objects/2026-03/meetings/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    });
    return NextResponse.json(data);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = await request.json() as MeetingActionInput;
    const allowedActions = new Set(["complete", "no_show", "cancel", "next_action", "reschedule"]);
    if (!allowedActions.has(input.action)) return NextResponse.json({ error: "Action rendez-vous invalide" }, { status: 400 });
    return NextResponse.json(await processMeetingAction(id, input));
  } catch (error) {
    return apiError(error);
  }
}
