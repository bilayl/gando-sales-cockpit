import { NextRequest } from "next/server";
import { getPublicSDRoomWithIdentity } from "@/lib/sd-room-public-identity";
import { normalizeSD05NativeContent } from "@/lib/sd05-contract";
import { buildSignedSD05Pdf, type SignedPdfSignature } from "@/lib/sd05-pdf";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function publicError(error: unknown) {
  const value = error as Error & { status?: number };
  return Response.json({ error: value.message || "Téléchargement impossible." }, { status: value.status || 500 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const body = await request.json();
    const data = await getPublicSDRoomWithIdentity({
      token,
      email: body?.email,
      firstName: body?.firstName,
      lastName: body?.lastName,
    });
    const document = data.documents.find(item => item.code === "SD05");
    if (!document) throw Object.assign(new Error("SD05 introuvable."), { status: 404 });
    const content = normalizeSD05NativeContent(document.content);
    if (content.contractStatus !== "signed" || document.status !== "validated") {
      throw Object.assign(new Error("Le PDF est disponible uniquement lorsque le contrat est signé."), { status: 409 });
    }

    const { data: signatures, error } = await getSupabaseAdmin()
      .from("sd_contract_signature_requests")
      .select("signer_name,signer_email,signer_role,signer_organization,signature_name,signature_mode,signed_at,contract_hash,signed_payload_hash")
      .eq("document_id", document.id)
      .eq("status", "signed")
      .order("signed_at", { ascending: true });
    if (error) throw error;

    const pdf = buildSignedSD05Pdf({
      content,
      companyName: data.room.companyName,
      signatures: (signatures || []) as SignedPdfSignature[],
    });
    const safe = String(content.contractReference || "SD05-signe").replace(/[^a-zA-Z0-9_-]+/g, "-");
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${safe}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return publicError(error);
  }
}
