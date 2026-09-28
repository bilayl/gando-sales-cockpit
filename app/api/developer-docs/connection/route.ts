import { NextRequest, NextResponse } from "next/server";
import { getCockpitAccess, requireCockpitAdmin } from "@/lib/cockpit-access";
import {
  DeveloperDocsGithubError,
  clearDeveloperDocsConnection,
  getDeveloperDocsConnection,
  normalizeDeveloperDocsConnection,
  publicDeveloperDocsConnection,
  listDeveloperDocsRepositories,
  saveDeveloperDocsConnection,
  testDeveloperDocsConnection,
} from "@/lib/developer-docs-github";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown, fallback: string) {
  const status = error instanceof DeveloperDocsGithubError ? error.status : 500;
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const connection = await getDeveloperDocsConnection();
    const publicConnection = publicDeveloperDocsConnection(connection);

    if (!connection.token) {
      return NextResponse.json({
        connection: {
          ...publicConnection,
          connected: false,
          writable: false,
          repoUrl: `https://github.com/${connection.owner}/${connection.repo}`,
          reason: "Connectez GitHub pour choisir le repository de documentation.",
        },
        canConfigure: access.role === "admin",
      });
    }

    try {
      const status = await testDeveloperDocsConnection(connection);
      return NextResponse.json({
        connection: { ...publicConnection, ...status, reason: null },
        canConfigure: access.role === "admin",
      });
    } catch (error) {
      return NextResponse.json({
        connection: {
          ...publicConnection,
          connected: false,
          writable: false,
          repoUrl: `https://github.com/${connection.owner}/${connection.repo}`,
          reason: error instanceof Error ? error.message : "Connexion GitHub impossible.",
        },
        canConfigure: access.role === "admin",
      });
    }
  } catch (error) {
    console.error("Developer docs connection read failed", error);
    return errorResponse(error, "Impossible de charger la connexion GitHub.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireCockpitAdmin();
    const body = await request.json().catch(() => ({}));
    const normalized = normalizeDeveloperDocsConnection({
      owner: body?.owner,
      repo: body?.repo,
      branch: body?.branch,
      basePath: body?.basePath,
    });

    const current = await getDeveloperDocsConnection();
    const suppliedToken = typeof body?.token === "string" ? body.token.trim() : "";

    const candidate = {
      ...normalized,
      token: process.env.GITHUB_DOCS_TOKEN?.trim() || suppliedToken || current.token,
      tokenSource: process.env.GITHUB_DOCS_TOKEN?.trim()
        ? "server" as const
        : suppliedToken || current.token
          ? "browser" as const
          : "none" as const,
    };

    if (!candidate.token) {
      return NextResponse.json(
        { error: "Connectez GitHub ou ajoutez un token avec accès aux repositories à utiliser." },
        { status: 400 },
      );
    }

    if (body?.authenticateOnly === true) {
      await listDeveloperDocsRepositories(candidate);
      const saved = await saveDeveloperDocsConnection({
        ...normalized,
        token: suppliedToken || undefined,
      });
      return NextResponse.json({
        connection: {
          ...publicDeveloperDocsConnection(saved),
          connected: false,
          writable: false,
          repoUrl: `https://github.com/${saved.owner}/${saved.repo}`,
          reason: "GitHub connecté. Choisissez maintenant le repository de documentation.",
        },
      });
    }

    const status = await testDeveloperDocsConnection(candidate);
    const saved = await saveDeveloperDocsConnection({
      ...normalized,
      token: suppliedToken || undefined,
    });

    return NextResponse.json({
      connection: {
        ...publicDeveloperDocsConnection(saved),
        ...status,
        reason: null,
      },
    });
  } catch (error) {
    console.error("Developer docs connection save failed", error);
    return errorResponse(error, "Impossible de connecter GitHub.");
  }
}

export async function DELETE() {
  try {
    await requireCockpitAdmin();
    await clearDeveloperDocsConnection();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Developer docs connection clear failed", error);
    return errorResponse(error, "Impossible de réinitialiser la connexion GitHub.");
  }
}
