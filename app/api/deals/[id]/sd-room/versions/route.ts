import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getSDRoomBundle, saveSDDocument } from "@/lib/sd-room";
import { requireSDInternalAccess } from "@/lib/sd-room-access";
import type { SD01Content } from "@/lib/sd-room-types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireSDInternalAccess();
    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Deal Room introuvable."), { status: 404 });
    const sd01 = bundle.documents.find(document => document.code === "SD01");
    if (!sd01) throw Object.assign(new Error("SD01 introuvable."), { status: 404 });

    const { data, error } = await getSupabaseAdmin()
      .from("sd_document_versions")
      .select("id,version,content,source_refs,model_name,prompt_version,created_by_email,change_summary,created_at")
      .eq("document_id", sd01.id)
      .order("version", { ascending: false })
      .limit(40);
    if (error) throw error;

    return Response.json({ versions: data || [] });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const userEmail = await requireSDInternalAccess();
    const body = await request.json();
    const targetVersion = Number(body?.version);
    if (!Number.isInteger(targetVersion) || targetVersion < 1) {
      throw Object.assign(new Error("Version SD01 invalide."), { status: 400 });
    }

    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Deal Room introuvable."), { status: 404 });
    const current = bundle.documents.find(document => document.code === "SD01");
    if (!current) throw Object.assign(new Error("SD01 introuvable."), { status: 404 });

    const { data: version, error } = await getSupabaseAdmin()
      .from("sd_document_versions")
      .select("version,content")
      .eq("document_id", current.id)
      .eq("version", targetVersion)
      .maybeSingle();
    if (error) throw error;
    if (!version) throw Object.assign(new Error("Cette version n’existe plus."), { status: 404 });

    const document = await saveSDDocument({
      roomId: bundle.room.id,
      code: "SD01",
      content: version.content as SD01Content,
      sourceMode: current.source_mode || "manual",
      updatedByEmail: userEmail,
      status: "draft",
      changeSummary: `Restauration de la version ${targetVersion}`,
    });

    return Response.json({ document });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireSDInternalAccess();
    const body = await request.json();
    const versionId = String(body?.id || "").trim();
    const targetVersion = Number(body?.version);
    if (!versionId || !Number.isInteger(targetVersion) || targetVersion < 1) {
      throw Object.assign(new Error("Version SD01 invalide."), { status: 400 });
    }

    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Deal Room introuvable."), { status: 404 });
    const current = bundle.documents.find(document => document.code === "SD01");
    if (!current) throw Object.assign(new Error("SD01 introuvable."), { status: 404 });

    if (targetVersion === current.version) {
      throw Object.assign(new Error("La version actuellement active ne peut pas être supprimée."), { status: 409 });
    }
    if (current.published_version && targetVersion === current.published_version) {
      throw Object.assign(new Error("La version actuellement publiée ne peut pas être supprimée."), { status: 409 });
    }

    const admin = getSupabaseAdmin();
    const { data: existing, error: lookupError } = await admin
      .from("sd_document_versions")
      .select("id,version")
      .eq("id", versionId)
      .eq("document_id", current.id)
      .eq("version", targetVersion)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) throw Object.assign(new Error("Cette version n’existe plus."), { status: 404 });

    const { error: deleteError } = await admin
      .from("sd_document_versions")
      .delete()
      .eq("id", versionId)
      .eq("document_id", current.id);
    if (deleteError) throw deleteError;

    return Response.json({ deleted: true, id: versionId, version: targetVersion });
  } catch (error) {
    return apiError(error);
  }
}
