import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getMeetingsCockpit, type EnrichedMeeting } from "@/lib/hubspot/meetings";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export type SetterQualificationStatus = "qualified" | "not_qualified" | "pending";

type SetterReviewRow = {
  meeting_id: string;
  qualification_status: SetterQualificationStatus;
  setter_owner_id: string | null;
  review_note: string | null;
  updated_by_email: string | null;
  updated_at: string;
};

const POSITIVE_OUTCOMES = new Set(["QUALIFIED", "INTERESTED", "PROPOSAL", "SECOND_MEETING", "DECISION_MAKER"]);
const NEGATIVE_OUTCOMES = new Set(["NOT_QUALIFIED", "LOST", "NURTURE", "TOO_EARLY"]);

function commercialOutcome(notes?: string | null) {
  if (!notes) return null;
  const match = notes.match(/R(?:é|e|Ã©)sultat commercial\s*:\s*([A-Z_]+)/i);
  return match?.[1]?.toUpperCase() || null;
}

function isSetterMeeting(meeting: EnrichedMeeting) {
  return meeting.derived.isBrevo || meeting.derived.isGandoPresentation;
}

function inferredQualification(meeting: EnrichedMeeting): { status: SetterQualificationStatus; reason: string; outcome: string | null } {
  const outcome = commercialOutcome(meeting.properties.hs_internal_meeting_notes);
  if (outcome && POSITIVE_OUTCOMES.has(outcome)) return { status: "qualified", reason: "Résultat commercial positif enregistré dans HubSpot", outcome };
  if (outcome && NEGATIVE_OUTCOMES.has(outcome)) return { status: "not_qualified", reason: "Résultat commercial non qualifié enregistré dans HubSpot", outcome };

  if (meeting.derived.status === "NO_SHOW") return { status: "not_qualified", reason: "Rendez-vous no-show", outcome };
  if (meeting.derived.status === "CANCELED") return { status: "not_qualified", reason: "Rendez-vous annulé", outcome };
  if (meeting.derived.status === "SCHEDULED" || meeting.derived.isUpcoming) return { status: "pending", reason: "Rendez-vous à venir", outcome };

  const contact = meeting.associations.contact?.properties;
  const lifecycle = String(contact?.lifecyclestage || "").toLowerCase();
  const prospecting = String(contact?.statut_prospection || "").toLowerCase();
  if (lifecycle === "opportunity") return { status: "qualified", reason: "Contact passé en opportunité", outcome };
  if (["non qualifié", "perdu"].includes(prospecting)) return { status: "not_qualified", reason: `Statut contact : ${contact?.statut_prospection}`, outcome };

  return { status: "pending", reason: "Qualification à renseigner", outcome };
}

async function readReviews(meetingIds: string[]) {
  const result = new Map<string, SetterReviewRow>();
  if (!meetingIds.length) return result;
  const admin = getSupabaseAdmin();
  for (let index = 0; index < meetingIds.length; index += 500) {
    const chunk = meetingIds.slice(index, index + 500);
    const { data, error } = await admin
      .from("setter_meeting_reviews")
      .select("meeting_id,qualification_status,setter_owner_id,review_note,updated_by_email,updated_at")
      .in("meeting_id", chunk);
    if (error) throw error;
    for (const row of (data || []) as SetterReviewRow[]) result.set(row.meeting_id, row);
  }
  return result;
}

export async function GET(request: NextRequest) {
  try {
    await requireCockpitAccess();
    const url = new URL(request.url);
    const query = (url.searchParams.get("query") || "").trim().toLowerCase();
    const qualification = url.searchParams.get("qualification") as SetterQualificationStatus | "all" | null;

    const cockpit = await getMeetingsCockpit({ view: "all" });
    const setterMeetings = cockpit.results.filter(isSetterMeeting);
    const reviews = await readReviews(setterMeetings.map(meeting => meeting.id));

    const rows = setterMeetings.map(meeting => {
      const inferred = inferredQualification(meeting);
      const review = reviews.get(meeting.id);
      const qualificationStatus = review?.qualification_status || inferred.status;
      const qualificationReason = review ? "Qualification corrigée manuellement" : inferred.reason;
      return {
        ...meeting,
        setterTracking: {
          qualificationStatus,
          qualificationReason,
          commercialOutcome: inferred.outcome,
          manuallyReviewed: Boolean(review),
          reviewNote: review?.review_note || null,
          updatedByEmail: review?.updated_by_email || null,
          updatedAt: review?.updated_at || null,
        },
      };
    });

    const searched = rows.filter(meeting => {
      if (!query) return true;
      const p = meeting.properties;
      const contact = meeting.associations.contact?.properties;
      const company = meeting.associations.company?.properties;
      return [
        p.hs_meeting_title,
        contact?.firstname,
        contact?.lastname,
        contact?.email,
        company?.name,
        company?.domain,
      ].filter(Boolean).join(" ").toLowerCase().includes(query);
    });

    const filtered = searched.filter(meeting => !qualification || qualification === "all" || meeting.setterTracking.qualificationStatus === qualification);
    const qualified = rows.filter(meeting => meeting.setterTracking.qualificationStatus === "qualified").length;
    const notQualified = rows.filter(meeting => meeting.setterTracking.qualificationStatus === "not_qualified").length;
    const pending = rows.filter(meeting => meeting.setterTracking.qualificationStatus === "pending").length;
    const decided = qualified + notQualified;

    return NextResponse.json({
      results: filtered,
      total: rows.length,
      metrics: {
        total: rows.length,
        qualified,
        notQualified,
        pending,
        qualificationRate: decided ? Math.round((qualified / decided) * 100) : 0,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireCockpitAccess();
    const body = await request.json();
    const meetingId = String(body?.meetingId || "").trim();
    const qualificationStatus = String(body?.qualificationStatus || "") as SetterQualificationStatus;
    if (!meetingId) throw Object.assign(new Error("Rendez-vous obligatoire."), { status: 400 });
    if (!["qualified", "not_qualified", "pending"].includes(qualificationStatus)) {
      throw Object.assign(new Error("Statut de qualification invalide."), { status: 400 });
    }

    const reviewNote = String(body?.reviewNote || "").trim().slice(0, 1000) || null;
    const setterOwnerId = String(body?.setterOwnerId || "").trim().slice(0, 120) || null;
    const now = new Date().toISOString();
    const { data, error } = await getSupabaseAdmin()
      .from("setter_meeting_reviews")
      .upsert({
        meeting_id: meetingId,
        qualification_status: qualificationStatus,
        setter_owner_id: setterOwnerId,
        review_note: reviewNote,
        updated_by_email: access.email || null,
        updated_at: now,
      }, { onConflict: "meeting_id" })
      .select("meeting_id,qualification_status,setter_owner_id,review_note,updated_by_email,updated_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ review: data });
  } catch (error) {
    return apiError(error);
  }
}
