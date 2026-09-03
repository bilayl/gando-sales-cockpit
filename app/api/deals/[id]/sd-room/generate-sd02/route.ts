import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getSDRoomBundle, saveSDDocument } from "@/lib/sd-room";
import { requireSDInternalAccess } from "@/lib/sd-room-access";
import type { SD01Content } from "@/lib/sd-room-types";
import { createEmptySD02, normalizeStageContent, type SD02Content } from "@/lib/sd-stage-content";
import { generateSD02NextSteps } from "@/lib/sd02-next-steps";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const userEmail = await requireSDInternalAccess();
    let body: Record<string, unknown> = {};
    try { body = await request.json(); } catch { body = {}; }
    const force = body.force === true;

    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Room SD introuvable."), { status: 404 });
    if (bundle.room.room_mode === "standard") throw Object.assign(new Error("La génération SD02 est réservée aux Deals entreprise."), { status: 400 });

    const sd01 = bundle.documents.find(document => document.code === "SD01");
    if (!sd01) throw Object.assign(new Error("Complète d’abord le SD01 pour générer les prochaines étapes."), { status: 422 });

    const current = bundle.documents.find(document => document.code === "SD02");
    if (force && current?.status === "validated") {
      throw Object.assign(new Error("SD02 est déjà validé par le client. Il ne peut pas être régénéré automatiquement."), { status: 409 });
    }

    const currentContent = current
      ? normalizeStageContent("SD02", current.content) as SD02Content
      : createEmptySD02();

    if (!force && currentContent.milestones.length) {
      return Response.json({ document: current, generated: false, reason: "existing_content" });
    }

    const source = sd01.content as SD01Content;
    const milestones = generateSD02NextSteps(source, 6);
    if (!milestones.length) {
      throw Object.assign(new Error("Le SD01 ne contient pas encore assez d’éléments pour proposer des prochaines étapes."), { status: 422 });
    }

    const content: SD02Content = {
      ...createEmptySD02(),
      milestones,
    };

    const document = await saveSDDocument({
      roomId: bundle.room.id,
      code: "SD02",
      content,
      sourceMode: current?.source_mode === "manual" ? "mixed" : "agent",
      updatedByEmail: userEmail,
      status: "draft",
      sourceRefs: [{ id: sd01.id, title: "SD01 · Synthèse", sourceType: "sd01" }],
      changeSummary: force ? "Prochaines étapes régénérées automatiquement depuis SD01" : "Prochaines étapes générées automatiquement depuis SD01",
    });

    return Response.json({ document, generated: true, count: milestones.length });
  } catch (error) {
    return apiError(error);
  }
}
