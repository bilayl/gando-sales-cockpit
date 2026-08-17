import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";

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
