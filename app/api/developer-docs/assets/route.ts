import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess, requireCockpitAdmin } from "@/lib/cockpit-access";
import {
  DeveloperDocsGithubError,
  getDeveloperDocsConnection,
  readDeveloperDocsAsset,
  uploadDeveloperDocsAsset,
} from "@/lib/developer-docs-github";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

function errorResponse(error: unknown, fallback: string) {
  const status = error instanceof DeveloperDocsGithubError ? error.status : 500;
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}

function contentType(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export async function GET(request: NextRequest) {
  try {
    await requireCockpitAccess();
    const connection = await getDeveloperDocsConnection();
    const path = String(request.nextUrl.searchParams.get("path") || "");
    const bytes = await readDeveloperDocsAsset(connection, path);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentType(path),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("Developer docs asset read failed", error);
    return errorResponse(error, "Impossible de charger l’image.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireCockpitAdmin();
    const connection = await getDeveloperDocsConnection();
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Sélectionnez une image." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Format d’image non pris en charge." }, { status: 415 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "L’image ne doit pas dépasser 8 Mo." }, { status: 413 });
    }

    const result = await uploadDeveloperDocsAsset(connection, {
      fileName: file.name,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Developer docs asset upload failed", error);
    return errorResponse(error, "Impossible d’envoyer l’image.");
  }
}
