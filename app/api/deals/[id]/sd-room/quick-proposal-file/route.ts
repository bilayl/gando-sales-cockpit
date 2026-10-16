import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { apiError } from "@/lib/hubspot";
import { getSDRoomBundle, saveSDDocument } from "@/lib/sd-room";
import { requireSDInternalAccess } from "@/lib/sd-room-access";
import { normalizeStageContent, type SD04Content } from "@/lib/sd-stage-content";
import { readQuickApproval } from "@/lib/quick-deal-approval";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const BUCKET = "sd-room-files";
const MAX_SIZE = 20 * 1024 * 1024;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const userEmail = await requireSDInternalAccess();
    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Deal Room introuvable."), { status: 404 });
    if (bundle.room.room_mode !== "standard") throw Object.assign(new Error("Import réservé aux deals rapides."), { status: 409 });
    const document = bundle.documents.find(item => item.code === "SD04");
    if (!document || document.status === "validated")
      throw Object.assign(new Error("La proposition acceptée ne peut plus être remplacée."), { status: 409 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > MAX_SIZE)
      throw Object.assign(new Error("Ajoute un fichier inférieur à 20 Mo."), { status: 400 });
    const ext = file.name.split(".").at(-1)?.toLowerCase();
    if (!ext || !["pdf", "doc", "docx"].includes(ext))
      throw Object.assign(new Error("Formats autorisés : PDF, DOC ou DOCX."), { status: 400 });
    const mime = ext === "pdf" ? "application/pdf"
      : ext === "doc" ? "application/msword"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const path = "sd04/" + bundle.room.id + "/" + randomUUID() + "." + ext;
    const admin = getSupabaseAdmin();
    const upload = await admin.storage.from(BUCKET).upload(path, new Uint8Array(await file.arrayBuffer()), {
      contentType: mime,
      cacheControl: "3600",
      upsert: false,
    });
    if (upload.error) throw upload.error;
    const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(upload.data.path);
    const previous = normalizeStageContent("SD04", document.content) as SD04Content;
    const oldApproval = readQuickApproval(previous);
    const next: SD04Content = {
      ...previous,
      deckTitle: previous.deckTitle || "Proposition Gando × " + bundle.room.company_name,
      executiveMessage: previous.executiveMessage || "Veuillez consulter la proposition jointe avant de donner votre accord.",
      pricing: previous.pricing.length ? previous.pricing : [
        { item: "Tarif Gando", model: "commission", price: previous.gandoEconomics.gandoRatePercent.toLocaleString("fr-FR") + " % HT", notes: "par caution activée" },
        { item: "Marge partenaire", model: "commission", price: previous.gandoEconomics.partnerMarginPercent.toLocaleString("fr-FR") + " % HT", notes: "pour le loueur" },
      ],
      proposalFileUrl: publicUrl.publicUrl,
      proposalFileName: file.name.trim().slice(0, 300),
      internalApproval: {
        required: oldApproval.required, approvedAt: null, approvedByEmail: null, approvedHash: null,
      },
    };
    const saved = await saveSDDocument({
      roomId: bundle.room.id, code: "SD04", content: next,
      sourceMode: "manual", updatedByEmail: userEmail, status: "draft",
      changeSummary: "Import de la proposition " + next.proposalFileName,
    });
    return Response.json({ document: saved, name: next.proposalFileName });
  } catch (error) { return apiError(error); }
}
