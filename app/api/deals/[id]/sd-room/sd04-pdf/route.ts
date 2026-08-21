import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getSDRoomBundle, requireSDInternalAccess } from "@/lib/sd-room";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "sd-room-files";
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "deal";
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireSDInternalAccess();
    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Room SD introuvable."), { status: 404 });

    const formData = await request.formData();
    const entry = formData.get("file");
    if (!(entry instanceof File)) throw Object.assign(new Error("Ajoutez un fichier PDF."), { status: 400 });

    const file = entry;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) throw Object.assign(new Error("Le SD04 accepte uniquement un fichier PDF."), { status: 400 });
    if (!file.size || file.size > MAX_FILE_SIZE) throw Object.assign(new Error("Le PDF doit faire moins de 20 Mo."), { status: 400 });

    const supabase = getSupabaseAdmin();
    const bucket = await supabase.storage.getBucket(BUCKET);
    if (!bucket.data) {
      const created = await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE,
        allowedMimeTypes: ["application/pdf"],
      });
      if (created.error && !/already exists/i.test(created.error.message)) throw created.error;
    }

    const path = `sd04/${safeSegment(id)}/${Date.now()}-${crypto.randomUUID()}.pdf`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploaded = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: "application/pdf",
      cacheControl: "3600",
      upsert: false,
    });
    if (uploaded.error) throw uploaded.error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(uploaded.data.path);
    return Response.json({ url: data.publicUrl, name: file.name });
  } catch (error) {
    return apiError(error);
  }
}
