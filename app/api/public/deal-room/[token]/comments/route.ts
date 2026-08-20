import { NextRequest } from "next/server";
import { addPublicSDRoomCommentWithIdentity } from "@/lib/sd-room-public-identity";
import { SD_CODES, type SDCode } from "@/lib/sd-room-types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const body = await request.json();
    const documentCode: SDCode = SD_CODES.includes(body?.documentCode) ? body.documentCode : "SD01";
    const comment = await addPublicSDRoomCommentWithIdentity({
      token,
      email: body?.email,
      firstName: body?.firstName,
      lastName: body?.lastName,
      documentCode,
      sectionKey: body?.sectionKey,
      body: body?.body,
    });
    return Response.json({ comment }, { status: 201 });
  } catch (error) {
    const value = error as Error & { status?: number };
    return Response.json({ error: value.message || "Remarque non enregistrée." }, { status: value.status || 500 });
  }
}
