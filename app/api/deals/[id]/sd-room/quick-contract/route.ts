import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getSDRoomBundle, saveSDDocument } from "@/lib/sd-room";
import { requireSDInternalAccess } from "@/lib/sd-room-access";
import { createEmptySD05, type SD05Content } from "@/lib/sd-stage-content";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "sd-room-files";
const MAX_FILE_SIZE = 20 * 1024 * 1024;
type ManualContractStatus = "draft" | "ready_to_sign" | "signed";

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "deal";
}

function extension(name: string) {
  const ext = name.toLowerCase().split(".").pop();
  return ext === "pdf" || ext === "doc" || ext === "docx" ? ext : "";
}

function storagePath(url: string) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  return index < 0 ? null : decodeURIComponent(url.slice(index + marker.length).split(/[?#]/)[0] || "");
}

function currentContent(bundle: Awaited<ReturnType<typeof getSDRoomBundle>>): SD05Content {
  const document = bundle.documents.find(item => item.code === "SD05");
  return { ...createEmptySD05(), ...((document?.content || {}) as Partial<SD05Content>) };
}

function hasContract(content: SD05Content) {
  return Boolean(content.contractUrl || (content.contractTitle && content.contractSummary));
}

function withoutAutomaticSignature(content: SD05Content): SD05Content {
  return {
    ...content,
    signatureProvider: "gando",
    signatureUrl: "",
    signatureEnvelopeId: "",
    signatureState: "not_configured",
    signedDocumentUrl: "",
  };
}

async function clearDraftPublication(documentId: string) {
  // saveSDDocument retains previously published snapshots when reverting to a
  // draft. Remove them explicitly so an old signed copy is not publicly served.
  const { data, error } = await getSupabaseAdmin().from("sd_documents").update({
    published_at: null,
    published_content: null,
    published_version: null,
    validated_at: null,
    validated_by_email: null,
    validated_by_first_name: null,
    validated_by_last_name: null,
  }).eq("id", documentId).select("*").single();
  if (error) throw error;
  return data;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const userEmail = await requireSDInternalAccess();
    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Deal Room introuvable."), { status: 404 });
    if (bundle.room.room_mode !== "standard") throw Object.assign(new Error("Action réservée aux Deals rapides."), { status: 409 });

    const formData = await request.formData();
    const entry = formData.get("file");
    if (!(entry instanceof File)) throw Object.assign(new Error("Ajoutez un contrat Word ou PDF."), { status: 400 });
    const ext = extension(entry.name);
    if (!ext) throw Object.assign(new Error("Formats acceptés : .doc, .docx ou .pdf."), { status: 400 });
    if (!entry.size || entry.size > MAX_FILE_SIZE) throw Object.assign(new Error("Le contrat doit faire moins de 20 Mo."), { status: 400 });

    const admin = getSupabaseAdmin();
    const previous = currentContent(bundle);
    const previousPath = storagePath(previous.contractUrl);
    const path = `sd05/${safeSegment(id)}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const uploaded = await admin.storage.from(BUCKET).upload(path, new Uint8Array(await entry.arrayBuffer()), {
      contentType: ext === "pdf" ? "application/pdf" : ext === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/msword",
      cacheControl: "3600",
      upsert: false,
    });
    if (uploaded.error) throw uploaded.error;
    const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(uploaded.data.path);

    try {
      const content: SD05Content = withoutAutomaticSignature({
        ...createEmptySD05(),
        contractTitle: entry.name,
        contractUrl: publicUrl.publicUrl,
        contractStatus: "draft",
      });
      const saved = await saveSDDocument({
        roomId: bundle.room.id, code: "SD05", content, sourceMode: "manual",
        updatedByEmail: userEmail, status: "draft",
        changeSummary: `Fichier contrat ${entry.name} enregistré (statut à définir manuellement)`,
      });
      const document = await clearDraftPublication(saved.id);
      const { data: room, error: roomError } = await admin.from("deal_rooms")
        .update({ contract_uploaded_at: new Date().toISOString(), contract_signed_at: null, contract_signed_by_email: null })
        .eq("id", bundle.room.id).select("*").single();
      if (roomError) throw roomError;
      if (previousPath) await admin.storage.from(BUCKET).remove([previousPath]);
      return Response.json({ document, room, url: publicUrl.publicUrl, name: entry.name });
    } catch (error) {
      await admin.storage.from(BUCKET).remove([uploaded.data.path]);
      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const userEmail = await requireSDInternalAccess();
    const body = await request.json().catch(() => ({}));
    if (body?.action !== "set_status") {
      throw Object.assign(new Error("Seul le statut manuel du contrat peut être modifié."), { status: 400 });
    }
    const status = body?.contractStatus as ManualContractStatus;
    if (status !== "draft" && status !== "ready_to_sign" && status !== "signed") {
      throw Object.assign(new Error("Statut invalide."), { status: 400 });
    }

    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Deal Room introuvable."), { status: 404 });
    if (bundle.room.room_mode !== "standard") throw Object.assign(new Error("Action réservée aux Deals rapides."), { status: 409 });
    const current = currentContent(bundle);
    if (status !== "draft" && !hasContract(current)) {
      throw Object.assign(new Error("Enregistrez d'abord un contrat avant de modifier son statut."), { status: 409 });
    }

    const labels: Record<ManualContractStatus, string> = {
      draft: "Pas rédigé", ready_to_sign: "En attente de signature", signed: "Signé",
    };
    const content = withoutAutomaticSignature({ ...current, contractStatus: status });
    const saved = await saveSDDocument({
      roomId: bundle.room.id, code: "SD05", content, sourceMode: "manual",
      updatedByEmail: userEmail,
      status: status === "draft" ? "draft" : status === "signed" ? "validated" : "published",
      changeSummary: `Statut du contrat défini manuellement : ${labels[status]}`,
    });
    const document = status === "draft" ? await clearDraftPublication(saved.id) : saved;
    const now = new Date().toISOString();
    const { data: room, error } = await getSupabaseAdmin().from("deal_rooms")
      .update({
        contract_signed_at: status === "signed" ? (bundle.room.contract_signed_at || now) : null,
        contract_signed_by_email: status === "signed" ? userEmail : null,
      })
      .eq("id", bundle.room.id).select("*").single();
    if (error) throw error;
    return Response.json({ document, room });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireSDInternalAccess();
    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Deal Room introuvable."), { status: 404 });
    if (bundle.room.room_mode !== "standard") throw Object.assign(new Error("Action réservée aux Deals rapides."), { status: 409 });
    const current = currentContent(bundle);
    const path = storagePath(current.contractUrl);
    const admin = getSupabaseAdmin();
    const { data: document, error: documentError } = await admin.from("sd_documents")
      .update({
        content: createEmptySD05(), published_content: null, status: "draft",
        published_at: null, published_version: null, validated_at: null,
        validated_by_email: null, validated_by_first_name: null, validated_by_last_name: null,
      })
      .eq("room_id", bundle.room.id).eq("code", "SD05").select("*").single();
    if (documentError) throw documentError;
    const { data: room, error } = await admin.from("deal_rooms")
      .update({ contract_uploaded_at: null, contract_signed_at: null, contract_signed_by_email: null })
      .eq("id", bundle.room.id).select("*").single();
    if (error) throw error;
    if (path) await admin.storage.from(BUCKET).remove([path]);
    return Response.json({ ok: true, document, room });
  } catch (error) {
    return apiError(error);
  }
}
