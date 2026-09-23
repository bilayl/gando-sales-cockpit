import { apiError } from "@/lib/hubspot";
import { normalizeSD05NativeContent } from "@/lib/sd05-contract";
import { buildBrandedSD05Pdf } from "@/lib/sd05-pdf";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const admin = getSupabaseAdmin();
    const { data: room, error: roomError } = await admin
      .from("deal_rooms")
      .select("id,company_name,room_mode,status")
      .eq("share_token", token)
      .eq("status", "published")
      .eq("room_mode", "standard")
      .maybeSingle();
    if (roomError) throw roomError;
    if (!room) throw Object.assign(new Error("Deal Room introuvable."), { status: 404 });

    const { data: document, error: documentError } = await admin
      .from("sd_documents")
      .select("content,published_content,status,published_at")
      .eq("room_id", room.id)
      .eq("code", "SD05")
      .not("published_at", "is", null)
      .maybeSingle();
    if (documentError) throw documentError;
    if (!document) throw Object.assign(new Error("Contrat indisponible."), { status: 404 });

    const content = normalizeSD05NativeContent(document.published_content || document.content);
    if (content.contractTemplate !== "rental_exact") {
      throw Object.assign(new Error("Ce contrat n'est pas un modèle Gando généré."), { status: 409 });
    }

    const pdf = buildBrandedSD05Pdf({ content, companyName: room.company_name || content.rentalTemplate.legalName || "Loueur", signatures: [] });
    const safe = String(content.contractReference || "SD05-Gando").replace(/[^a-zA-Z0-9_-]+/g, "-");
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${safe}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
