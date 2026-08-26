import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { hubspotJsonWithServiceFallback } from "@/lib/hubspot-service-fallback";

type Kind = "contact" | "company";

type PropertyDefinition = {
  name: string;
  label?: string;
  description?: string;
  groupName?: string;
  type?: string;
  fieldType?: string;
  displayOrder?: number;
  hidden?: boolean;
  archived?: boolean;
  hubspotDefined?: boolean;
  options?: Array<{ label?: string; value?: string; hidden?: boolean; displayOrder?: number }>;
};

function objectType(kind: Kind) {
  return kind === "company" ? "companies" : "contacts";
}

async function readAllProperties(type: string, id: string, names: string[]) {
  const merged: Record<string, unknown> = {};
  for (let index = 0; index < names.length; index += 80) {
    const chunk = names.slice(index, index + 80);
    if (!chunk.length) continue;
    const payload = await hubspotJsonWithServiceFallback(`/crm/objects/2026-03/${type}/batch/read`, {
      method: "POST",
      body: JSON.stringify({ properties: chunk, inputs: [{ id }] }),
    });
    Object.assign(merged, payload?.results?.[0]?.properties || {});
  }
  return merged;
}

export async function GET(request: NextRequest) {
  try {
    await requireCockpitAccess();
    const kind = request.nextUrl.searchParams.get("kind") as Kind | null;
    const id = String(request.nextUrl.searchParams.get("id") || "").trim();
    if ((kind !== "contact" && kind !== "company") || !id) {
      return NextResponse.json({ error: "Fiche CRM invalide" }, { status: 400 });
    }

    const type = objectType(kind);
    const [definitionsPayload, groupsPayload] = await Promise.all([
      hubspotJsonWithServiceFallback(`/crm/properties/2026-03/${type}?dataSensitivity=non_sensitive`),
      hubspotJsonWithServiceFallback(`/crm/properties/2026-03/${type}/groups`),
    ]);

    const definitions = ((definitionsPayload?.results || []) as PropertyDefinition[])
      .filter(property => !property.archived)
      .sort((a, b) => Number(a.displayOrder ?? 999999) - Number(b.displayOrder ?? 999999));
    const properties = await readAllProperties(type, id, definitions.map(property => property.name));

    const groups = (groupsPayload?.results || []).map((group: any) => ({
      name: String(group.name || ""),
      label: String(group.label || group.name || "Autres"),
      displayOrder: Number(group.displayOrder ?? 999999),
    }));

    return NextResponse.json({ kind, id, properties, definitions, groups });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Impossible de charger toutes les propriétés HubSpot" }, { status: e.status || 500 });
  }
}
