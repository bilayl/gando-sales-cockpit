import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";

const companyProperties = ["name","domain","phone","website","city","state","country","industry","description","hubspot_owner_id","num_associated_contacts","hs_last_sales_activity_timestamp","hs_object_source_label","createdate"];

const contactProperties = ["firstname","lastname","email","phone","mobilephone","company","jobtitle","hubspot_owner_id","statut_prospection","resultat_prospection","statut_de_lappel","hs_last_sales_activity_timestamp","createdate"];

function idsFrom(record: any, type: string) {
  return (record?.associations?.[type]?.results ?? []).map((r: any) => String(r.id)).slice(0, 50);
}

async function batch(type: string, ids: string[], properties: string[]) {
  if (!ids.length) return [];
  const data = await hubspotJson(`/crm/objects/2026-03/${type}/batch/read`, { method: "POST", body: JSON.stringify({ properties, inputs: ids.map(id => ({ id })) }) });
  return data.results ?? [];
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const query = new URLSearchParams({ properties: companyProperties.join(","), associations: "contacts,notes" });
    const company = await hubspotJson(`/crm/objects/2026-03/companies/${encodeURIComponent(id)}?${query}`);
    const [contacts, notes] = await Promise.all([
      batch("contacts", idsFrom(company, "contacts"), contactProperties),
      batch("notes", idsFrom(company, "notes"), ["hs_note_body","hs_timestamp","hs_createdate","hs_object_source_label"]),
    ]);
    return NextResponse.json({ company, contacts, notes });
  } catch (error) { return apiError(error); }
}
