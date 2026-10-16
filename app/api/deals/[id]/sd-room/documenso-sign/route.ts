import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getSDRoomBundle } from "@/lib/sd-room";
import { requireSDInternalAccess } from "@/lib/sd-room-access";

export const dynamic = "force-dynamic";

// Deals rapides: la signature est désormais suivie manuellement dans le contrat.
// No Documenso configuration or signing link is exposed by this legacy endpoint.
export async function GET() {
  try {
    await requireSDInternalAccess();
    return Response.json({ configured: false, signatureEnabled: false, manualContractStatus: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireSDInternalAccess();
    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) return Response.json({ error: "Deal Room introuvable." }, { status: 404 });
    return Response.json({
      error: bundle.room.room_mode === "standard"
        ? "La signature électronique est désactivée pour les Deals rapides. Déposez le document et modifiez son statut manuellement."
        : "Ce point d’accès de signature n’est pas disponible pour ce type de deal.",
    }, { status: 410 });
  } catch (error) {
    return apiError(error);
  }
}
