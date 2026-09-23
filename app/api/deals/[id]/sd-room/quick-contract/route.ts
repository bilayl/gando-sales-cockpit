import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getSDRoomBundle, saveSDDocument } from "@/lib/sd-room";
import { requireSDInternalAccess } from "@/lib/sd-room-access";
import { createGandoRentalTemplate } from "@/lib/sd05-contract";
import { createEmptySD05, type SD05Content } from "@/lib/sd-stage-content";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "sd-room-files";
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

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

function currentContent(bundle: Awaited<ReturnType<typeof getSDRoomBundle>>) {
  const document = bundle.documents.find(item => item.code === "SD05");
  return { ...createEmptySD05(), ...((document?.content || {}) as Partial<SD05Content>) };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const userEmail = await requireSDInternalAccess();
    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Deal Room introuvable."), { status: 404 });
    if (bundle.room.room_mode !== "standard") throw Object.assign(new Error("Ce dépôt simplifié est réservé aux Deals rapides."), { status: 409 });

    const formData = await request.formData();
    const entry = formData.get("file");
    if (!(entry instanceof File)) throw Object.assign(new Error("Ajoutez un contrat Word ou PDF."), { status: 400 });
    const file = entry;
    const ext = extension(file.name);
    const accepted = Boolean(ext) && (MIME_TYPES.includes(file.type) || ["pdf", "doc", "docx"].includes(ext));
    if (!accepted) throw Object.assign(new Error("Formats acceptés : .doc, .docx ou .pdf."), { status: 400 });
    if (!file.size || file.size > MAX_FILE_SIZE) throw Object.assign(new Error("Le contrat doit faire moins de 20 Mo."), { status: 400 });

    const admin = getSupabaseAdmin();
    const previous = currentContent(bundle);
    const previousPath = storagePath(previous.contractUrl);
    const path = `sd05/${safeSegment(id)}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const uploaded = await admin.storage.from(BUCKET).upload(path, new Uint8Array(await file.arrayBuffer()), {
      contentType: file.type || (ext === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      cacheControl: "3600",
      upsert: false,
    });
    if (uploaded.error) throw uploaded.error;
    if (previousPath) await admin.storage.from(BUCKET).remove([previousPath]);
    const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(uploaded.data.path);

    const content: SD05Content = {
      ...previous,
      contractTitle: file.name,
      contractUrl: publicUrl.publicUrl,
      signatureUrl: "",
      signatureProvider: "gando",
      contractStatus: "client_review",
    };
    const document = await saveSDDocument({
      roomId: bundle.room.id,
      code: "SD05",
      content,
      sourceMode: "manual",
      updatedByEmail: userEmail,
      status: "published",
      changeSummary: `Contrat ${file.name} ajouté au Deal rapide`,
    });
    const now = new Date().toISOString();
    const { data: room, error: roomError } = await admin
      .from("deal_rooms")
      .update({ contract_uploaded_at: now, contract_signed_at: null, contract_signed_by_email: null })
      .eq("id", bundle.room.id)
      .select("*")
      .single();
    if (roomError) throw roomError;

    return Response.json({ document, room, url: publicUrl.publicUrl, name: file.name });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const userEmail = await requireSDInternalAccess();
    const body = await request.json().catch(() => ({}));
    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Deal Room introuvable."), { status: 404 });
    if (bundle.room.room_mode !== "standard") throw Object.assign(new Error("Action réservée aux Deals rapides."), { status: 409 });

    const current = currentContent(bundle);

    if (body?.action === "generate_template") {
      const base = current.contractTemplate === "rental_exact"
        ? current
        : createGandoRentalTemplate(bundle.room.company_name || bundle.room.title || "Loueur");
      const incoming = body?.rentalTemplate && typeof body.rentalTemplate === "object" ? body.rentalTemplate as Record<string, unknown> : {};
      const rentalTemplate: SD05Content["rentalTemplate"] = {
        ...base.rentalTemplate,
        legalName: String(incoming.legalName ?? base.rentalTemplate.legalName).trim().slice(0, 300),
        legalForm: String(incoming.legalForm ?? base.rentalTemplate.legalForm).trim().slice(0, 120),
        shareCapital: String(incoming.shareCapital ?? base.rentalTemplate.shareCapital).trim().slice(0, 120),
        siren: String(incoming.siren ?? base.rentalTemplate.siren).trim().slice(0, 120),
        vatNumber: String(incoming.vatNumber ?? base.rentalTemplate.vatNumber).trim().slice(0, 120),
        registeredOffice: String(incoming.registeredOffice ?? base.rentalTemplate.registeredOffice).trim().slice(0, 800),
        contactEmail: String(incoming.contactEmail ?? base.rentalTemplate.contactEmail).trim().slice(0, 320),
        activityRegion: String(incoming.activityRegion ?? base.rentalTemplate.activityRegion).trim().slice(0, 300),
        gandoRate: String(incoming.gandoRate ?? base.rentalTemplate.gandoRate).trim().slice(0, 30) || "2,70",
        partnerRate: String(incoming.partnerRate ?? base.rentalTemplate.partnerRate).trim().slice(0, 30) || "0,70",
        totalRate: String(incoming.totalRate ?? base.rentalTemplate.totalRate).trim().slice(0, 30) || "3,40",
      };
      const content: SD05Content = {
        ...base,
        contractUrl: "",
        signatureProvider: "odoo",
        rentalTemplate,
        goLiveDate: String(body?.goLiveDate || base.goLiveDate).trim().slice(0, 40),
        signatureDeadline: String(body?.signatureDeadline || base.signatureDeadline).trim().slice(0, 40),
        contractStatus: base.contractStatus === "signed" ? "signed" : (base.signatureUrl ? "ready_to_sign" : "client_review"),
      };
      const document = await saveSDDocument({
        roomId: bundle.room.id,
        code: "SD05",
        content,
        sourceMode: "manual",
        updatedByEmail: userEmail,
        status: content.contractStatus === "signed" ? "validated" : "published",
        changeSummary: current.contractTemplate === "rental_exact" ? "Modèle SD05 loueur mis à jour" : "Modèle SD05 loueur généré",
      });
      const now = new Date().toISOString();
      const { data: room, error: roomError } = await getSupabaseAdmin()
        .from("deal_rooms")
        .update({ contract_uploaded_at: bundle.room.contract_uploaded_at || now, contract_signed_at: content.contractStatus === "signed" ? bundle.room.contract_signed_at : null, contract_signed_by_email: content.contractStatus === "signed" ? bundle.room.contract_signed_by_email : null })
        .eq("id", bundle.room.id)
        .select("*")
        .single();
      if (roomError) throw roomError;
      return Response.json({ document, room });
    }

    const hasContract = Boolean(current.contractUrl || current.contractTemplate === "rental_exact");
    if (!hasContract) throw Object.assign(new Error("Ajoutez ou générez d’abord le contrat."), { status: 409 });

    if (body?.action === "configure_signature") {
      const signatureUrl = String(body?.signatureUrl || "").trim().slice(0, 2_000);
      const signatureProvider: SD05Content["signatureProvider"] = signatureUrl ? "odoo" : "gando";
      if (signatureUrl && !/^https?:\/\//i.test(signatureUrl)) {
        throw Object.assign(new Error("Ajoutez un lien Odoo Signature valide."), { status: 400 });
      }
      const content: SD05Content = {
        ...current,
        signatureProvider,
        signatureUrl,
        contractStatus: current.contractStatus === "signed" ? "signed" : (signatureUrl ? "ready_to_sign" : "client_review"),
      };
      const document = await saveSDDocument({
        roomId: bundle.room.id,
        code: "SD05",
        content,
        sourceMode: "manual",
        updatedByEmail: userEmail,
        status: current.contractStatus === "signed" ? "validated" : "published",
        changeSummary: signatureUrl ? "Odoo Signature configuré sur le Deal rapide" : "Signature Odoo désactivée sur le Deal rapide",
      });
      return Response.json({ document, room: bundle.room });
    }

    const requestedDate = String(body?.signedAt || "").trim();
    const parsed = requestedDate ? new Date(requestedDate) : new Date();
    if (Number.isNaN(parsed.getTime())) throw Object.assign(new Error("Date de signature invalide."), { status: 400 });
    const signedAt = parsed.toISOString();
    const signedByEmail = String(body?.signedByEmail || "").trim().toLowerCase().slice(0, 320) || null;

    const content: SD05Content = { ...current, contractStatus: "signed" };
    const document = await saveSDDocument({
      roomId: bundle.room.id,
      code: "SD05",
      content,
      sourceMode: "manual",
      updatedByEmail: userEmail,
      status: "validated",
      changeSummary: "Contrat marqué comme signé",
    });
    const { data: room, error } = await getSupabaseAdmin()
      .from("deal_rooms")
      .update({ contract_signed_at: signedAt, contract_signed_by_email: signedByEmail })
      .eq("id", bundle.room.id)
      .select("*")
      .single();
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
    const current = currentContent(bundle);
    const path = storagePath(current.contractUrl);
    const admin = getSupabaseAdmin();
    if (path) {
      const removed = await admin.storage.from(BUCKET).remove([path]);
      if (removed.error) throw removed.error;
    }
    const empty = createEmptySD05();
    const { data: document, error: documentError } = await admin
      .from("sd_documents")
      .update({ content: empty, published_content: null, status: "draft", published_at: null, published_version: null, validated_at: null, validated_by_email: null, validated_by_first_name: null, validated_by_last_name: null })
      .eq("room_id", bundle.room.id)
      .eq("code", "SD05")
      .select("*")
      .single();
    if (documentError) throw documentError;
    const { data: room, error } = await admin
      .from("deal_rooms")
      .update({ contract_uploaded_at: null, contract_signed_at: null, contract_signed_by_email: null })
      .eq("id", bundle.room.id)
      .select("*")
      .single();
    if (error) throw error;
    return Response.json({ ok: true, document, room });
  } catch (error) {
    return apiError(error);
  }
}