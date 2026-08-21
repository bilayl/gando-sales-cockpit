import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeSD05NativeContent, SD05_SIGNATURE_CONSENT } from "@/lib/sd05-contract";
import type { SD05Content } from "@/lib/sd-stage-content";
import type { SDDocumentRecord, SDRoomRecord } from "@/lib/sd-room-types";

export type SignatureRequestRow = {
  id: string;
  room_id: string;
  document_id: string;
  signer_name: string;
  signer_email: string;
  signer_role: string | null;
  signer_organization: string | null;
  token_hash: string;
  contract_reference: string | null;
  contract_version: string | null;
  contract_snapshot: SD05SigningSnapshot;
  contract_hash: string;
  signed_payload_hash: string | null;
  status: "pending" | "sent" | "viewed" | "signed" | "expired" | "revoked" | "failed";
  consent_text: string;
  signature_name: string | null;
  signature_ip: string | null;
  signature_user_agent: string | null;
  smtp_provider_message_id: string | null;
  smtp_request_id: string | null;
  expires_at: string | null;
  sent_at: string | null;
  first_viewed_at: string | null;
  signed_at: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
};

export type SD05SigningSnapshot = {
  schemaVersion: "gando-sd05-signature-v1";
  room: {
    id: string;
    title: string;
    companyName: string;
  };
  document: {
    id: string;
    title: string;
    version: number;
    contractReference: string;
    contractVersion: string;
  };
  content: SD05Content;
};

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashSignatureToken(token: string) {
  return sha256Hex(token);
}

export function createSignatureToken() {
  return randomBytes(32).toString("base64url");
}

export function buildSD05SigningSnapshot(room: SDRoomRecord, document: SDDocumentRecord, rawContent: unknown): SD05SigningSnapshot {
  const content = normalizeSD05NativeContent(rawContent);
  return {
    schemaVersion: "gando-sd05-signature-v1",
    room: { id: room.id, title: room.title, companyName: room.company_name },
    document: {
      id: document.id,
      title: document.title,
      version: document.version,
      contractReference: content.contractReference,
      contractVersion: content.contractVersion,
    },
    content,
  };
}

export function hashSD05SigningSnapshot(snapshot: SD05SigningSnapshot) {
  return sha256Hex(JSON.stringify(stable(snapshot)));
}

export function signatureRequestSummary(row: SignatureRequestRow) {
  return {
    id: row.id,
    signerName: row.signer_name,
    signerEmail: row.signer_email,
    signerRole: row.signer_role,
    signerOrganization: row.signer_organization,
    status: row.status,
    contractHash: row.contract_hash,
    signedPayloadHash: row.signed_payload_hash,
    sentAt: row.sent_at,
    firstViewedAt: row.first_viewed_at,
    signedAt: row.signed_at,
    expiresAt: row.expires_at,
  };
}

