import { NextRequest } from "next/server";
import { getPublicSDRoom, saveSDDocument } from "@/lib/sd-room";
import { mayAcceptQuickProposal } from "@/lib/quick-deal-approval";
import { createEmptySD05, normalizeStageContent, type SD04Content, type SD05Content } from "@/lib/sd-stage-content";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { SD_CODES, type SDCode } from "@/lib/sd-room-types";

export const dynamic = "force-dynamic";

function cleanName(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 120);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const body = await request.json();
    const code = SD_CODES.includes(body?.documentCode) ? body.documentCode as SDCode : null;
    if (!code) return Response.json({ error: "Étape invalide." }, { status: 400 });
    const firstName = cleanName(body?.firstName);
    const lastName = cleanName(body?.lastName);
    if (!firstName || !lastName) return Response.json({ error: "Prénom et nom sont obligatoires pour valider une étape." }, { status: 400 });

    const publicRoom = await getPublicSDRoom(token, body?.email);
    const document = publicRoom.documents.find(item => item.code === code);
    if (!document) return Response.json({ error: "Cette étape n’est pas publiée." }, { status: 404 });
    if (document.status === "validated") return Response.json({ document });
    if (document.status !== "published") return Response.json({ error: "Cette étape doit être publiée avant validation." }, { status: 409 });

    const admin = getSupabaseAdmin();
    const { data: roomDetails, error: roomLookupError } = await admin.from("deal_rooms")
      .select("room_mode,company_name").eq("id", publicRoom.room.id).single();
    if (roomLookupError) throw roomLookupError;
    let approvedOffer: SD04Content | null = null;
    if (code === "SD04" && roomDetails.room_mode === "standard") {
      const { data: sourceProposal, error: sourceError } = await admin.from("sd_documents")
        .select("published_content").eq("room_id", publicRoom.room.id).eq("code", "SD04").single();
      if (sourceError) throw sourceError;
      if (!mayAcceptQuickProposal(sourceProposal.published_content)) {
        return Response.json({ error: "La proposition attend encore la validation interne de Gando." }, { status: 409 });
      }
      approvedOffer = normalizeStageContent("SD04", sourceProposal.published_content) as SD04Content;
    }

    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("sd_documents")
      .update({
        status: "validated",
        validated_at: now,
        validated_by_email: publicRoom.visitorEmail,
        validated_by_first_name: firstName,
        validated_by_last_name: lastName,
      })
      .eq("room_id", publicRoom.room.id)
      .eq("code", code)
      .eq("status", "published")
      .select("*")
      .single();
    if (error) throw error;

    let contractPrepared = false;
    if (code === "SD04") {
      const { error: roomError } = await admin
        .from("deal_rooms")
        .update({ proposal_agreed_at: now })
        .eq("id", publicRoom.room.id);
      if (roomError) throw roomError;

      if (roomDetails.room_mode === "standard" && approvedOffer) {
        // The acceptance opens contract preparation; it does not falsely mark
        // a legal document signed or send anything to a third-party signer.
        const { data: contract, error: contractError } = await admin.from("sd_documents")
          .select("content,status").eq("room_id", publicRoom.room.id).eq("code", "SD05").single();
        if (contractError) throw contractError;
        const previous = (contract.content || {}) as Partial<SD05Content>;
        if (contract.status === "draft" && !previous.contractTitle && !previous.contractUrl) {
          const tariff = approvedOffer.gandoEconomics;
          const rate = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
          const prepared: SD05Content = {
            ...createEmptySD05(),
            contractTitle: `Projet de contrat Gando × ${roomDetails.company_name}`,
            contractStatus: "internal_review",
            rentalTemplate: {
              ...createEmptySD05().rentalTemplate,
              legalName: roomDetails.company_name,
              gandoRate: rate(tariff.gandoRatePercent),
              partnerRate: rate(tariff.partnerMarginPercent),
              totalRate: rate(tariff.gandoRatePercent + tariff.partnerMarginPercent),
            },
            legalItems: [
              { topic: "Frais de sécurisation Gando", status: "in_review", owner: "Gando", notes: rate(tariff.gandoRatePercent) + " % HT" },
              { topic: "Marge loueur", status: "in_review", owner: roomDetails.company_name, notes: rate(tariff.partnerMarginPercent) + " % HT" },
              { topic: "Frais d’encaissement", status: "in_review", owner: "Gando", notes: rate(tariff.collectionRatePercent) + " % + " + rate(tariff.collectionFixedFee) + " € HT" },
            ],
          };
          try {
            await saveSDDocument({
              roomId: publicRoom.room.id,
              code: "SD05",
              content: prepared,
              sourceMode: "manual",
              updatedByEmail: "system@gando.app",
              status: "draft",
              changeSummary: "Projet de contrat préparé après accord client SD04",
            });
            contractPrepared = true;
          } catch (preparationError) {
            console.error("Quick-deal contract prefill failed", preparationError);
          }
        }
      }
    }

    return Response.json({ document: data, contractPrepared });
  } catch (error) {
    const value = error as Error & { status?: number };
    return Response.json({ error: value.message || "Validation impossible." }, { status: value.status || 500 });
  }
}