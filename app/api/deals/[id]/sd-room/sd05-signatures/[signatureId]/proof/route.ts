import { requireSDInternalAccess, getSDRoomBundle } from "@/lib/sd-room";
import { apiError } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { signatureEvidenceBundle, type SignatureRequestRow } from "@/lib/sd05-signature";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; signatureId: string }> }) {
  const { id, signatureId } = await params;
  try {
    await requireSDInternalAccess();
    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Room SD introuvable."), { status: 404 });

    const admin = getSupabaseAdmin();
    const { data: signature, error: signatureError } = await admin
      .from("sd_contract_signature_requests")
      .select("*")
      .eq("id", signatureId)
      .eq("room_id", bundle.room.id)
      .single();
    if (signatureError) throw Object.assign(new Error("Preuve de signature introuvable."), { status: 404 });

    const { data: events, error: eventsError } = await admin
      .from("sd_contract_signature_events")
      .select("id,event_type,ip_address,user_agent,metadata,occurred_at")
      .eq("signature_request_id", signatureId)
      .order("occurred_at", { ascending: true });
    if (eventsError) throw eventsError;

    const evidence = signatureEvidenceBundle(signature as SignatureRequestRow, events || []);
    const filename = `preuve-signature-${String(signature.contract_reference || signatureId).replace(/[^a-z0-9_-]+/gi, "-")}.json`;
    return new Response(JSON.stringify(evidence, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
