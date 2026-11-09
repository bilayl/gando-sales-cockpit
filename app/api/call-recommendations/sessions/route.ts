import { NextRequest, NextResponse } from "next/server";
import {
  getSalesCallSession,
  updateSalesCallSessionItem,
  type SalesCallSessionItemStatus,
} from "@/lib/call-recommendations";
import { createFilteredSalesCallSession } from "@/lib/call-session-builder";
import { apiError } from "@/lib/hubspot";
import { requireCockpitAccess, type CockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// SDRs use their Cockpit session; an extra personal HubSpot login is not required.
async function requireOwnedSession(sessionId: string, access: CockpitAccess) {
  const { data: session, error } = await getSupabaseAdmin()
    .from("sales_call_sessions")
    .select("id,created_by")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!session) throw Object.assign(new Error("Session d’appels introuvable."), { status: 404 });
  if (!access.canManageTeam && String(session.created_by || "").toLowerCase() !== String(access.email || "").toLowerCase()) {
    throw Object.assign(new Error("Cette session est attribuée à un autre commercial."), { status: 403 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireCockpitAccess();
    const sessionId = new URL(request.url).searchParams.get("id");
    if (!sessionId) return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 400 });
    await requireOwnedSession(sessionId, access);
    return NextResponse.json(await getSalesCallSession(sessionId), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireCockpitAccess();
    const body = await request.json().catch(() => ({}));
    if (!access.email) {
      return NextResponse.json({
        error: "EMAIL_REQUIRED",
        message: "Votre compte Cockpit doit disposer d’une adresse email pour ouvrir une session de contacts.",
      }, { status: 400 });
    }
    const result = await createFilteredSalesCallSession({
      location: body?.location ? String(body.location) : undefined,
      filters: body?.filters,
      targetCount: body?.targetCount ? Number(body.targetCount) : 80,
      createdBy: access.email || null,
    });
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await requireCockpitAccess();
    const body = await request.json();
    const sessionId = String(body?.sessionId || "").trim();
    const hubspotContactId = String(body?.contactId || "").trim();
    const status = String(body?.status || "").toUpperCase() as SalesCallSessionItemStatus;
    if (!sessionId || !hubspotContactId) return NextResponse.json({ error: "SESSION_AND_CONTACT_REQUIRED" }, { status: 400 });
    if (!["QUEUED", "CALLED", "SKIPPED", "REMOVED"].includes(status)) {
      return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
    }
    await requireOwnedSession(sessionId, access);
    const result = await updateSalesCallSessionItem({
      sessionId,
      hubspotContactId,
      status,
      outcome: body?.outcome ? String(body.outcome) : null,
    });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
