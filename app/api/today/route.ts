import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getTodayCockpit } from "@/lib/hubspot/contacts";

export async function GET(request: NextRequest) {
  try {
    const owner = request.nextUrl.searchParams.get("owner")?.trim() || undefined;
    return NextResponse.json(await getTodayCockpit(owner));
  } catch (error) {
    return apiError(error);
  }
}
