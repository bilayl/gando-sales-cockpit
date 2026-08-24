import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";

type SupportedObjectTypeId = "0-1" | "0-2";
type HubSpotList = {
  listId: string;
  name?: string;
  objectTypeId?: string;
  processingType?: string;
  size?: number;
};

async function loadSegmentsByObjectType(objectTypeId: SupportedObjectTypeId): Promise<HubSpotList[]> {
  const data = await hubspotJson("/crm/lists/2026-03/search", {
    method: "POST",
    body: JSON.stringify({ count: 500, offset: 0, objectTypeId }),
  });
  return Array.isArray(data.lists) ? data.lists : [];
}

export async function GET() {
  try {
    // HubSpot supports filtering segment searches by object type. Fetch both explicitly
    // so contact segments cannot disappear when the account contains many company lists
    // (or when HubSpot changes the ordering of the unfiltered search response).
    const [companyLists, contactLists] = await Promise.all([
      loadSegmentsByObjectType("0-2"),
      loadSegmentsByObjectType("0-1"),
    ]);

    const lists = Array.from(
      new Map(
        [...companyLists, ...contactLists]
          .filter(list => list?.listId)
          .map(list => [String(list.listId), list]),
      ).values(),
    );

    return NextResponse.json({
      lists,
      counts: {
        companies: lists.filter(list => list.objectTypeId === "0-2").length,
        contacts: lists.filter(list => list.objectTypeId === "0-1").length,
      },
    });
  } catch (error) {
    return apiError(error);
  }
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
  } catch (error) {
    return apiError(error);
  }
}
