import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getAuthorizedAlloRecordingLink } from "@/lib/withallo-recordings";
import { WithAlloError } from "@/lib/withallo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireCockpitAccess();
    const { id } = await params;
    const url = await getAuthorizedAlloRecordingLink(id, access);
    if (request.nextUrl.searchParams.get("check") === "1") {
      return NextResponse.json({ available: true }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const range = request.headers.get("range");
    if (range && !/^bytes=\d*-\d*$/.test(range)) {
      return NextResponse.json({ error: "Plage audio non valide." }, { status: 416 });
    }
    const audio = await fetch(url.toString(), {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      headers: range ? { Range: range } : {},
      signal: AbortSignal.timeout(25000),
    });
    if (![200, 206].includes(audio.status) || !audio.body) {
      return NextResponse.json({ error: "Le fichier audio est indisponible dans Allo." }, { status: 502 });
    }
    const rawType = audio.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "";
    // Prevent HTML from an unexpected storage response being served as audio.
    const allowedTypes = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/aac", "application/octet-stream"];
    if (rawType && !allowedTypes.includes(rawType)) {
      return NextResponse.json({ error: "Format d'enregistrement inattendu." }, { status: 502 });
    }
    const isDownload = request.nextUrl.searchParams.get("download") === "1";
    const headers = new Headers({
      "Content-Type": rawType === "application/octet-stream" ? "audio/mpeg" : rawType || "audio/mpeg",
      "Content-Disposition": (isDownload ? "attachment" : "inline") + '; filename="appel-allo.mp3"',
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    });
    for (const key of ["Content-Range", "Content-Length", "Accept-Ranges"]) {
      const value = audio.headers.get(key);
      if (value) headers.set(key, value);
    }
    return new Response(audio.body, { status: audio.status, headers });
  } catch (error) {
    const code = Number((error as { status?: number }).status || 502);
    const status = [400, 401, 403, 404, 429, 503].includes(code) ? code : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de récupérer l'enregistrement Allo." },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
