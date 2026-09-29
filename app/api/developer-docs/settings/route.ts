import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess, requireCockpitAdmin } from "@/lib/cockpit-access";
import {
  DeveloperDocsGithubError,
  getDeveloperDocsConnection,
  getDeveloperSiteSettings,
  saveDeveloperSiteSettings,
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
      return NextResponse.json({ error: "Connexion GitHub à configurer." }, { status: 409 });
    }
    return NextResponse.json(await getDeveloperSiteSettings(connection));
  } catch (error) {
    console.error("Developer site settings read failed", error);
    return errorResponse(error, "Impossible de charger les paramètres du site.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireCockpitAdmin();
    const connection = await getDeveloperDocsConnection();
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await saveDeveloperSiteSettings(connection, body?.settings ?? body));
  } catch (error) {
    console.error("Developer site settings save failed", error);
    return errorResponse(error, "Impossible d’enregistrer les paramètres du site.");
  }
}
