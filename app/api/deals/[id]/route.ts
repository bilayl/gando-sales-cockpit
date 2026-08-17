import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getDealRoomDetail } from "@/lib/hubspot/deals";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const data = await getDealRoomDetail(id);
    return Response.json(data);
  } catch (error) {
    return apiError(error);
  }
}