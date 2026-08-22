import { NextResponse } from "next/server";
import { hubspotJson } from "@/lib/hubspot";
import { HUBSPOT_INDUSTRY_FALLBACK_OPTIONS } from "@/lib/hubspot-industry";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const property = await hubspotJson("/crm/v3/properties/companies/industry");
    const options = (property.options || [])
      .filter((option: any) => !option.hidden && option.value)
      .map((option: any) => ({
        value: String(option.value),
        label: String(option.label || option.value),
        displayOrder: Number.isFinite(Number(option.displayOrder)) ? Number(option.displayOrder) : 9999,
      }))
      .sort((a: any, b: any) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label, "fr"));

    return NextResponse.json({ options, source: "hubspot" });
  } catch (error) {
    console.warn("Unable to load HubSpot industry property options; using HubSpot default fallback", error);
    return NextResponse.json({ options: HUBSPOT_INDUSTRY_FALLBACK_OPTIONS, source: "fallback" });
  }
}
