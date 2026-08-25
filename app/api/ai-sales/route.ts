import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { askOpenRouterSales, buildSalesSnapshot } from "@/lib/openrouter-sales";

function scopeFrom(value: unknown) {
  return value === "recent" ? "recent" as const : "today" as const;
}

export async function GET(request: NextRequest) {
  try {
    await requireCockpitAccess();
    const scope = scopeFrom(new URL(request.url).searchParams.get("scope"));
    const snapshot = await buildSalesSnapshot("brief commercial", scope);
    return NextResponse.json({
      configured: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
      model: process.env.OPENROUTER_MODEL?.trim() || "~openai/gpt-latest",
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
    const result = await askOpenRouterSales(question, snapshot);

    return NextResponse.json({
      ...result,
      snapshot,
      askedBy: access.email || access.displayName || "Sales Cockpit",
    });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Erreur assistant OpenRouter" }, { status: e.status || 500 });
  }
}
