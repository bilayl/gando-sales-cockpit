import { NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HUBSPOT_ID_RE = /^\d+$/;

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireCockpitAccess();
  const { id } = await params;
  const candidate = decodeURIComponent(String(id || "")).trim();

  if (!candidate) {
    return NextResponse.json({ error: "Identifiant entreprise manquant." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  let row: { id?: string | null; hubspot_id?: string | null } | null = null;
  let error: { message?: string } | null = null;

  if (UUID_RE.test(candidate)) {
    const result = await supabase.from("companies").select("id,hubspot_id").eq("id", candidate).maybeSingle();
    row = result.data;
    error = result.error;
  } else {
    const result = await supabase.from("companies").select("id,hubspot_id").eq("hubspot_id", candidate).maybeSingle();
    row = result.data;
    error = result.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message || "Impossible de résoudre l’entreprise." }, { status: 500 });
  }

  const hubspotId = String(row?.hubspot_id || (HUBSPOT_ID_RE.test(candidate) ? candidate : "")).trim();
  const localId = String(row?.id || (UUID_RE.test(candidate) ? candidate : "")).trim();

  if (!hubspotId) {
    return NextResponse.json({
      error: "Cette entreprise n’a pas encore d’identifiant HubSpot exploitable. Synchronisez le CRM puis réessayez.",
      localId: localId || null,
    }, { status: 404 });
  }

  return NextResponse.json({
    localId: localId || null,
    hubspotId,
  }, { headers: { "cache-control": "no-store" } });
}
