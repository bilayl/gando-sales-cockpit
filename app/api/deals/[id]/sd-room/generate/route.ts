import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getDealRoomDetail } from "@/lib/hubspot/deals";
import { generateSD01 } from "@/lib/sd01-generator";
import {
  getSDRoomBundle,
  loadAuthorizedOnoffCalls,
  requireSDInternalAccess,
  saveSDDocument,
  snapshotConversation,
} from "@/lib/sd-room";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const userEmail = await requireSDInternalAccess();
    const [bundle, body] = await Promise.all([getSDRoomBundle(id), request.json()]);
    if (!bundle.room) throw Object.assign(new Error("Créez d’abord la room SD."), { status: 404 });

    const standalone = id.startsWith("standalone:");
    const callIds = Array.isArray(body?.callIds) ? body.callIds.map(String).filter(Boolean).slice(0, 50) : [];
    const manualTranscript = String(body?.manualTranscript || "").trim().slice(0, 300_000);
    const manualTitle = String(body?.manualTitle || "Conversation ajoutée manuellement").trim().slice(0, 240);

    let companyName = bundle.room.company_name || "Client";
    let dealName = bundle.room.title;
    let calls: Awaited<ReturnType<typeof loadAuthorizedOnoffCalls>> = [];

    if (standalone) {
      if (callIds.length) {
        throw Object.assign(new Error("Cette dealroom n’est pas reliée au CRM. Collez une conversation ou associez d’abord un deal HubSpot."), { status: 400 });
      }
    } else {
      const deal = await getDealRoomDetail(id);
      companyName = deal.company?.name || companyName;
      dealName = deal.name;
      calls = await loadAuthorizedOnoffCalls({ callIds, dealId: id, companyId: deal.company?.id || null });
      if (calls.length !== callIds.length) {
        throw Object.assign(new Error("Une conversation sélectionnée n’est pas reliée à ce deal ou à cette entreprise."), { status: 403 });
      }
    }

    const savedSources = await Promise.all(calls.map(call => snapshotConversation({
      roomId: bundle.room!.id,
      sourceType: "onoff",
      externalId: call.call_id,
      title: `${call.direction === "inbound" ? "Appel entrant" : "Appel sortant"} · ${call.started_at ? new Date(call.started_at).toLocaleDateString("fr-FR") : "date inconnue"}`,
      transcriptText: String(call.transcript_text || ""),
      transcriptData: call.transcript,
      occurredAt: call.started_at,
      createdByEmail: userEmail,
    })));

    if (manualTranscript) {
      savedSources.push(await snapshotConversation({
        roomId: bundle.room.id,
        sourceType: "manual",
        externalId: randomUUID(),
        title: manualTitle || "Conversation ajoutée manuellement",
        transcriptText: manualTranscript,
        createdByEmail: userEmail,
      }));
    }
    if (!savedSources.length) throw Object.assign(new Error("Collez une conversation ou sélectionnez un appel relié au CRM."), { status: 400 });

    const generated = await generateSD01({
      companyName,
      dealName,
      sources: savedSources.map(source => ({ id: source.id, title: source.title, transcript: source.transcript_text })),
    });
    const document = await saveSDDocument({
      roomId: bundle.room.id,
      code: "SD01",
      content: generated.content,
      sourceMode: bundle.documents.find(document => document.code === "SD01")?.source_mode === "mixed" ? "mixed" : "agent",
      updatedByEmail: userEmail,
      status: "review",
      modelName: generated.model,
      promptVersion: generated.promptVersion,
      sourceRefs: savedSources.map(source => ({ id: source.id, title: source.title, sourceType: source.source_type })),
      changeSummary: `Brouillon généré depuis ${savedSources.length} conversation(s)`,
    });
    return Response.json({ document, sourceCount: savedSources.length });
  } catch (error) {
    return apiError(error);
  }
}
