import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { processDealRoomAction } from "@/lib/hubspot/deals";
import type { DealRoomActionInput } from "@/lib/deal-room-types";

export const dynamic = "force-dynamic";

const VALID_ACTIONS = new Set([
  "log_call", "note", "task", "meeting", "stage", "next_step", "blocker", "contact", "stakeholder_role", "closing_plan",
]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json() as DealRoomActionInput;
    if (!body || typeof body !== "object") throw new Error("Corps de requête invalide");
    if (!body.action || !VALID_ACTIONS.has(body.action)) throw new Error("Action invalide");
    const result = await processDealRoomAction(id, body);
    return Response.json(result);
  } catch (error) {
    return apiError(error);
  }
}