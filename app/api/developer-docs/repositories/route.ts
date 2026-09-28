import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAdmin } from "@/lib/cockpit-access";
import {
  DeveloperDocsGithubError,
  getDeveloperDocsConnection,
  listDeveloperDocsRepositories,
} from "@/lib/developer-docs-github";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown, fallback: string) {
  const status = error instanceof DeveloperDocsGithubError ? error.status : 500;
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    await requireCockpitAdmin();
    const connection = await getDeveloperDocsConnection();
    const query = request.nextUrl.searchParams.get("q") || "";
    const repositories = await listDeveloperDocsRepositories(connection, query);
    return NextResponse.json({ repositories });
  } catch (error) {
    console.error("Developer docs repositories listing failed", error);
    return errorResponse(error, "Impossible de charger les dépôts GitHub.");
  }
}
