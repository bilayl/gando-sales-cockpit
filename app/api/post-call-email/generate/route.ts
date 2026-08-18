import { NextRequest, NextResponse } from "next/server";
import { generatePostCallEmail } from "@/lib/post-call-email";
import { isPostCallEmailKind } from "@/lib/post-call-email-types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const input = await request.json().catch(() => ({}));
    const draft = await generatePostCallEmail({
      firstName: typeof input.firstName === "string" ? input.firstName : "",
      companyName: typeof input.companyName === "string" ? input.companyName : "",
      callTitle: typeof input.callTitle === "string" ? input.callTitle : "",
      callBody: typeof input.callBody === "string" ? input.callBody : "",
      transcription: typeof input.transcription === "string" ? input.transcription : "",
      senderName: typeof input.senderName === "string" ? input.senderName : "",
      kind: isPostCallEmailKind(input.kind) ? input.kind : "recap",
    });
    return NextResponse.json(draft, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de générer l'email" }, { status: 500 });
  }
}
