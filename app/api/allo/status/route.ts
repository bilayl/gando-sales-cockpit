import { NextResponse } from "next/server";
import { getCockpitAccess } from "@/lib/cockpit-access";
import {
  getWithAlloCurrentQueue,
  getWithAlloMe,
  hasWithAlloDirectCallEndpoint,
  isWithAlloConfigured,
  resolveWithAlloTarget,
  safeWithAlloError,
} from "@/lib/withallo";

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
    const target = await resolveWithAlloTarget(access.email || null);
    let queue: Awaited<ReturnType<typeof getWithAlloCurrentQueue>> | null = null;
    let queueError: ReturnType<typeof safeWithAlloError> | null = null;
    if (scopes.includes("DIALING_QUEUE_READ_WRITE")) {
      try {
        queue = await getWithAlloCurrentQueue({ userId: target.userId, email: target.email });
      } catch (error) {
        queueError = safeWithAlloError(error);
      }
    }

    return NextResponse.json({
      configured: true,
      connected: true,
      team: me.data?.team || null,
      scopes,
      endpoints: me.data?.endpoints || [],
      powerDialerReady: scopes.includes("DIALING_QUEUE_READ_WRITE"),
      conversationsReady: scopes.includes("CONVERSATIONS_READ"),
      webhooksReady: scopes.includes("WEBHOOKS_READ_WRITE"),
      usersReady: scopes.includes("USERS_READ"),
      directCallReady: hasWithAlloDirectCallEndpoint(me),
      rateLimits: me.data?.rate_limits || null,
      cockpitEmail: access.email || null,
      target: {
        userId: target.userId,
        email: target.email,
        name: target.user?.name || null,
        source: target.source,
        availableUsers: target.users.map(user => ({ id: user.id, name: user.name, email: user.email, role: user.role, status: user.status })),
      },
      queue: queue ? {
        count: queue.pagination?.total_count ?? queue.data?.length ?? 0,
        assigneeId: queue.queue?.assignee_id || null,
        name: queue.queue?.name || null,
        items: (queue.data || []).slice(0, 20),
      } : null,
      queueError,
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
