import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getWithAlloCalls, matchesWithAlloPhone } from "@/lib/withallo";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const access = await requireCockpitAccess();
    const url = new URL(request.url);
    const size = Math.min(Math.max(Number(url.searchParams.get("limit")) || 80, 1), 100);
    const phone = url.searchParams.get("phone")?.trim() || "";
    if (phone && phone.replace(/\D/g, "").length < 9) {
      return NextResponse.json({ error: "Numéro incomplet." }, { status: 400 });
    }
    let items = await getWithAlloCalls(size);
    if (phone) items = items.filter(call => matchesWithAlloPhone(call.externalNumber, phone) || matchesWithAlloPhone(call.from, phone) || matchesWithAlloPhone(call.to, phone));
    // Commercial accounts may only see calls with a verified matching user e-mail.
    // Do not fall back to displaying shared recordings without an ownership field.
    if (access.role !== "admin") {
      const email = (access.email || "").trim().toLowerCase();
      items = email ? items.filter(call => call.ownerEmail?.toLowerCase() === email) : [];
    }
    // Never return Allo's raw/signed recording links to the browser. Use the authenticated proxy.
    const safeItems = items.map(({ recordingUrl: _recordingUrl, ...call }) => call);
    return NextResponse.json({ items: safeItems, total: safeItems.length }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const status = Number((error as { status?: number }).status || 500);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Historique Allo indisponible." }, { status });
  }
}
