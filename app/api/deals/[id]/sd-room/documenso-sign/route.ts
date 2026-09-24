import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { createDocumensoSignature } from "@/lib/documenso";
import { normalizeSD05NativeContent } from "@/lib/sd05-contract";
import { getSDRoomBundle, saveSDDocument } from "@/lib/sd-room";
import { requireSDInternalAccess } from "@/lib/sd-room-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function GET() {
  try {
    await requireSDInternalAccess();
    return Response.json({
      configured: Boolean(String(process.env.DOCUMENSO_API_TOKEN || "").trim()),
      baseUrl: String(process.env.DOCUMENSO_BASE_URL || "https://app.documenso.com/api/v2"),
      wordConversionConfigured: Boolean(String(process.env.GOTENBERG_URL || "").trim()),
      webhookConfigured: Boolean(String(process.env.DOCUMENSO_WEBHOOK_SECRET || "").trim()),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const userEmail = await requireSDInternalAccess();
    const body = await request.json().catch(() => ({}));
    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Deal Room introuvable."), { status: 404 });
    if (bundle.room.room_mode !== "standard") throw Object.assign(new Error("La signature automatisée est disponible dans les Deals rapides."), { status: 409 });

    const document = bundle.documents.find(item => item.code === "SD05");
    if (!document) throw Object.assign(new Error("Ajoutez ou générez d'abord le contrat."), { status: 409 });

    const content = normalizeSD05NativeContent(document.content);
    const hasGeneratedContract = Boolean(!content.contractUrl && content.contractTitle && content.contractSummary);
    if (!content.contractUrl && !hasGeneratedContract) throw Object.assign(new Error("Ajoutez ou générez d'abord le contrat."), { status: 409 });
    if (content.contractStatus === "signed") throw Object.assign(new Error("Ce contrat est déjà signé."), { status: 409 });

    const signerName = String(body?.signerName || "").trim().slice(0, 255);
    const signerEmail = String(body?.signerEmail || "").trim().toLowerCase().slice(0, 320);
    const signerRole = String(body?.signerRole || "").trim().slice(0, 255);
    if (signerName.length < 2) throw Object.assign(new Error("Renseignez le nom du signataire."), { status: 400 });
    if (!validEmail(signerEmail)) throw Object.assign(new Error("Renseignez un email de signataire valide."), { status: 400 });

    const clientIndex = content.signatories.findIndex(item => item.organization !== "GANDO SOLUTIONS");
    const clientSigner = {
      name: signerName,
      role: signerRole,
      organization: content.rentalTemplate.legalName || bundle.room.company_name || "Client",
      email: signerEmail,
      signatureStatus: "sent",
    };
    const signatories = [...content.signatories];
    if (clientIndex >= 0) signatories[clientIndex] = clientSigner;
    else signatories.unshift(clientSigner);

    const redirectUrl = new URL(`/r/${bundle.room.share_token}`, request.url).toString();
    const preparedContent = { ...content, signatories };
    const result = await createDocumensoSignature({
      content: preparedContent,
      companyName: bundle.room.company_name,
      roomId: bundle.room.id,
      documentId: document.id,
      signerName,
      signerEmail,
      redirectUrl,
    });

    const nextContent = {
      ...preparedContent,
      signatureProvider: "documenso" as const,
      signatureEnvelopeId: result.envelopeId,
      signatureUrl: result.signingUrl,
      signatureState: "sent" as const,
      signedDocumentUrl: "",
      contractStatus: "ready_to_sign" as const,
    };

    const updated = await saveSDDocument({
      roomId: bundle.room.id,
      code: "SD05",
      content: nextContent,
      sourceMode: "manual",
      updatedByEmail: userEmail,
      status: "published",
      changeSummary: `Contrat envoyé en signature Documenso à ${signerEmail}`,
    });

    return Response.json({
      document: updated,
      signingUrl: result.signingUrl,
      envelopeId: result.envelopeId,
    });
  } catch (error) {
    return apiError(error);
  }
}