export async function recordSignatureEvent(input: {
  requestId: string;
  eventType: "created" | "email_sent" | "email_failed" | "viewed" | "signed" | "revoked" | "expired";
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await getSupabaseAdmin().from("sd_contract_signature_events").insert({
    signature_request_id: input.requestId,
    event_type: input.eventType,
    ip_address: input.ipAddress || null,
    user_agent: input.userAgent?.slice(0, 1000) || null,
    metadata: input.metadata || {},
  });
  if (error) throw error;
}

export async function findSignatureRequestByToken(token: string): Promise<SignatureRequestRow | null> {
  if (!token || token.length < 30 || token.length > 200) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("sd_contract_signature_requests")
    .select("*")
    .eq("token_hash", hashSignatureToken(token))
    .maybeSingle();
  if (error) throw error;
  return data ? data as SignatureRequestRow : null;
}

export async function expireSignatureRequestIfNeeded(row: SignatureRequestRow) {
  if (!row.expires_at || row.status === "signed" || row.status === "revoked" || row.status === "expired") return row;
  if (new Date(row.expires_at).getTime() >= Date.now()) return row;
  const { data, error } = await getSupabaseAdmin()
    .from("sd_contract_signature_requests")
    .update({ status: "expired" })
    .eq("id", row.id)
    .select("*")
    .single();
  if (error) throw error;
  await recordSignatureEvent({ requestId: row.id, eventType: "expired" });
  return data as SignatureRequestRow;
}

export async function markSignatureViewed(row: SignatureRequestRow, ipAddress?: string | null, userAgent?: string | null) {
  if (row.first_viewed_at || row.status === "signed" || row.status === "revoked" || row.status === "expired") return row;
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("sd_contract_signature_requests")
    .update({ status: "viewed", first_viewed_at: now })
    .eq("id", row.id)
    .is("first_viewed_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return row;
  await recordSignatureEvent({ requestId: row.id, eventType: "viewed", ipAddress, userAgent });
  return data as SignatureRequestRow;
}

async function updateDocumentAfterSignature(row: SignatureRequestRow) {
  const admin = getSupabaseAdmin();
  const { data: document, error: documentError } = await admin
    .from("sd_documents")
    .select("*")
    .eq("id", row.document_id)
    .single();
  if (documentError) throw documentError;

  const content = normalizeSD05NativeContent(document.content);
  const signedEmail = row.signer_email.trim().toLowerCase();
  const nextSignatories = content.signatories.map(signer => signer.email.trim().toLowerCase() === signedEmail ? { ...signer, signatureStatus: "signed" } : signer);

  const { data: signedRows, error: signedRowsError } = await admin
    .from("sd_contract_signature_requests")
    .select("signer_email")
    .eq("document_id", row.document_id)
    .eq("contract_hash", row.contract_hash)
    .eq("status", "signed");
  if (signedRowsError) throw signedRowsError;
  const signedEmails = new Set((signedRows || []).map(item => String(item.signer_email || "").trim().toLowerCase()).filter(Boolean));
  signedEmails.add(signedEmail);
  const requiredEmails = nextSignatories.map(item => item.email.trim().toLowerCase()).filter(Boolean);
  const allSigned = requiredEmails.length > 0 && requiredEmails.every(email => signedEmails.has(email));
  const nextContent: SD05Content = { ...content, signatories: nextSignatories, contractStatus: allSigned ? "signed" : "ready_to_sign" };

  const updates: Record<string, unknown> = { content: nextContent };
  if (allSigned) {
    updates.status = "validated";
    updates.published_content = nextContent;
    updates.published_at = document.published_at || new Date().toISOString();
  }
  const { error: updateError } = await admin.from("sd_documents").update(updates).eq("id", row.document_id);
  if (updateError) throw updateError;
  return { allSigned, content: nextContent };
}

export async function signSignatureRequest(input: {
  row: SignatureRequestRow;
  signatureName: string;
  accepted: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  let row = await expireSignatureRequestIfNeeded(input.row);
  if (row.status === "signed") return row;
  if (row.status === "expired") throw Object.assign(new Error("Ce lien de signature a expiré."), { status: 410 });
  if (row.status === "revoked") throw Object.assign(new Error("Ce lien de signature a été révoqué."), { status: 410 });
  if (row.status === "failed") throw Object.assign(new Error("Cette invitation n'est plus active."), { status: 410 });
  if (!input.accepted) throw Object.assign(new Error("Le consentement à la signature électronique est requis."), { status: 400 });

  const signatureName = input.signatureName.trim().replace(/\s+/g, " ").slice(0, 300);
  if (signatureName.length < 2) throw Object.assign(new Error("Saisissez votre nom complet pour signer."), { status: 400 });

  const recomputedHash = hashSD05SigningSnapshot(row.contract_snapshot);
  if (recomputedHash !== row.contract_hash) {
    throw Object.assign(new Error("L'intégrité du document ne peut pas être vérifiée. La signature est bloquée."), { status: 409 });
  }

  const signedAt = new Date().toISOString();
  const signedPayloadHash = sha256Hex(JSON.stringify(stable({
    schemaVersion: "gando-sd05-proof-v1",
    requestId: row.id,
    contractHash: row.contract_hash,
    signerEmail: row.signer_email.toLowerCase(),
    signerName: row.signer_name,
    signatureName,
    consentText: row.consent_text || SD05_SIGNATURE_CONSENT,
    signedAt,
    ipAddress: input.ipAddress || null,
    userAgent: input.userAgent || null,
  })));

  const { data, error } = await getSupabaseAdmin()
    .from("sd_contract_signature_requests")
    .update({
      status: "signed",
      signature_name: signatureName,
      signature_ip: input.ipAddress || null,
      signature_user_agent: input.userAgent?.slice(0, 1000) || null,
      signed_payload_hash: signedPayloadHash,
      signed_at: signedAt,
    })
    .eq("id", row.id)
    .neq("status", "signed")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (data) row = data as SignatureRequestRow;

  await recordSignatureEvent({
    requestId: row.id,
    eventType: "signed",
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: { signedPayloadHash, contractHash: row.contract_hash, consentAccepted: true, consentText: row.consent_text },
  });
  await updateDocumentAfterSignature(row);
  return row;
}

export function signatureEvidenceBundle(row: SignatureRequestRow, events: Array<Record<string, unknown>>) {
  return {
    schemaVersion: "gando-sd05-evidence-v1",
    generatedAt: new Date().toISOString(),
    signature: {
      id: row.id,
      status: row.status,
      signer: {
        name: row.signer_name,
        email: row.signer_email,
        role: row.signer_role,
        organization: row.signer_organization,
        signatureName: row.signature_name,
      },
      sentAt: row.sent_at,
      firstViewedAt: row.first_viewed_at,
      signedAt: row.signed_at,
      expiresAt: row.expires_at,
      contractReference: row.contract_reference,
      contractVersion: row.contract_version,
      contractHashSha256: row.contract_hash,
      signedPayloadHashSha256: row.signed_payload_hash,
      consentText: row.consent_text,
      technicalEvidence: {
        ipAddress: row.signature_ip,
        userAgent: row.signature_user_agent,
        smtpProviderMessageId: row.smtp_provider_message_id,
        smtpRequestId: row.smtp_request_id,
      },
    },
    contractSnapshot: row.contract_snapshot,
    auditTrail: events,
  };
}
