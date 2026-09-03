import { NextRequest } from "next/server";
import { getPublicSDRoomWithIdentity } from "@/lib/sd-room-public-identity";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createEmptySD02 } from "@/lib/sd-stage-content";
import type { SDDocumentRecord, SDRoomBrandTheme } from "@/lib/sd-room-types";

export const dynamic = "force-dynamic";

function publicError(error: unknown) {
  const value = error as Error & { status?: number };
  return Response.json({ error: value.message || "Impossible d’ouvrir la room." }, { status: value.status || 500 });
}

function brandTheme(value: unknown): SDRoomBrandTheme {
  return value === "gradient" || value === "dark" || value === "light" ? value : "gando";
}

function keepOnlySD02NextSteps(document: SDDocumentRecord): SDDocumentRecord {
  if (document.code !== "SD02") return document;
  const content = document.content && typeof document.content === "object" ? document.content as Record<string, unknown> : {};
  return {
    ...document,
    content: {
      ...createEmptySD02(),
      milestones: Array.isArray(content.milestones) ? content.milestones : [],
    },
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const admin = getSupabaseAdmin();
    const { data: room, error: roomError } = await admin
      .from("deal_rooms")
      .select("*")
      .eq("share_token", token)
      .eq("status", "published")
      .eq("room_mode", "standard")
      .maybeSingle();
    if (roomError) throw roomError;
    if (!room) throw Object.assign(new Error("Cette proposition n’est pas disponible."), { status: 404 });

    const { data: documents, error: documentsError } = await admin
      .from("sd_documents")
      .select("*")
      .eq("room_id", room.id)
      .not("published_at", "is", null)
      .order("code");
    if (documentsError) throw documentsError;

    return Response.json({
      room: {
        id: room.id,
        companyName: room.company_name,
        companyLogoUrl: room.prospect_logo_url,
        bannerImageUrl: room.brand_banner_image_url,
        theme: brandTheme(room.brand_theme),
        displayTitle: room.brand_title || room.title,
        displaySubtitle: room.brand_subtitle || "Proposition commerciale",
      },
      documents: (documents || []).map(document => keepOnlySD02NextSteps({
        ...document,
        content: document.published_content || document.content,
      } as SDDocumentRecord)),
      visitorEmail: "",
      visitorFirstName: "",
      visitorLastName: "",
    });
  } catch (error) {
    return publicError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const body = await request.json();
    const data = await getPublicSDRoomWithIdentity({
      token,
      email: body?.email,
      firstName: body?.firstName,
      lastName: body?.lastName,
    });
    return Response.json({
      ...data,
      room: {
        ...data.room,
        displayTitle: data.room.displayTitle || data.room.companyName,
        displaySubtitle: data.room.displaySubtitle || "Espace de collaboration",
      },
      documents: data.documents.map(document => keepOnlySD02NextSteps(document)),
    });
  } catch (error) {
    return publicError(error);
  }
}
