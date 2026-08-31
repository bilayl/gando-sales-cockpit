import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getMeetingsCockpit, processMeetingAction, type EnrichedMeeting } from "@/lib/hubspot/meetings";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export type SetterQualificationStatus = "qualified" | "not_qualified" | "pending";
export type SetterCommercialResult = "qualified" | "follow_up" | "not_qualified" | "no_show";
export type SetterMeetingBucket = "to_qualify" | "upcoming" | "history";

type SetterReviewRow = {
  meeting_id: string;
  qualification_status: SetterQualificationStatus;
  setter_owner_id: string | null;
  review_note: string | null;
  updated_by_email: string | null;
  updated_at: string;
};

type StoredReview = {
  version: 1;
  result?: SetterCommercialResult | null;
  note?: string | null;
  nextActionAt?: string | null;
};

const POSITIVE_OUTCOMES = new Set(["QUALIFIED", "INTERESTED", "PROPOSAL", "SECOND_MEETING", "DECISION_MAKER"]);
const NEGATIVE_OUTCOMES = new Set(["NOT_QUALIFIED", "LOST", "NURTURE", "TOO_EARLY"]);
const COMMERCIAL_RESULTS = new Set<SetterCommercialResult>(["qualified", "follow_up", "not_qualified", "no_show"]);
const SETTER_FOCUS_START = Date.parse("2026-07-01T00:00:00+02:00");

function commercialOutcome(notes?: string | null) {
  if (!notes) return null;
  const match = notes.match(/R(?:é|e|Ã©)sultat commercial\s*:\s*([A-Z_]+)/i);
  return match?.[1]?.toUpperCase() || null;
}

