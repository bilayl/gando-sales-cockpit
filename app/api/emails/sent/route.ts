import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const rawLimit = Number(params.get("limit") || 100);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 250) : 100;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sent_emails")
      .select("id,provider,provider_message_id,contact_id,call_id,email_kind,recipient,subject,body,sent_at")
      .order("sent_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ emails: data || [] }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger les emails envoyés" }, { status: 500 });
  }
}
