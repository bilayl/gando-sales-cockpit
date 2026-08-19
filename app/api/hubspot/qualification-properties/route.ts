import { NextRequest, NextResponse } from "next/server";
import { hubspotJson } from "@/lib/hubspot";
import { ensureCompanyQualificationProperties } from "@/lib/hubspot/qualification-schema";

const CONTACT_PROPERTIES = [
  "ce_quil_apprecie_chez_gando",
  "objections__retours",
  "statut_de_lappel",
  "zip",
  "campagne_dacquisition",
  "taille_de_flo",
  "hs_country_region_code",
  "suite",
  "solution_paiement_reservation",
  "statut_prospection",
];

const COMPANY_PROPERTIES = [
  "name",
  "ce_quil_apprecie_chez_gando",
  "objections__retours",
  "statut_de_lappel",
  "zip",
  "campagne_dacquisition",
  "taille_flotte",
  "hs_country_code",
  "suite",
  "solution_paiement_reservation",
  "statut_prospection",
];

export async function GET(request: NextRequest) {
  try {
    const kind = request.nextUrl.searchParams.get("kind") === "company" ? "company" : "contact";
    const objectType = kind === "company" ? "companies" : "contacts";
    const names = kind === "company" ? COMPANY_PROPERTIES : CONTACT_PROPERTIES;

    let schema = null;
    if (kind === "company") schema = await ensureCompanyQualificationProperties();

    const properties = await Promise.all(names.map(async name => {
      try {
        const property = await hubspotJson(`/crm/properties/2026-03/${objectType}/${encodeURIComponent(name)}`);
        return {
          name: property.name,
          label: property.label,
          type: property.type,
          fieldType: property.fieldType,
          options: (property.options ?? [])
            .filter((option: any) => !option.hidden)
            .sort((a: any, b: any) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))
            .map((option: any) => ({ value: String(option.value), label: String(option.label) })),
        };
      } catch (error) {
        const e = error as Error & { status?: number };
        return { name, missing: true, error: e.message || `Propriété ${name} indisponible` };
      }
    }));

    return NextResponse.json({ kind, properties, schema });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Impossible de charger les propriétés HubSpot", details: e }, { status: e.status || 500 });
  }
}
