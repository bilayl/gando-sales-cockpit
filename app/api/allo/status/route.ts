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

type ProbeResult = {
  label: string;
  method: string;
  url: string;
  auth: "raw" | "api-key" | "none";
  status: number | null;
  allow: string | null;
  contentType: string | null;
  body: string;
  error?: string;
};

function alloKey() {
  return process.env.WITHALLO_API_KEY?.trim() || process.env.ALLO_API_KEY?.trim() || "";
}

function alloBaseUrl() {
  return (process.env.WITHALLO_BASE_URL?.trim() || process.env.ALLO_BASE_URL?.trim() || "https://api.withallo.com").replace(/\/$/, "");
}

async function runProbe(input: {
  label: string;
  method: "GET" | "POST";
  url: string;
  auth: "raw" | "api-key" | "none";
  body?: string;
}): Promise<ProbeResult> {
  const key = alloKey();
  const headers: Record<string, string> = { Accept: "application/json, text/plain, */*" };
  if (input.auth === "raw" && key) headers.Authorization = key;
  if (input.auth === "api-key" && key) headers.Authorization = `Api-Key ${key}`;
  if (input.body !== undefined) headers["Content-Type"] = "application/json";

  try {
    const response = await fetch(input.url, {
      method: input.method,
      headers,
      body: input.body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    const text = await response.text().catch(() => "");
    return {
      label: input.label,
      method: input.method,
      url: input.url.replace(alloBaseUrl(), "https://api.withallo.com"),
      auth: input.auth,
      status: response.status,
      allow: response.headers.get("allow"),
      contentType: response.headers.get("content-type"),
      body: text.slice(0, 1200),
    };
  } catch (error) {
    return {
      label: input.label,
      method: input.method,
      url: input.url.replace(alloBaseUrl(), "https://api.withallo.com"),
      auth: input.auth,
      status: null,
      allow: null,
      contentType: null,
      body: "",
      error: error instanceof Error ? error.message : "Probe failed",
    };
  }
}

async function runNativeVoiceProbe() {
  const base = alloBaseUrl();
  const probes = await Promise.all([
    runProbe({ label: "v1 calls read / raw auth", method: "GET", url: `${base}/v1/api/calls?size=1`, auth: "raw" }),
    runProbe({ label: "v1 calls read / Api-Key auth", method: "GET", url: `${base}/v1/api/calls?size=1`, auth: "api-key" }),
    runProbe({ label: "v1 calls create candidate / raw auth", method: "POST", url: `${base}/v1/api/calls`, auth: "raw", body: "{}" }),
    runProbe({ label: "v1 calls create candidate / Api-Key auth", method: "POST", url: `${base}/v1/api/calls`, auth: "api-key", body: "{}" }),
    runProbe({ label: "marketing candidate POST /v1/calls", method: "POST", url: `${base}/v1/calls`, auth: "raw", body: "{}" }),
    runProbe({ label: "v2 direct call candidate", method: "POST", url: `${base}/v2/api/calls`, auth: "api-key", body: "{}" }),
  ]);

  let embed: Record<string, unknown>;
  try {
    const response = await fetch("https://web.withallo.com", {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    embed = {
      status: response.status,
      location: response.headers.get("location"),
      xFrameOptions: response.headers.get("x-frame-options"),
      contentSecurityPolicy: response.headers.get("content-security-policy"),
      setCookiePresent: Boolean(response.headers.get("set-cookie")),
    };
  } catch (error) {
    embed = { error: error instanceof Error ? error.message : "Embed probe failed" };
  }

  return {
    safe: true,
    note: "Authenticated capability probe. POST candidates use an empty JSON body, so no destination number is supplied and no phone call can be placed by this probe.",
    environment: process.env.VERCEL_ENV || "unknown",
    probes,
    embed,
  };
}

export async function GET(request: Request) {
  const access = await getCockpitAccess();
  if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const url = new URL(request.url);
  const wantsProbe = url.searchParams.get("probe") === "1";

  if (wantsProbe) {
    if (!isWithAlloConfigured()) {
      return NextResponse.json({ error: "WITHALLO_API_KEY is not configured on this environment." }, { status: 503, headers: { "cache-control": "no-store" } });
    }
    const probe = await runNativeVoiceProbe();
    return NextResponse.json(probe, { headers: { "cache-control": "no-store" } });
  }

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
