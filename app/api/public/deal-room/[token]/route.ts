import { NextRequest } from "next/server";
import { getPublicSDRoomWithIdentity } from "@/lib/sd-room-public-identity";

export const dynamic = "force-dynamic";

function publicError(error: unknown) {
  const value = error as Error & { status?: number };
  return Response.json({ error: value.message || "Impossible d’ouvrir la room." }, { status: value.status || 500 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const body = await request.json();
    const data = await getPublicSDRoomWithIdentity({
      token,
      email: body?.email,
      firstName: body?.firstName,
      lastName: body?.lastName,
    });
    return Response.json({
      ...data,
      room: {
        ...data.room,
        displayTitle: data.room.displayTitle || data.room.companyName,
        displaySubtitle: data.room.displaySubtitle || "Espace de collaboration",
      },
    });
  } catch (error) {
    return publicError(error);
  }
}
