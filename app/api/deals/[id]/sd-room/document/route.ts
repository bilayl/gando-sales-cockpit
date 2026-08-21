import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getSDRoomBundle, saveSDDocument } from "@/lib/sd-room";
import { requireSDInternalAccess } from "@/lib/sd-room-access";
import { normalizeStageContent } from "@/lib/sd-stage-content";
import { normalizeSD05NativeContent } from "@/lib/sd05-contract";
import { SD_CODES, type SDCode } from "@/lib/sd-room-types";

export const dynamic = "force-dynamic";

const REQUIRED_BEFORE_PUBLISH: Partial<Record<SDCode, SDCode[]>> = {
  SD03: ["SD02"],
  SD04: ["SD02"],
  SD05: ["SD01", "SD02"],
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const userEmail = await requireSDInternalAccess();
    const body = await request.json();
    const code = SD_CODES.includes(body?.code) ? body.code as SDCode : null;
    if (!code || code === "SD01") throw Object.assign(new Error("Étape SD invalide."), { status: 400 });

    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Room SD introuvable."), { status: 404 });

    const current = bundle.documents.find(document => document.code === code);
    if (code === "SD05" && current) {
      const currentContent = normalizeSD05NativeContent(current.content);
      if (currentContent.contractStatus === "signed") {
        throw Object.assign(new Error("Cette version SD05 est signée et figée. Créez une nouvelle version contractuelle pour la modifier."), { status: 409 });
      }
    }

    const publish = Boolean(body?.publish);
    if (publish) {
      const requiredCodes = REQUIRED_BEFORE_PUBLISH[code] || [];
      const missing = requiredCodes.filter(requiredCode => bundle.documents.find(document => document.code === requiredCode)?.status !== "validated");
      if (missing.length) {
        throw Object.assign(new Error(`${missing.join(" et ")} doivent être validés par le client avant de publier ${code}.`), { status: 409 });
      }
    }

    const content = (code === "SD05" ? normalizeSD05NativeContent(body?.content) : normalizeStageContent(code, body?.content)) as Record<string, unknown>;
    const sourceMode = current?.source_mode === "agent" ? "mixed" : current?.source_mode || "manual";
    const document = await saveSDDocument({
      roomId: bundle.room.id,
      code,
      content,
      sourceMode,
      updatedByEmail: userEmail,
      status: publish ? "published" : "draft",
      changeSummary: publish ? `${code} relu et publié` : `Mise à jour manuelle ${code}`,
    });
    return Response.json({ document });
  } catch (error) {
    return apiError(error);
  }
}
