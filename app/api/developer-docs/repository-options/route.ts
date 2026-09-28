import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAdmin } from "@/lib/cockpit-access";
import {
  DeveloperDocsGithubError,
  getDeveloperDocsConnection,
  listDeveloperDocsRepositoryOptions,
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
    const owner = request.nextUrl.searchParams.get("owner") || "";
    const repo = request.nextUrl.searchParams.get("repo") || "";
    const branch = request.nextUrl.searchParams.get("branch") || undefined;
    const options = await listDeveloperDocsRepositoryOptions(connection, { owner, repo, branch });
    return NextResponse.json(options);
  } catch (error) {
    console.error("Developer docs repository options failed", error);
    return errorResponse(error, "Impossible de charger le dépôt GitHub.");
  }
}
