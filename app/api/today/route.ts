import { NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getCallRecommendations } from "@/lib/call-recommendations";
import { CALL_WINDOW_LABEL, getBestCallTimeForProperties, isWithinFrenchCallWindow } from "@/lib/call-timing";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type ContactProperties = Record<string, string | null | undefined>;

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message || "").trim();
    if (message) return message;
  }
  return "Impossible de charger les appels du jour.";
}

export async function GET() {
  try {
    const access = await requireCockpitAccess();
    const email = String(access.email || "").trim().toLowerCase();
    const recommendations = await getCallRecommendations({ bucket: "ACTIONABLE", limit: 2000 });
    const now = new Date();
    const callWindowOpen = isWithinFrenchCallWindow(now);

    const timed = recommendations.results.map(contact => {
      const original = contact.properties as ContactProperties;
      const timing = getBestCallTimeForProperties(original, now);
      const properties: ContactProperties = {
        ...original,
        // The Today card historically prefers `mobilephone`. The authoritative
        // contact number is normalized into `phone` by getCallRecommendations,
        // so expose it first here and keep mobilephone only as a fallback.
        mobilephone: original.phone || original.mobilephone,
        db_call_local_time: timing.localTime,
        db_call_timezone: timing.timezone,
        db_call_timing_reason: timing.reason,
        db_call_now: timing.callNow ? "true" : "false",
      };
      return { ...contact, properties, timing };
    });

    // Only explicit per-contact assignments determine SDR ownership.
    // Company assignments must never implicitly assign their contacts.
    const contactIds = timed.map(contact => contact.id).filter(Boolean);
    const { data: assignments, error: assignmentsError } = contactIds.length
      ? await getSupabaseAdmin().from("cockpit_contact_assignments")
          .select("contact_id,assignee_cockpit_email").in("contact_id", contactIds)
      : { data: [], error: null };
    // Assignment lookup is optional metadata: failure must never block another SDR.
    if (assignmentsError) console.warn("Contact assignments unavailable in /api/today:", assignmentsError.message);
    const assignmentByContact = new Map((assignments || []).map(row => [
      String(row.contact_id),
      String(row.assignee_cockpit_email || "").trim().toLowerCase(),
    ]));

    // Entire shared pool remains available to every SDR throughout the day.
    // Other people's manual assignments are metadata only, not a filter.
    const sharedQueue = timed.map(contact => {
      const assignee = assignmentByContact.get(contact.id) || null;
      const ownership = assignee === email ? "MINE" : assignee ? "OTHER" : "UNASSIGNED";
      return { ...contact, ownership, assignee };
    });
    const score = (contact: typeof sharedQueue[number]) => Number(contact.properties.db_call_score || 0);
    const mine = sharedQueue.filter(contact => contact.ownership === "MINE").sort((a, b) => score(b) - score(a));
    const available = sharedQueue.filter(contact => contact.ownership === "UNASSIGNED").sort((a, b) => score(b) - score(a));
    const other = sharedQueue.filter(contact => contact.ownership === "OTHER").sort((a, b) => score(b) - score(a));
    const callable = sharedQueue.filter(contact =>
      contact.timing.callNow && Boolean(String(contact.properties.phone || contact.properties.mobilephone || "").trim())
    );

    return NextResponse.json({
      member: { email, role: access.role, displayName: access.displayName || null },
      results: [...mine, ...available, ...other].slice(0, 250),
      mineCount: mine.length,
      availableCount: available.length,
      otherCount: other.length,
      callableCount: callable.length,
      readyCount: sharedQueue.length,
      callWindowOpen,
      totalActionable: recommendations.summary.ACTIONABLE,
      callWindow: CALL_WINDOW_LABEL,
      generatedAt: now.toISOString(),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Unable to load /api/today", error);
    const status = Number((error as { status?: number })?.status) || 500;
    return NextResponse.json({ error: errorMessage(error) }, { status });
  }
}
