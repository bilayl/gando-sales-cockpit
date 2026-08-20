import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getSDRoomBundle, requireSDInternalAccess, saveSDDocument } from "@/lib/sd-room";
import { normalizeStageContent } from "@/lib/sd-stage-content";
import { SD_CODES, type SDCode } from "@/lib/sd-room-types";

export const dynamic = "force-dynamic";

const PREVIOUS_STAGE: Partial<Record<SDCode, SDCode>> = {
  SD02: "SD01",
  SD03: "SD02",
  SD04: "SD03",
  SD05: "SD04",
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

    const publish = Boolean(body?.publish);
    if (publish) {
      const previousCode = PREVIOUS_STAGE[code];
      const previous = bundle.documents.find(document => document.code === previousCode);
      if (previousCode && previous?.status !== "validated") {
        throw Object.assign(new Error(`${previousCode} doit être validé par le client avant de publier ${code}.`), { status: 409 });
      }
    }

    const content = normalizeStageContent(code, body?.content) as Record<string, unknown>;
    const current = bundle.documents.find(document => document.code === code);
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
