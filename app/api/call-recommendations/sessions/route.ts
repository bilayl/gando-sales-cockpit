import { NextRequest, NextResponse } from "next/server";
import {
  getSalesCallSession,
  updateSalesCallSessionItem,
  type SalesCallSessionItemStatus,
} from "@/lib/call-recommendations";
import { createFilteredSalesCallSession } from "@/lib/call-session-builder";
import { apiError, isHubSpotAuthenticated } from "@/lib/hubspot";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { resolveCockpitTaskAssignee } from "@/lib/cockpit-task-assignment";

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
    const access = await requireCockpitAccess();
    const assignee = await resolveCockpitTaskAssignee(access.email);
    const body = await request.json().catch(() => ({}));
    const requestedOwner = body?.owner ? String(body.owner).trim() : "";
    const effectiveOwner = access.canManageTeam && requestedOwner
      ? requestedOwner
      : assignee?.hubspotOwnerId;
    if (!effectiveOwner) {
      return NextResponse.json({
        error: "OWNER_REQUIRED",
        message: "Votre compte Cockpit n’est associé à aucun commercial HubSpot. Configurez la même adresse email dans HubSpot avant de démarrer une session.",
      }, { status: 400 });
    }
    const result = await createFilteredSalesCallSession({
      owner: effectiveOwner,
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
