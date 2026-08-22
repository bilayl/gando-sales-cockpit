import { apiError } from "@/lib/hubspot";
import { normalizeSD05NativeContent } from "@/lib/sd05-contract";
import { buildBrandedSD05Pdf, type SD05PdfSignature } from "@/lib/sd05-pdf";
import { getPublicSDRoom } from "@/lib/sd-room";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const email = new URL(request.url).searchParams.get("email") || "";
    const bundle = await getPublicSDRoom(token, email);
    const document = bundle.documents.find(item => item.code === "SD05");
    if (!document) throw Object.assign(new Error("SD05 introuvable."), { status: 404 });
    const content = normalizeSD05NativeContent(document.content);

    const { data: rows, error } = await getSupabaseAdmin()
      .from("sd_contract_signature_requests")
      .select("signer_name,signer_email,signer_role,signer_organization,signature_name,signature_mode,signed_at,contract_hash,signed_payload_hash,initials")
      .eq("document_id", document.id)
      .eq("status", "signed")
      .order("signed_at", { ascending: false });
    if (error) throw error;
    if (!rows?.length) throw Object.assign(new Error("Le PDF est disponible uniquement lorsqu'une signature valide existe."), { status: 409 });

    const latestBySigner = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const key = String(row.signer_email || row.signer_name || "").trim().toLowerCase();
      if (key && !latestBySigner.has(key)) latestBySigner.set(key, row);
    }
    const signatures: SD05PdfSignature[] = [...latestBySigner.values()].map(row => ({
      signerName: row.signer_name,
      signerEmail: row.signer_email,
      signerRole: row.signer_role,
      signerOrganization: row.signer_organization,
      signatureName: row.signature_name,
      signatureMode: row.signature_mode === "drawn" ? "drawn" : row.signature_mode === "typed" ? "typed" : null,
      signedAt: row.signed_at,
      contractHash: row.contract_hash,
      signedPayloadHash: row.signed_payload_hash,
      initials: row.initials && typeof row.initials === "object" ? row.initials as Record<string, string> : null,
    }));

    const pdf = buildBrandedSD05Pdf({ content, companyName: bundle.room.companyName, signatures });
    const safe = String(content.contractReference || "SD05-signe").replace(/[^a-zA-Z0-9_-]+/g, "-");
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${safe}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
