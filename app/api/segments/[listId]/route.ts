import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> },
) {
  try {
    const { listId } = await params;
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    if (!listId.trim()) return NextResponse.json({ error: "Segment introuvable" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "Nom obligatoire" }, { status: 400 });

    const data = await hubspotJson(
      `/crm/lists/2026-03/${encodeURIComponent(listId)}/update-list-name?listName=${encodeURIComponent(name)}`,
      { method: "PUT" },
    );
    return NextResponse.json(data.updatedList || data);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ listId: string }> },
) {
  try {
    const { listId } = await params;
    if (!listId.trim()) return NextResponse.json({ error: "Segment introuvable" }, { status: 400 });

    await hubspotJson(`/crm/lists/2026-03/${encodeURIComponent(listId)}`, { method: "DELETE" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
