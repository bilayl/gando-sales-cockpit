import { NextRequest, NextResponse } from "next/server";
import { getCockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type OnoffRow = {
  call_id: string;
  direction: string | null;
  call_status: string | null;
  call_duration: number | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  onoff_user: Record<string, unknown> | null;
};

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function duration(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function userKey(row: OnoffRow) {
  const email = cleanText(row.onoff_user?.email)?.toLowerCase();
  const number = cleanText(row.onoff_user?.number);
  const name = cleanText(row.onoff_user?.name);
  return email || number || name || "unassigned";
}

export async function GET(request: NextRequest) {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const url = new URL(request.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const startMs = start ? Date.parse(start) : NaN;
    const endMs = end ? Date.parse(end) : NaN;
    if (!start || !end || !Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
      return NextResponse.json({ error: "Période Onoff invalide." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const [rangeResult, latestResult] = await Promise.all([
      admin
        .from("onoff_call_processing")
        .select("call_id,direction,call_status,call_duration,started_at,ended_at,created_at,onoff_user")
        .eq("event_name", "CDR")
        .gte("started_at", start)
        .lte("started_at", end)
        .order("started_at", { ascending: false })
        .limit(2000),
      admin
        .from("onoff_call_processing")
        .select("started_at,created_at")
        .eq("event_name", "CDR")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (rangeResult.error) throw rangeResult.error;
    if (latestResult.error) throw latestResult.error;

    const rows = (rangeResult.data || []) as OnoffRow[];
    const perUser = new Map<string, {
      key: string;
      name: string;
      email: string | null;
      number: string | null;
      calls: number;
      outbound: number;
      answered: number;
      outboundAnswered: number;
      talkSeconds: number;
      meaningfulCalls: number;
      lastCallAt: string | null;
    }>();

    let outbound = 0;
    let inbound = 0;
    let answered = 0;
    let outboundAnswered = 0;
    let talkSeconds = 0;
    let meaningfulCalls = 0;
    let lastCallAt: string | null = null;

    for (const row of rows) {
      const direction = String(row.direction || "").toUpperCase();
      const status = String(row.call_status || "").toUpperCase();
      const isAnswered = status === "ANSWERED";
      const seconds = isAnswered ? duration(row.call_duration) : 0;
      if (direction === "OUTBOUND") outbound += 1;
      if (direction === "INBOUND") inbound += 1;
      if (isAnswered) answered += 1;
      if (direction === "OUTBOUND" && isAnswered) outboundAnswered += 1;
      talkSeconds += seconds;
      if (isAnswered && seconds >= 30) meaningfulCalls += 1;
      if (!lastCallAt && row.started_at) lastCallAt = row.started_at;

      const key = userKey(row);
      const current = perUser.get(key) || {
        key,
        name: cleanText(row.onoff_user?.name) || cleanText(row.onoff_user?.email) || "Non attribué",
        email: cleanText(row.onoff_user?.email),
        number: cleanText(row.onoff_user?.number),
        calls: 0,
        outbound: 0,
        answered: 0,
        outboundAnswered: 0,
        talkSeconds: 0,
        meaningfulCalls: 0,
        lastCallAt: null,
      };
      current.calls += 1;
      if (direction === "OUTBOUND") current.outbound += 1;
      if (isAnswered) current.answered += 1;
      if (direction === "OUTBOUND" && isAnswered) current.outboundAnswered += 1;
      current.talkSeconds += seconds;
      if (isAnswered && seconds >= 30) current.meaningfulCalls += 1;
      if (!current.lastCallAt && row.started_at) current.lastCallAt = row.started_at;
      perUser.set(key, current);
    }

    const latest = latestResult.data as { started_at?: string | null; created_at?: string | null } | null;
    const lastReceivedAt = latest?.created_at || latest?.started_at || null;
    const lastReceivedMs = lastReceivedAt ? Date.parse(lastReceivedAt) : NaN;
    const staleHours = Number.isFinite(lastReceivedMs) ? (Date.now() - lastReceivedMs) / 3_600_000 : null;

    const users = [...perUser.values()]
      .map(row => ({
        ...row,
        avgTalkSeconds: row.answered > 0 ? row.talkSeconds / row.answered : 0,
        answerRate: row.outbound > 0 ? row.outboundAnswered / row.outbound : null,
      }))
      .sort((a, b) => b.outbound - a.outbound || b.talkSeconds - a.talkSeconds);

    return NextResponse.json({
      source: "onoff_cdr",
      start,
      end,
      targetOutboundCalls: 80,
      kpis: {
        calls: rows.length,
        outbound,
        inbound,
        answered,
        outboundAnswered,
        talkSeconds,
        avgTalkSeconds: answered > 0 ? talkSeconds / answered : 0,
        meaningfulCalls,
        answerRate: outbound > 0 ? outboundAnswered / outbound : null,
        pacing: outbound / 80,
        lastCallAt,
      },
      users,
      freshness: {
        lastReceivedAt,
        staleHours,
        isStale: staleHours == null || staleHours > 24,
      },
    });
  } catch (error) {
    console.error("Onoff live analytics failed", error);
    return NextResponse.json({ error: "Impossible de charger les statistiques Onoff en direct." }, { status: 500 });
  }
}
