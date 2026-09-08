import { NextResponse } from "next/server";
import { getCockpitAccess } from "@/lib/cockpit-access";
import { getWithAlloMe, isWithAlloConfigured, safeWithAlloError } from "@/lib/withallo";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getCockpitAccess();
  if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (!isWithAlloConfigured()) {
    return NextResponse.json({
      configured: false,
      connected: false,
      message: "WITHALLO_API_KEY n’est pas configurée sur cet environnement.",
    }, { headers: { "cache-control": "no-store" } });
  }

  try {
    const me = await getWithAlloMe();
    const scopes = me.data?.scopes || [];
    return NextResponse.json({
      configured: true,
      connected: true,
      team: me.data?.team || null,
      scopes,
      powerDialerReady: scopes.includes("DIALING_QUEUE_READ_WRITE"),
      conversationsReady: scopes.includes("CONVERSATIONS_READ"),
      webhooksReady: scopes.includes("WEBHOOKS_READ_WRITE"),
      rateLimits: me.data?.rate_limits || null,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const safe = safeWithAlloError(error);
    return NextResponse.json({
      configured: true,
      connected: false,
      error: safe,
    }, { status: safe.status >= 400 && safe.status < 600 ? safe.status : 502, headers: { "cache-control": "no-store" } });
  }
}
