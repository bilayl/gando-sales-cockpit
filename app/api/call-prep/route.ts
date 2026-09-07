import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { generateAiCallPrep } from "@/lib/ai-call-prep";

export async function POST(request: NextRequest) {
  try {
    await requireCockpitAccess();
    const body = await request.json().catch(() => ({}));
    if (!body?.context || typeof body.context !== "object") {
      return NextResponse.json({ error: "CALL_PREP_CONTEXT_REQUIRED" }, { status: 400 });
    }

    const result = await generateAiCallPrep(body.context);
    return NextResponse.json({
      ...result,
      generatedAt: new Date().toISOString(),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Impossible de préparer l’appel" }, { status: e.status || 500 });
  }
}
