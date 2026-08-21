import { NextRequest } from "next/server";
import { recordSDRoomEventWithIdentity } from "@/lib/sd-room-public-identity";
import { SD_CODES, type SDCode } from "@/lib/sd-room-types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const body = await request.json();
    const eventTypes = ["room_opened", "stage_viewed", "section_viewed", "heartbeat"];
    if (!eventTypes.includes(body?.eventType)) return Response.json({ error: "Événement invalide." }, { status: 400 });
    const documentCode: SDCode | null = SD_CODES.includes(body?.documentCode) ? body.documentCode : null;
    const metadata = body?.metadata && typeof body.metadata === "object" ? body.metadata : {};
    await recordSDRoomEventWithIdentity({
      token,
      email: body?.email,
      firstName: body?.firstName ?? metadata.firstName,
      lastName: body?.lastName ?? metadata.lastName,
      sessionId: body?.sessionId,
      eventType: body.eventType,
      documentCode,
      activeSeconds: body?.activeSeconds,
      metadata,
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    const value = error as Error & { status?: number };
    return Response.json({ error: value.message || "Événement refusé." }, { status: value.status || 500 });
  }
}
