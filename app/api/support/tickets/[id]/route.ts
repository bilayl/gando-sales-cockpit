import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getSupportTicket, updateSupportTicketStatus, type SupportTicketStatus } from "@/lib/support-tickets";

export const dynamic = "force-dynamic";

function responseError(error: unknown) {
  const e = error as Error & { status?: number };
  return NextResponse.json({ error: e.message || "Erreur support" }, { status: e.status || 500 });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireCockpitAccess();
    const { id } = await params;
    return NextResponse.json(await getSupportTicket(id));
  } catch (error) {
    return responseError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireCockpitAccess();
    const { id } = await params;
    const body = await request.json();
    const status = body?.status as SupportTicketStatus;
    if (status !== "open" && status !== "waiting_customer" && status !== "resolved") {
      return NextResponse.json({ error: "Statut de ticket invalide." }, { status: 400 });
    }
    const ticket = await updateSupportTicketStatus(id, status);
    return NextResponse.json({ ticket });
  } catch (error) {
    return responseError(error);
  }
}
