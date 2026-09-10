import { NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getOnoffVoicemailUrl } from "@/lib/onoff";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireCockpitAccess();
  const { id } = await params;
  const voicemailId = decodeURIComponent(String(id || "")).trim();
  if (!voicemailId) return NextResponse.json({ error: "Voicemail ID manquant." }, { status: 400 });

  try {
    const url = await getOnoffVoicemailUrl(voicemailId);
    return NextResponse.redirect(url, 307);
  } catch (apiError) {
    const { data } = await getSupabaseAdmin()
      .from("onoff_call_processing")
      .select("raw_webhook")
      .eq("call_id", voicemailId)
      .eq("event_name", "VOICEMAIL")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const raw = (data?.raw_webhook || {}) as Record<string, unknown>;
    const fallback = String(raw.voicemailUrl || "").trim();
    if (/^https?:\/\//i.test(fallback)) return NextResponse.redirect(fallback, 307);

    return NextResponse.json({
      error: apiError instanceof Error ? apiError.message : "Message vocal indisponible.",
    }, { status: 404 });
  }
}
