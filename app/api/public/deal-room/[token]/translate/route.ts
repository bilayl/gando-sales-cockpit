import { NextRequest } from "next/server";
import { getPublicSDRoomWithIdentity } from "@/lib/sd-room-public-identity";
import { translatePublicDocumentContent } from "@/lib/public-room-translation";
import { SD_CODES, type SDCode } from "@/lib/sd-room-types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function publicError(error: unknown) {
  const value = error as Error & { status?: number };
  return Response.json({ error: value.message || "Translation unavailable." }, { status: value.status || 500 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const body = await request.json();
    const code = SD_CODES.includes(body?.documentCode) ? body.documentCode as SDCode : null;
    if (!code) throw Object.assign(new Error("Invalid document."), { status: 400 });

    const data = await getPublicSDRoomWithIdentity({
      token,
      email: body?.email,
      firstName: body?.firstName,
      lastName: body?.lastName,
    });
    const document = data.documents.find(item => item.code === code);
    if (!document) throw Object.assign(new Error("This document is not available."), { status: 404 });

    const content = await translatePublicDocumentContent(document.content);
    return Response.json({ document: { ...document, content }, language: "en" });
  } catch (error) {
    return publicError(error);
  }
}
