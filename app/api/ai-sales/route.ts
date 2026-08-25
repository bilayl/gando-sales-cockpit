import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { askInkeepSales, buildSalesSnapshot } from "@/lib/inkeep-sales";

function scopeFrom(value: unknown) {
  return value === "recent" ? "recent" as const : "today" as const;
}

export async function GET(request: NextRequest) {
  try {
    await requireCockpitAccess();
    const scope = scopeFrom(new URL(request.url).searchParams.get("scope"));
    const snapshot = await buildSalesSnapshot("brief commercial", scope);
    return NextResponse.json({
      configured: Boolean(process.env.INKEEP_API_KEY?.trim()),
      snapshot,
    });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Impossible de préparer le contexte IA" }, { status: e.status || 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireCockpitAccess();
    const body = await request.json();
    const question = String(body.question || "").trim().slice(0, 1000);
    if (!question) return NextResponse.json({ error: "Posez une question à l’assistant." }, { status: 400 });

    const scope = scopeFrom(body.scope);
    const snapshot = await buildSalesSnapshot(question, scope);
    const result = await askInkeepSales(question, snapshot);

    return NextResponse.json({
      ...result,
      snapshot,
      askedBy: access.email || access.displayName || "Sales Cockpit",
    });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Erreur assistant Inkeep" }, { status: e.status || 500 });
  }
}
