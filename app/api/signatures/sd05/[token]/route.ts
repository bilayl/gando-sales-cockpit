import { NextRequest } from "next/server";
import {
  expireSignatureRequestIfNeeded,
  findSignatureRequestByToken,
  markSignatureViewed,
  signSignatureRequest,
  signatureRequestSummary,
} from "@/lib/sd05-signature";

export const dynamic = "force-dynamic";

function technicalContext(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipAddress = forwarded || request.headers.get("x-real-ip")?.trim() || null;
  const userAgent = request.headers.get("user-agent")?.trim().slice(0, 1000) || null;
  return { ipAddress, userAgent };
}

function publicError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status || 500) : 500;
  const safeStatus = Number.isFinite(status) && status >= 400 && status < 600 ? status : 500;
  const message = error instanceof Error && safeStatus < 500 ? error.message : "Impossible de traiter cette signature pour le moment.";
  return Response.json({ error: message }, { status: safeStatus });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const found = await findSignatureRequestByToken(token);
    if (!found) throw Object.assign(new Error("Lien de signature invalide."), { status: 404 });
    let row = await expireSignatureRequestIfNeeded(found);
    if (row.status === "expired") throw Object.assign(new Error("Ce lien de signature a expiré."), { status: 410 });
    if (row.status === "revoked") throw Object.assign(new Error("Ce lien de signature a été révoqué. Demandez une nouvelle invitation à Gando."), { status: 410 });
    if (row.status === "failed") throw Object.assign(new Error("Cette invitation n'est plus active."), { status: 410 });
    const context = technicalContext(request);
    row = await markSignatureViewed(row, context.ipAddress, context.userAgent);
    return Response.json({
      request: signatureRequestSummary(row),
      signer: {
        name: row.signer_name,
        email: row.signer_email,
        role: row.signer_role,
        organization: row.signer_organization,
      },
      consentText: row.consent_text,
      snapshot: row.contract_snapshot,
    });
  } catch (error) {
    return publicError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const found = await findSignatureRequestByToken(token);
    if (!found) throw Object.assign(new Error("Lien de signature invalide."), { status: 404 });
    const input = await request.json().catch(() => ({}));
    const signatureName = typeof input.signatureName === "string" ? input.signatureName : "";
    const accepted = input.accepted === true;
    const context = technicalContext(request);
    const row = await signSignatureRequest({ row: found, signatureName, accepted, ...context });
    return Response.json({
      ok: true,
      request: signatureRequestSummary(row),
      proof: {
        signatureId: row.id,
        contractHash: row.contract_hash,
        signedPayloadHash: row.signed_payload_hash,
        signedAt: row.signed_at,
      },
    });
  } catch (error) {
    return publicError(error);
  }
}
