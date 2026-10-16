import { NextRequest } from "next/server";
import { getPublicSDRoom } from "@/lib/sd-room";
import { mayAcceptQuickProposal } from "@/lib/quick-deal-approval";
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
      .select("room_mode").eq("id", publicRoom.room.id).single();
    if (roomLookupError) throw roomLookupError;
    if (code === "SD04" && roomDetails.room_mode === "standard") {
      const { data: sourceProposal, error: sourceError } = await admin.from("sd_documents")
        .select("published_content").eq("room_id", publicRoom.room.id).eq("code", "SD04").single();
      if (sourceError) throw sourceError;
      if (!mayAcceptQuickProposal(sourceProposal.published_content)) {
        return Response.json({ error: "La proposition attend encore la validation interne de Gando." }, { status: 409 });
      }
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

    if (code === "SD04") {
      const { error: roomError } = await admin
        .from("deal_rooms")
        .update({ proposal_agreed_at: now })
        .eq("id", publicRoom.room.id);
      if (roomError) throw roomError;
      // Contract remains "Pas rédigé" until a Gando team member deposits
      // a document and explicitly sets its status. No template or signing
      // workflow is created as a side effect of commercial acceptance.
    }

    const published = (data.published_content || data.content || {}) as Record<string, unknown>;
    const { gandoEconomics: _internalEconomics, internalApproval: _internalApproval, ...publicContent } = published;
    void _internalEconomics; void _internalApproval;
    return Response.json({
      document: { ...data, content: code === "SD04" ? publicContent : published, published_content: null },
    });
  } catch (error) {
    const value = error as Error & { status?: number };
    return Response.json({ error: value.message || "Validation impossible." }, { status: value.status || 500 });
  }
}