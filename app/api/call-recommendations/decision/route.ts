import { NextRequest, NextResponse } from "next/server";
import { setCallRecommendationDecision, type SalesCallDecision } from "@/lib/call-recommendations";
import { apiError, isHubSpotAuthenticated } from "@/lib/hubspot";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!(await isHubSpotAuthenticated())) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Reconnectez HubSpot pour continuer." }, { status: 401 });
    }

    const body = await request.json();
    const hubspotContactId = String(body?.contactId || "").trim();
    const decision = String(body?.decision || "").toUpperCase() as SalesCallDecision;
    if (!hubspotContactId) return NextResponse.json({ error: "CONTACT_REQUIRED" }, { status: 400 });
    if (!["ACTIVE", "SNOOZED", "EXCLUDED"].includes(decision)) {
      return NextResponse.json({ error: "INVALID_DECISION" }, { status: 400 });
    }

    const result = await setCallRecommendationDecision({
      hubspotContactId,
      decision,
      snoozedUntil: body?.snoozedUntil ? String(body.snoozedUntil) : null,
      reason: body?.reason ? String(body.reason) : null,
      actor: body?.actor ? String(body.actor) : null,
    });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
