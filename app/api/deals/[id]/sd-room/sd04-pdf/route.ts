import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getSDRoomBundle } from "@/lib/sd-room";
import { requireSDInternalAccess } from "@/lib/sd-room-access";
import { createEmptySD04 } from "@/lib/sd-stage-content";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const BUCKET = "sd-room-files";
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function safeSegment(value: string) { return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "deal"; }
function storagePath(url: string) { const marker = `/storage/v1/object/public/${BUCKET}/`; const index = url.indexOf(marker); return index < 0 ? null : decodeURIComponent(url.slice(index + marker.length).split(/[?#]/)[0] || ""); }

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireSDInternalAccess(); const bundle = await getSDRoomBundle(id); if (!bundle.room) throw Object.assign(new Error("Room SD introuvable."), { status: 404 });
    const formData = await request.formData(); const entry = formData.get("file"); if (!(entry instanceof File)) throw Object.assign(new Error("Ajoutez un fichier PDF."), { status: 400 });
    const file = entry; const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) throw Object.assign(new Error("Le SD04 accepte uniquement un fichier PDF."), { status: 400 });
    if (!file.size || file.size > MAX_FILE_SIZE) throw Object.assign(new Error("Le PDF doit faire moins de 20 Mo."), { status: 400 });
    const supabase = getSupabaseAdmin(); const bucket = await supabase.storage.getBucket(BUCKET);
    if (!bucket.data) { const created = await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_FILE_SIZE, allowedMimeTypes: ["application/pdf"] }); if (created.error && !/already exists/i.test(created.error.message)) throw created.error; }
    const path = `sd04/${safeSegment(id)}/${Date.now()}-${crypto.randomUUID()}.pdf`; const uploaded = await supabase.storage.from(BUCKET).upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: "application/pdf", cacheControl: "3600", upsert: false });
    if (uploaded.error) throw uploaded.error; const { data } = supabase.storage.from(BUCKET).getPublicUrl(uploaded.data.path); return Response.json({ url: data.publicUrl, name: file.name });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireSDInternalAccess(); const bundle = await getSDRoomBundle(id); if (!bundle.room) throw Object.assign(new Error("Room SD introuvable."), { status: 404 });
    const body = await request.json().catch(() => ({})); const url = String(body?.url || ""); const path = storagePath(url); const admin = getSupabaseAdmin();
    if (path) { const removed = await admin.storage.from(BUCKET).remove([path]); if (removed.error) throw removed.error; }
    const empty = createEmptySD04(); const { error } = await admin.from("sd_documents").update({ content: empty, published_content: null, status: "draft", published_at: null, published_version: null }).eq("room_id", bundle.room.id).eq("code", "SD04");
    if (error) throw error; return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
