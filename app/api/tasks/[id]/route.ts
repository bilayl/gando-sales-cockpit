import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/hubspot";
import { updateTaskStatus } from "@/lib/hubspot/tasks";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    return NextResponse.json(await updateTaskStatus(id, String(body.status || "")));
  } catch (error) {
    return apiError(error);
  }
}
