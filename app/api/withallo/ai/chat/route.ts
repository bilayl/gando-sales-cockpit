import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getOpenRouterSalesStatus } from "@/lib/openrouter-key";
import { askAlloChat, type AlloChatMessage, type AlloChatScope } from "@/lib/withallo-ai-chat";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function failure(error: unknown) {
  const code = Number((error as { status?: number })?.status || 502);
  return NextResponse.json({
    error: error instanceof Error ? error.message : "Le chat IA Allo est indisponible.",
  }, {
    status: [400, 401, 403, 404, 408, 429, 503].includes(code) ? code : 502,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET() {
  try {
    await requireCockpitAccess();
    const status = await getOpenRouterSalesStatus();
    return NextResponse.json({
      configured: status.configured, model: status.model,
      provider: "OpenRouter", source: "Analyses et transcriptions Allo",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    await requireCockpitAccess();
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 30000) {
      return NextResponse.json({ error: "La conversation est trop longue." }, { status: 413 });
    }
    const body = await request.json().catch(() => ({}));
    const input = Array.isArray(body?.messages) ? body.messages : [];
    const messages: AlloChatMessage[] = input.slice(-12).map((entry: unknown) => {
      const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
      return {
        role: item.role === "assistant" ? "assistant" as const : "user" as const,
        content: typeof item.content === "string" ? item.content.trim().slice(0, 1600) : "",
      };
    }).filter(message => message.content);
    if (!messages.length || messages[messages.length - 1].role !== "user" ||
        messages[messages.length - 1].content.length < 2) {
      return NextResponse.json({ error: "Écris une question pour démarrer le chat." }, { status: 400 });
    }
    const provided = body.scope;
    let scope: AlloChatScope = null;
    if (provided !== null && provided !== undefined) {
      if ((provided.kind !== "contact" && provided.kind !== "company") ||
          !/^\d{1,25}$/.test(String(provided.id || ""))) {
        return NextResponse.json({ error: "Fiche CRM invalide." }, { status: 400 });
      }
      scope = { kind: provided.kind, id: String(provided.id) };
    }
    const answer = await askAlloChat({ messages, scope });
    return NextResponse.json(answer, { headers: {
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return failure(error); }
}
