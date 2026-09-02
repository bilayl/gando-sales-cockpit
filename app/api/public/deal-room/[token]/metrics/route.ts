import { NextRequest } from "next/server";
import { getPublicSDRoomWithIdentity } from "@/lib/sd-room-public-identity";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SD01Content, SD01Metric } from "@/lib/sd-room-types";

export const dynamic = "force-dynamic";

function cleanValue(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 240);
}

function cloneContent(value: unknown): SD01Content {
  return JSON.parse(JSON.stringify(value || {})) as SD01Content;
}

function updateMetric(content: SD01Content, index: number, lever: string, nextMetric: SD01Metric) {
  const metrics = Array.isArray(content?.roi?.valueLevers) ? content.roi.valueLevers : [];
  let target = metrics[index];
  let targetIndex = index;

  if (!target || String(target.lever || "").trim() !== lever) {
    targetIndex = metrics.findIndex(metric => String(metric.lever || "").trim() === lever && !String(metric.value || "").trim());
    target = targetIndex >= 0 ? metrics[targetIndex] : undefined;
  }

  if (!target) return content;
  metrics[targetIndex] = { ...target, ...nextMetric };
  return { ...content, roi: { ...content.roi, valueLevers: metrics } };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    const body = await request.json();
    const metricIndex = Number(body?.metricIndex);
    const value = cleanValue(body?.value);

    if (!Number.isInteger(metricIndex) || metricIndex < 0 || metricIndex > 100) {
      throw Object.assign(new Error("Métrique invalide."), { status: 400 });
    }
    if (!value) throw Object.assign(new Error("Renseignez une valeur avant de confirmer."), { status: 400 });

    const roomData = await getPublicSDRoomWithIdentity({
      token,
      email: body?.email,
      firstName: body?.firstName,
      lastName: body?.lastName,
    });

    const admin = getSupabaseAdmin();
    const { data: room, error: roomError } = await admin
      .from("deal_rooms")
      .select("id,room_mode")
      .eq("id", roomData.room.id)
      .single();
    if (roomError) throw roomError;
    if (room.room_mode !== "enterprise") {
      throw Object.assign(new Error("Cette action est réservée aux Deal Rooms entreprise."), { status: 403 });
    }

    const { data: document, error: documentError } = await admin
      .from("sd_documents")
      .select("*")
      .eq("room_id", room.id)
      .eq("code", "SD01")
      .single();
    if (documentError) throw documentError;
    if (!document.published_at || !document.published_content) {
      throw Object.assign(new Error("Le SD01 n’est pas encore publié."), { status: 409 });
    }
    if (document.status === "validated") {
      throw Object.assign(new Error("Le SD01 est déjà validé et ne peut plus être modifié."), { status: 409 });
    }

    const published = cloneContent(document.published_content);
    const publishedMetrics = Array.isArray(published?.roi?.valueLevers) ? published.roi.valueLevers : [];
    const metric = publishedMetrics[metricIndex];
    if (!metric || !String(metric.lever || "").trim()) {
      throw Object.assign(new Error("Cette métrique n’existe plus."), { status: 404 });
    }
    if (String(metric.value || "").trim()) {
      throw Object.assign(new Error("Cette métrique a déjà été confirmée."), { status: 409 });
    }

    const firstName = String(body?.firstName || "").trim().slice(0, 120);
    const lastName = String(body?.lastName || "").trim().slice(0, 120);
    const confirmedBy = [firstName, lastName].filter(Boolean).join(" ") || roomData.visitorEmail;
    const confirmedAt = new Date().toISOString();
    const lever = String(metric.lever || "").trim();
    const nextMetric: SD01Metric = {
      ...metric,
      value,
      confirmedBy,
      confirmedEmail: roomData.visitorEmail,
      confirmedAt,
    };

    const nextPublished = updateMetric(published, metricIndex, lever, nextMetric);
    const currentContent = cloneContent(document.content || document.published_content);
    const nextContent = updateMetric(currentContent, metricIndex, lever, nextMetric);
    const version = Number(document.version || 0) + 1;

    const { data: updated, error: updateError } = await admin
      .from("sd_documents")
      .update({
        content: nextContent,
        published_content: nextPublished,
        version,
        published_version: version,
        source_mode: "mixed",
        updated_by_email: roomData.visitorEmail,
      })
      .eq("id", document.id)
      .select("*")
      .single();
    if (updateError) throw updateError;

    const { error: versionError } = await admin.from("sd_document_versions").insert({
      document_id: document.id,
      version,
      content: nextContent,
      source_refs: [{ type: "public_metric_confirmation", metricIndex, lever, visitorEmail: roomData.visitorEmail }],
      model_name: document.model_name || null,
      prompt_version: document.prompt_version || null,
      created_by_email: roomData.visitorEmail,
      change_summary: `Métrique confirmée par ${confirmedBy} : ${lever} = ${value}`,
    });
    if (versionError) throw versionError;

    return Response.json({
      metric: nextMetric,
      document: {
        ...updated,
        content: updated.published_content || updated.content,
      },
    });
  } catch (error) {
    const value = error as Error & { status?: number };
    return Response.json({ error: value.message || "Impossible de confirmer cette métrique." }, { status: value.status || 500 });
  }
}