function parseStoredReview(value?: string | null): StoredReview | null {
  if (!value?.trim().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(value) as StoredReview;
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function serializeReview(result: SetterCommercialResult | null, note: string | null, nextActionAt: string | null) {
  return JSON.stringify({ version: 1, result, note, nextActionAt } satisfies StoredReview);
}

function isSetterMeeting(meeting: EnrichedMeeting) {
  return meeting.derived.isBrevo || meeting.derived.isGandoPresentation;
}

function isMeetingInFocusPeriod(meeting: EnrichedMeeting) {
  const rawStart = meeting.derived.startAt || meeting.properties.hs_meeting_start_time || meeting.properties.hs_timestamp;
  if (!rawStart) return true;
  const start = Date.parse(rawStart);
  return !Number.isFinite(start) || start >= SETTER_FOCUS_START;
}

function inferredQualification(meeting: EnrichedMeeting): {
  status: SetterQualificationStatus;
  reason: string;
  outcome: string | null;
  result: SetterCommercialResult | null;
} {
  const outcome = commercialOutcome(meeting.properties.hs_internal_meeting_notes);
  if (outcome && POSITIVE_OUTCOMES.has(outcome)) {
    return { status: "qualified", reason: "Résultat commercial positif enregistré", outcome, result: "qualified" };
  }
  if (outcome && NEGATIVE_OUTCOMES.has(outcome)) {
    return { status: "not_qualified", reason: "Résultat commercial négatif enregistré", outcome, result: "not_qualified" };
  }
  if (meeting.derived.status === "NO_SHOW") {
    return { status: "not_qualified", reason: "Rendez-vous no-show", outcome, result: "no_show" };
  }
  if (meeting.derived.status === "CANCELED") {
    return { status: "not_qualified", reason: "Rendez-vous annulé", outcome, result: "not_qualified" };
  }

  const contact = meeting.associations.contact?.properties;
  const lifecycle = String(contact?.lifecyclestage || "").toLowerCase();
  const prospecting = String(contact?.statut_prospection || "").toLowerCase();
  if (lifecycle === "opportunity") {
    return { status: "qualified", reason: "Contact passé en opportunité", outcome, result: "qualified" };
  }
  if (["non qualifié", "perdu"].includes(prospecting)) {
    return { status: "not_qualified", reason: `Statut contact : ${contact?.statut_prospection}`, outcome, result: "not_qualified" };
  }

  return { status: "pending", reason: "Résultat commercial à renseigner", outcome, result: null };
}

function meetingBucket(meeting: EnrichedMeeting, result: SetterCommercialResult | null): SetterMeetingBucket {
  if (result) return "history";
  const start = meeting.derived.startAt ? Date.parse(meeting.derived.startAt) : NaN;
  if (Number.isFinite(start) && start > Date.now() && !["CANCELED", "NO_SHOW"].includes(meeting.derived.status)) return "upcoming";
  if (["CANCELED", "NO_SHOW"].includes(meeting.derived.status)) return "history";
  return "to_qualify";
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

function meetingSource(meeting: EnrichedMeeting) {
  return {
    id: meeting.id,
    properties: meeting.properties,
    associations: meeting.associations,
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireCockpitAccess();
    const url = new URL(request.url);
    const query = (url.searchParams.get("query") || "").trim().toLowerCase();
    const bucket = url.searchParams.get("bucket") as SetterMeetingBucket | "all" | null;

    const cockpit = await getMeetingsCockpit({ view: "all" });
    const setterMeetings = cockpit.results.filter(meeting => isSetterMeeting(meeting) && isMeetingInFocusPeriod(meeting));
    const reviews = await readReviews(setterMeetings.map(meeting => meeting.id));

    const rows = setterMeetings.map(meeting => {
      const inferred = inferredQualification(meeting);
      const review = reviews.get(meeting.id);
      const stored = parseStoredReview(review?.review_note);
      const commercialResult = stored?.result
        || (review?.qualification_status === "qualified"
          ? "qualified"
          : review?.qualification_status === "not_qualified"
            ? "not_qualified"
            : inferred.result);
      const qualificationStatus = review?.qualification_status || inferred.status;
      const qualificationReason = review
        ? stored?.note || (commercialResult === "follow_up" ? "Relance commerciale programmée" : "Résultat commercial renseigné")
        : inferred.reason;
      const workflowBucket = meetingBucket(meeting, commercialResult);

      return {
        ...meeting,
        setterTracking: {
          qualificationStatus,
          qualificationReason,
          commercialOutcome: inferred.outcome,
          commercialResult,
          bucket: workflowBucket,
          nextActionAt: stored?.nextActionAt || meeting.derived.nextActionAt || null,
          manuallyReviewed: Boolean(review),
          reviewNote: stored?.note || (review && !stored ? review.review_note : null),
          updatedByEmail: review?.updated_by_email || null,
          updatedAt: review?.updated_at || null,
        },
      };
    });

    rows.sort((a, b) => {
      const priority = (value: typeof rows[number]) => value.setterTracking.bucket === "to_qualify" ? 0 : value.setterTracking.bucket === "upcoming" ? 1 : 2;
      const priorityDiff = priority(a) - priority(b);
      if (priorityDiff) return priorityDiff;
      const aTime = a.derived.startAt ? Date.parse(a.derived.startAt) : 0;
      const bTime = b.derived.startAt ? Date.parse(b.derived.startAt) : 0;
      return a.setterTracking.bucket === "upcoming" ? aTime - bTime : bTime - aTime;
    });

    const searched = rows.filter(meeting => {
      if (!query) return true;
      const p = meeting.properties;
      const contact = meeting.associations.contact?.properties;
      const company = meeting.associations.company?.properties;
      return [p.hs_meeting_title, contact?.firstname, contact?.lastname, contact?.email, company?.name, company?.domain]
        .filter(Boolean).join(" ").toLowerCase().includes(query);
    });

    const filtered = searched.filter(meeting => !bucket || bucket === "all" || meeting.setterTracking.bucket === bucket);
    const toQualify = rows.filter(meeting => meeting.setterTracking.bucket === "to_qualify").length;
    const upcoming = rows.filter(meeting => meeting.setterTracking.bucket === "upcoming").length;
    const history = rows.filter(meeting => meeting.setterTracking.bucket === "history").length;
    const qualified = rows.filter(meeting => meeting.setterTracking.commercialResult === "qualified").length;
    const followUp = rows.filter(meeting => meeting.setterTracking.commercialResult === "follow_up").length;
    const notQualified = rows.filter(meeting => meeting.setterTracking.commercialResult === "not_qualified").length;
    const noShow = rows.filter(meeting => meeting.setterTracking.commercialResult === "no_show").length;
    const decided = qualified + notQualified + noShow;

    return NextResponse.json({
      results: filtered,
      total: rows.length,
      metrics: {
        total: rows.length,
        toQualify,
        upcoming,
        history,
        qualified,
        followUp,
        notQualified,
        noShow,
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
    if (!meetingId) throw Object.assign(new Error("Rendez-vous obligatoire."), { status: 400 });

    const legacyQualification = String(body?.qualificationStatus || "") as SetterQualificationStatus;
    const requestedResult = String(body?.commercialResult || "") as SetterCommercialResult;
    const commercialResult = COMMERCIAL_RESULTS.has(requestedResult) ? requestedResult : null;
    if (!commercialResult && !["qualified", "not_qualified", "pending"].includes(legacyQualification)) {
      throw Object.assign(new Error("Résultat commercial invalide."), { status: 400 });
    }

    const reviewNote = String(body?.reviewNote || "").trim().slice(0, 1000) || null;
    const setterOwnerId = String(body?.setterOwnerId || "").trim().slice(0, 120) || null;
    let nextActionAt = String(body?.nextActionAt || "").trim() || null;

    let qualificationStatus: SetterQualificationStatus = legacyQualification || "pending";
    if (commercialResult === "qualified") qualificationStatus = "qualified";
    if (commercialResult === "not_qualified" || commercialResult === "no_show") qualificationStatus = "not_qualified";
    if (commercialResult === "follow_up") qualificationStatus = "pending";

    if (commercialResult === "follow_up") {
      const parsed = nextActionAt ? new Date(nextActionAt) : null;
      if (!parsed || Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        throw Object.assign(new Error("Choisis une date de relance dans le futur."), { status: 400 });
      }
      nextActionAt = parsed.toISOString();
    } else {
      nextActionAt = null;
    }

    if (commercialResult === "follow_up" || commercialResult === "no_show") {
      const cockpit = await getMeetingsCockpit({ view: "all" });
      const meeting = cockpit.results.find(item => item.id === meetingId);
      if (commercialResult === "follow_up") {
        await processMeetingAction(meetingId, {
          action: "next_action",
          nextAction: "Relancer après le rendez-vous",
          dueAt: nextActionAt!,
          ...(meeting ? { source: meetingSource(meeting) } : {}),
        });
      } else {
        const actionResult = await processMeetingAction(meetingId, {
          action: "no_show",
          notes: reviewNote || "No-show enregistré depuis les rendez-vous setter",
          ...(meeting ? { source: meetingSource(meeting) } : {}),
        });
        nextActionAt = typeof actionResult?.nextActionAt === "string" ? actionResult.nextActionAt : null;
      }
    }

    const now = new Date().toISOString();
    const storedNote = commercialResult
      ? serializeReview(commercialResult, reviewNote, nextActionAt)
      : reviewNote;

    const { data, error } = await getSupabaseAdmin()
      .from("setter_meeting_reviews")
      .upsert({
        meeting_id: meetingId,
        qualification_status: qualificationStatus,
        setter_owner_id: setterOwnerId,
        review_note: storedNote,
        updated_by_email: access.email || null,
        updated_at: now,
      }, { onConflict: "meeting_id" })
      .select("meeting_id,qualification_status,setter_owner_id,review_note,updated_by_email,updated_at")
      .single();
    if (error) throw error;

    return NextResponse.json({ review: data, commercialResult, nextActionAt });
  } catch (error) {
    return apiError(error);
  }
}
