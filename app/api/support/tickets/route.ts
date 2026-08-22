import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { createSupportTicket, listSupportTickets, type SupportTicketStatus, type SupportTicketType } from "@/lib/support-tickets";

export const dynamic = "force-dynamic";

function responseError(error: unknown) {
  const e = error as Error & { status?: number };
  return NextResponse.json({ error: e.message || "Erreur support" }, { status: e.status || 500 });
}

export async function GET(request: NextRequest) {
  try {
    await requireCockpitAccess();
    const url = new URL(request.url);
    const typeParam = url.searchParams.get("type");
    const statusParam = url.searchParams.get("status");
    const type: SupportTicketType | undefined = typeParam === "commercial" ? "commercial" : typeParam === "support" ? "support" : undefined;
    const status: SupportTicketStatus | undefined = statusParam === "open" || statusParam === "waiting_customer" || statusParam === "resolved" ? statusParam : undefined;
    const tickets = await listSupportTickets({ type, status, q: url.searchParams.get("q") || undefined, limit: Number(url.searchParams.get("limit")) || 100 });
    return NextResponse.json({ tickets });
  } catch (error) {
    return responseError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireCockpitAccess();
    const body = await request.json();
    const ticket = await createSupportTicket({
      type: body?.type,
      source: "manual",
      firstName: body?.firstName,
      lastName: body?.lastName,
      email: body?.email,
      phone: body?.phone,
      companyName: body?.companyName,
      companyDomain: body?.companyDomain,
      subject: body?.subject,
      message: body?.message,
      metadata: { origin: "sales_cockpit" },
    }, access.email);
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    return responseError(error);
  }
}
