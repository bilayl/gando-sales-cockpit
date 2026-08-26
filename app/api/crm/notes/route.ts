import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { hubspotJsonWithServiceFallback } from "@/lib/hubspot-service-fallback";

type Kind = "contact" | "company";

function targetObject(kind: Kind) {
  return kind === "company" ? "companies" : "contacts";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br>");
}

export async function POST(request: NextRequest) {
  try {
    await requireCockpitAccess();
    const body = await request.json();
    const kind = body.kind as Kind;
    const recordId = String(body.recordId || "").trim();
    const noteBody = String(body.body || "").trim();

    if ((kind !== "contact" && kind !== "company") || !recordId) {
      return NextResponse.json({ error: "Fiche CRM invalide" }, { status: 400 });
    }
    if (!noteBody) return NextResponse.json({ error: "La note ne peut pas être vide" }, { status: 400 });
    if (noteBody.length > 20000) return NextResponse.json({ error: "La note est trop longue" }, { status: 400 });

    const target = targetObject(kind);
    const labelsPayload = await hubspotJsonWithServiceFallback(`/crm/associations/2026-03/notes/${target}/labels`);
    const labels = labelsPayload?.results || [];
    const association = labels.find((item: any) => item.category === "HUBSPOT_DEFINED" && item.label == null)
      || labels.find((item: any) => item.category === "HUBSPOT_DEFINED");

    if (!association?.typeId) {
      return NextResponse.json({ error: "Association HubSpot note/fichier introuvable" }, { status: 500 });
    }

    const created = await hubspotJsonWithServiceFallback(`/crm/objects/2026-03/notes`, {
      method: "POST",
      body: JSON.stringify({
        properties: {
          hs_timestamp: new Date().toISOString(),
          hs_note_body: escapeHtml(noteBody),
        },
        associations: [{
          to: { id: recordId },
          types: [{
            associationCategory: association.category,
            associationTypeId: Number(association.typeId),
          }],
        }],
      }),
    });

    return NextResponse.json({ note: created }, { status: 201 });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Impossible de créer la note dans HubSpot" }, { status: e.status || 500 });
  }
}
