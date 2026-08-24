import { NextResponse } from "next/server";
import { apiError } from "@/lib/hubspot";
import { hubspotJsonWithServiceFallback } from "@/lib/hubspot-service-fallback";

export async function GET() {
  try { return NextResponse.json(await hubspotJsonWithServiceFallback("/crm/owners/2026-03?limit=100")); }
  catch (error) { return apiError(error); }
}
