import { NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";
export async function GET() {
  try { return NextResponse.json(await hubspotJson("/crm/owners/2026-03?limit=100")); }
  catch (error) { return apiError(error); }
}
