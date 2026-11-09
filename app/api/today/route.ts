import { NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getCallRecommendations } from "@/lib/call-recommendations";
import { CALL_WINDOW_LABEL, getBestCallTimeForProperties } from "@/lib/call-timing";
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
    if (assignmentsError) throw assignmentsError;
    const assignmentByContact = new Map((assignments || []).map(row => [
      String(row.contact_id),
      String(row.assignee_cockpit_email || "").trim().toLowerCase(),
    ]));

    const callable = timed
      .filter(contact => contact.timing.callNow)
      .map(contact => {
        const assignee = assignmentByContact.get(contact.id) || null;
        const ownership = assignee === email ? "MINE" : assignee ? "OTHER" : "UNASSIGNED";
        return { ...contact, ownership, assignee };
      });

    const mine = callable
      .filter(contact => contact.ownership === "MINE")
      .sort((a, b) => Number(b.properties.db_call_score || 0) - Number(a.properties.db_call_score || 0));
    const available = callable
      .filter(contact => contact.ownership === "UNASSIGNED")
      .sort((a, b) => Number(b.properties.db_call_score || 0) - Number(a.properties.db_call_score || 0));

    return NextResponse.json({
      member: { email, role: access.role, displayName: access.displayName || null },
      results: [...mine, ...available].slice(0, 250),
      mineCount: mine.length,
      availableCount: available.length,
      callableCount: callable.length,
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
