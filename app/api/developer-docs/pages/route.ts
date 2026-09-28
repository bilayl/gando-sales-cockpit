import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess, requireCockpitAdmin } from "@/lib/cockpit-access";
import {
  DeveloperDocsGithubError,
  deleteDeveloperDocPage,
  getDeveloperDocsConnection,
  listDeveloperDocPages,
  saveDeveloperDocPage,
} from "@/lib/developer-docs-github";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown, fallback: string) {
  const status = error instanceof DeveloperDocsGithubError ? error.status : 500;
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    await requireCockpitAccess();
    const connection = await getDeveloperDocsConnection();

    if (!connection.token) {
      return NextResponse.json(
        { error: "Connexion GitHub à configurer.", pages: [] },
        { status: 409 },
      );
    }

    return NextResponse.json({
      pages: await listDeveloperDocPages(connection),
    });
  } catch (error) {
    console.error("Developer docs listing failed", error);
    return errorResponse(error, "Impossible de charger les pages développeur.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireCockpitAdmin();
    const connection = await getDeveloperDocsConnection();
    const body = await request.json().catch(() => ({}));

    const status = body?.status === "published" ? "published" : "draft";
    const page = await saveDeveloperDocPage(connection, {
      path: typeof body?.path === "string" && body.path ? body.path : undefined,
      sha: typeof body?.sha === "string" && body.sha ? body.sha : undefined,
      title: String(body?.title || ""),
      slug: String(body?.slug || ""),
      section: String(body?.section || ""),
      description: String(body?.description || ""),
      body: String(body?.body || ""),
      status,
      order: Number(body?.order) || 999,
    });

    return NextResponse.json({ page });
  } catch (error) {
    console.error("Developer docs save failed", error);
    return errorResponse(error, "Impossible d’enregistrer la page.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireCockpitAdmin();
    const connection = await getDeveloperDocsConnection();
    const body = await request.json().catch(() => ({}));
    const path = String(body?.path || "");
    const sha = String(body?.sha || "");

    if (!path || !sha) {
      return NextResponse.json({ error: "Page GitHub invalide." }, { status: 400 });
    }

    await deleteDeveloperDocPage(connection, {
      path,
      sha,
      title: typeof body?.title === "string" ? body.title : undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Developer docs delete failed", error);
    return errorResponse(error, "Impossible de supprimer la page.");
  }
}
