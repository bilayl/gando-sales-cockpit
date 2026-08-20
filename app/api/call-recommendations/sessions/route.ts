import { NextRequest, NextResponse } from "next/server";
import {
  createSalesCallSession,
  getSalesCallSession,
  updateSalesCallSessionItem,
  type SalesCallSessionItemStatus,
} from "@/lib/call-recommendations";
import { apiError, isHubSpotAuthenticated } from "@/lib/hubspot";

export const dynamic = "force-dynamic";

async function requireAuth() {
  return isHubSpotAuthenticated();
}

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAuth())) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Reconnectez HubSpot pour continuer." }, { status: 401 });
    }
    const sessionId = new URL(request.url).searchParams.get("id");
    if (!sessionId) return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 400 });
    return NextResponse.json(await getSalesCallSession(sessionId), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await requireAuth())) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Reconnectez HubSpot pour continuer." }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const result = await createSalesCallSession({
      owner: body?.owner ? String(body.owner) : undefined,
      targetCount: body?.targetCount ? Number(body.targetCount) : 80,
      createdBy: body?.createdBy ? String(body.createdBy) : null,
    });
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await requireAuth())) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Reconnectez HubSpot pour continuer." }, { status: 401 });
    }
    const body = await request.json();
    const sessionId = String(body?.sessionId || "").trim();
    const hubspotContactId = String(body?.contactId || "").trim();
    const status = String(body?.status || "").toUpperCase() as SalesCallSessionItemStatus;
    if (!sessionId || !hubspotContactId) return NextResponse.json({ error: "SESSION_AND_CONTACT_REQUIRED" }, { status: 400 });
    if (!["QUEUED", "CALLED", "SKIPPED", "REMOVED"].includes(status)) {
      return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
    }
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
