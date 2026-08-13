import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/hubspot";
import { saveCallOutcome } from "@/lib/hubspot/contacts";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const outcome = String(body.outcome || "").trim();
    const reminderAt = body.reminderAt ? String(body.reminderAt) : undefined;
    if (!outcome) return NextResponse.json({ error: "Choisissez un résultat d’appel" }, { status: 400 });
    return NextResponse.json(await saveCallOutcome(id, outcome, reminderAt));
  } catch (error) {
    return apiError(error);
  }
}
