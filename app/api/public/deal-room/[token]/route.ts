import { NextRequest } from "next/server";
import { getPublicSDRoom } from "@/lib/sd-room";

export const dynamic = "force-dynamic";

function publicError(error: unknown) {
  const value = error as Error & { status?: number };
  return Response.json({ error: value.message || "Impossible d’ouvrir la room." }, { status: value.status || 500 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const body = await request.json();
    const data = await getPublicSDRoom(token, body?.email);
    return Response.json({
      ...data,
      room: {
        ...data.room,
        displayTitle: `Room ${data.room.companyName}`,
        displaySubtitle: "Espace de collaboration stratégique",
      },
    });
  } catch (error) {
    return publicError(error);
  }
}
