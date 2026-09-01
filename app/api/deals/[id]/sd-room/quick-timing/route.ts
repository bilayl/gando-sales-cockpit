import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getSDRoomBundle } from "@/lib/sd-room";
import { requireSDInternalAccess } from "@/lib/sd-room-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type EditableTiming = "first_contact_at" | "proposal_sent_at";

function editableTiming(value: unknown): EditableTiming | null {
  return value === "first_contact_at" || value === "proposal_sent_at" ? value : null;
}

function timingValue(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw Object.assign(new Error("Date ou heure invalide."), { status: 400 });
  return date.toISOString();
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireSDInternalAccess();
    const body = await request.json().catch(() => ({}));
    const field = editableTiming(body?.field);
    if (!field) throw Object.assign(new Error("Seuls Premier contact et Propal envoyée sont modifiables."), { status: 400 });

    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Deal Room introuvable."), { status: 404 });
    if (bundle.room.room_mode !== "standard") throw Object.assign(new Error("Action réservée aux Deals rapides."), { status: 409 });

    const value = timingValue(body?.value);
    const { data: room, error } = await getSupabaseAdmin()
      .from("deal_rooms")
      .update({ [field]: value })
      .eq("id", bundle.room.id)
      .select("*")
      .single();
    if (error) throw error;

    return Response.json({ room });
  } catch (error) {
    return apiError(error);
  }
}
