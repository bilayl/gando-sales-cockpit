import { NextRequest, NextResponse } from "next/server";
import { serialize } from "next-mdx-remote/serialize";
import remarkGfm from "remark-gfm";
import { requireCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireCockpitAccess();
    const body = await request.json().catch(() => ({}));
    const source = typeof body?.source === "string" ? body.source : "";

    if (!source.trim()) {
      return NextResponse.json({ error: "Contenu MDX vide." }, { status: 400 });
    }
    if (source.length > 250_000) {
      return NextResponse.json({ error: "Contenu MDX trop volumineux." }, { status: 413 });
    }

    const serialized = await serialize(source, {
      parseFrontmatter: false,
      blockJS: true,
      blockDangerousJS: true,
      mdxOptions: {
        format: "mdx",
        remarkPlugins: [remarkGfm],
      },
    });

    return NextResponse.json({ source: serialized });
  } catch (error) {
    console.error("Developer MDX render failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de compiler le contenu MDX." },
      { status: 500 },
    );
  }
}
