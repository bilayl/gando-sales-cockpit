import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getDealRoomList } from "@/lib/hubspot/deals";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const owner = request.nextUrl.searchParams.get("owner") || undefined;
    const data = await getDealRoomList({ owner });
    return Response.json(data);
  } catch (error) {
    return apiError(error);
  }
}