import { NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getOnoffRecordingUrl } from "@/lib/onoff";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireCockpitAccess();
  const { id } = await params;
  const callId = decodeURIComponent(String(id || "")).trim();
  if (!callId) return NextResponse.json({ error: "Call ID manquant." }, { status: 400 });

  try {
    const url = await getOnoffRecordingUrl(callId);
    return NextResponse.redirect(url, 307);
  } catch (apiError) {
    const { data } = await getSupabaseAdmin()
      .from("onoff_call_processing")
      .select("recording_url,raw_webhook")
      .eq("call_id", callId)
      .eq("event_name", "RECORDING")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const raw = (data?.raw_webhook || {}) as Record<string, unknown>;
    const fallback = String(data?.recording_url || raw.callRecordingUrl || "").trim();
    if (/^https?:\/\//i.test(fallback)) return NextResponse.redirect(fallback, 307);

    return NextResponse.json({
      error: apiError instanceof Error ? apiError.message : "Enregistrement indisponible.",
    }, { status: 404 });
  }
}
