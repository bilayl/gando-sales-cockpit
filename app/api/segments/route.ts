import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";

export async function GET() {
  try {
    const data = await hubspotJson("/crm/lists/2026-03/search", { method: "POST", body: JSON.stringify({ count: 500, offset: 0 }) });
    return NextResponse.json({ lists: data.lists ?? [] });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const objectTypeId = body.objectTypeId === "0-2" ? "0-2" : "0-1";
    if (!name) return NextResponse.json({ error: "Nom obligatoire" }, { status: 400 });
    const data = await hubspotJson("/crm/lists/2026-03", {
      method: "POST",
      body: JSON.stringify({ name, objectTypeId, processingType: "MANUAL" }),
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error) { return apiError(error); }
}
