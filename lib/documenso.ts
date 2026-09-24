import { contractPageCount } from "@/lib/sd05-contract";
import { buildBrandedSD05Pdf } from "@/lib/sd05-pdf";
import type { SD05Content } from "@/lib/sd-stage-content";

type DocumensoRecipient = {
  id?: number;
  email?: string;
  name?: string;
  signingUrl?: string;
  token?: string;
};

type DocumensoEnvelope = {
  id?: string;
  envelopeId?: string;
  status?: string;
  externalId?: string | null;
  envelopeItems?: Array<{ id?: string; title?: string; filename?: string }>;
  recipients?: DocumensoRecipient[];
};

const DEFAULT_BASE_URL = "https://app.documenso.com/api/v2";

function baseUrl() {
  return String(process.env.DOCUMENSO_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function apiToken() {
  const token = String(process.env.DOCUMENSO_API_TOKEN || "").trim();
  if (!token) throw Object.assign(new Error("Documenso n'est pas encore connecté. Ajoutez DOCUMENSO_API_TOKEN dans les variables d'environnement du cockpit."), { status: 503 });
  return token;
}

function jsonError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const source = payload as Record<string, unknown>;
    const message = source.message || source.error;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return fallback;
}

async function documensoFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", apiToken());
  const response = await fetch(`${baseUrl()}${path}`, { ...init, headers, cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw Object.assign(new Error(jsonError(payload, `Erreur Documenso (${response.status})`)), { status: 502 });
  }
  return response;
}

function sourceExtension(url: string) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.split(".").pop() || "";
  } catch {
    return "";
  }
}

async function convertWithGotenberg(buffer: Uint8Array, filename: string) {
  const gotenberg = String(process.env.GOTENBERG_URL || "").trim().replace(/\/$/, "");
  if (!gotenberg) {
    throw Object.assign(new Error("Le document Word doit être converti en PDF avant signature. Configurez GOTENBERG_URL pour automatiser la conversion DOC/DOCX → PDF."), { status: 409 });
  }
  const form = new FormData();
  form.append("files", new Blob([buffer]), filename);
  form.append("exportFormFields", "false");
  const response = await fetch(`${gotenberg}/forms/libreoffice/convert`, { method: "POST", body: form, cache: "no-store" });
  if (!response.ok) throw Object.assign(new Error(`Conversion Word → PDF impossible (${response.status}).`), { status: 502 });
  return new Uint8Array(await response.arrayBuffer());
}

export async function resolveContractPdf(input: { content: SD05Content; companyName: string }) {
  const { content, companyName } = input;
  if (!content.contractUrl) {
    return new Uint8Array(buildBrandedSD05Pdf({ content, companyName, signatures: [] }));
  }

  const source = await fetch(content.contractUrl, { cache: "no-store" });
  if (!source.ok) throw Object.assign(new Error("Impossible de récupérer le document source."), { status: 502 });
  const buffer = new Uint8Array(await source.arrayBuffer());
  const extension = sourceExtension(content.contractUrl);
  const contentType = source.headers.get("content-type") || "";

  if (extension === "pdf" || contentType.includes("application/pdf")) return buffer;
  if (extension === "doc" || extension === "docx" || contentType.includes("word")) {
    return convertWithGotenberg(buffer, content.contractTitle || `contrat.${extension || "docx"}`);
  }
  throw Object.assign(new Error("Seuls les PDF et documents Word peuvent être envoyés en signature."), { status: 400 });
}

function signatureFields(content: SD05Content) {
  if (content.contractTemplate === "rental_exact") {
    return [
      { identifier: 0, type: "SIGNATURE", page: 1, positionX: 7, positionY: 81, width: 31, height: 6 },
      { identifier: 0, type: "DATE", page: 1, positionX: 7, positionY: 76, width: 19, height: 3 },
    ];
  }
  const page = contractPageCount(content);
  return [
    { identifier: 0, type: "SIGNATURE", page, positionX: 10, positionY: 46, width: 35, height: 8 },
    { identifier: 0, type: "DATE", page, positionX: 10, positionY: 40, width: 22, height: 3 },
  ];
}

export async function createDocumensoSignature(input: {
  content: SD05Content;
  companyName: string;
  roomId: string;
  documentId: string;
  signerName: string;
  signerEmail: string;
  redirectUrl: string;
}) {
  const { content, companyName, roomId, documentId, signerName, signerEmail, redirectUrl } = input;
  const pdf = await resolveContractPdf({ content, companyName });
  const externalId = `gando-sd05:${roomId}:${documentId}`;

  const payload = {
    type: "DOCUMENT",
    title: content.contractTitle || `Contrat Gando × ${companyName}`,
    externalId,
    recipients: [{
      email: signerEmail,
      name: signerName,
      role: "SIGNER",
      signingOrder: 1,
      fields: signatureFields(content),
    }],
    meta: {
      subject: `Signature du contrat Gando × ${companyName}`,
      message: content.emailIntroText || "Merci de consulter puis signer le contrat.",
      redirectUrl,
    },
  };

  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  form.append("files", new Blob([pdf], { type: "application/pdf" }), `${content.contractReference || "contrat-gando"}.pdf`);

  const createResponse = await documensoFetch("/envelope/create", { method: "POST", body: form });
  const created = await createResponse.json() as DocumensoEnvelope;
  const envelopeId = String(created.id || created.envelopeId || "").trim();
  if (!envelopeId) throw Object.assign(new Error("Documenso n'a pas retourné d'identifiant de document."), { status: 502 });

  const distributeResponse = await documensoFetch("/envelope/distribute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ envelopeId }),
  });
  const distributed = await distributeResponse.json() as DocumensoEnvelope & { recipients?: DocumensoRecipient[] };
  const recipient = distributed.recipients?.find(item => String(item.email || "").toLowerCase() === signerEmail.toLowerCase()) || distributed.recipients?.[0];
  const signingUrl = String(recipient?.signingUrl || "").trim();
  if (!signingUrl) throw Object.assign(new Error("Documenso n'a pas retourné de lien de signature."), { status: 502 });

  return { envelopeId, signingUrl, externalId };
}

export async function getDocumensoEnvelope(envelopeId: string) {
  const response = await documensoFetch(`/envelope/${encodeURIComponent(envelopeId)}`);
  return response.json() as Promise<DocumensoEnvelope>;
}

export async function downloadSignedDocumensoPdf(envelopeId: string) {
  const envelope = await getDocumensoEnvelope(envelopeId);
  const itemId = String(envelope.envelopeItems?.[0]?.id || "").trim();
  if (!itemId) throw new Error("Le PDF signé Documenso est introuvable.");
  const response = await documensoFetch(`/envelope/item/${encodeURIComponent(itemId)}/download?version=signed`);
  return new Uint8Array(await response.arrayBuffer());
}

export function documensoWebhookSecret() {
  return String(process.env.DOCUMENSO_WEBHOOK_SECRET || "").trim();
}
