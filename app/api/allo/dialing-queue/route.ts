import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import {
  appendWithAlloDialingQueue,
  getWithAlloCurrentQueue,
  isWithAlloConfigured,
  resolveWithAlloTarget,
  safeWithAlloError,
  type WithAlloQueueNumber,
} from "@/lib/withallo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await requireCockpitAccess();
    if (!isWithAlloConfigured()) {
      return NextResponse.json({ error: "WITHALLO_NOT_CONFIGURED" }, { status: 503 });
    }
    const target = await resolveWithAlloTarget(access.email || null);
    const queue = await getWithAlloCurrentQueue({ userId: target.userId, email: target.email });
    return NextResponse.json({
      ok: true,
      target: { userId: target.userId, email: target.email, name: target.user?.name || null, source: target.source },
      ...queue,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const safe = safeWithAlloError(error);
    const status = Number((error as { status?: number })?.status) || safe.status || 500;
    return NextResponse.json({ error: safe }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireCockpitAccess();
    if (!isWithAlloConfigured()) {
      return NextResponse.json({ error: "WITHALLO_NOT_CONFIGURED" }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const rawNumbers = Array.isArray(body?.numbers) ? body.numbers : [];
    const numbers: WithAlloQueueNumber[] = rawNumbers.slice(0, 500).map((item: Record<string, unknown>) => ({
      number: String(item?.number || "").trim(),
      ...(item?.name ? { name: String(item.name).slice(0, 256) } : {}),
      ...(item?.last_name ? { last_name: String(item.last_name).slice(0, 256) } : {}),
      ...(item?.company ? { company: String(item.company).slice(0, 256) } : {}),
      ...(item?.job_title ? { job_title: String(item.job_title).slice(0, 256) } : {}),
      ...(Array.isArray(item?.emails) ? { emails: item.emails.map(value => String(value)).filter(Boolean).slice(0, 10) } : {}),
      ...(item?.website ? { website: String(item.website).slice(0, 500) } : {}),
    })).filter((item: WithAlloQueueNumber) => Boolean(item.number));

    if (!numbers.length) {
      return NextResponse.json({ error: "NUMBERS_REQUIRED", message: "Ajoutez au moins un numéro à la file Allo." }, { status: 400 });
    }

    const automaticTarget = await resolveWithAlloTarget(access.email || null);
    const userId = body?.userId ? String(body.userId) : automaticTarget.userId;
    const email = body?.email ? String(body.email) : automaticTarget.email;
    const result = await appendWithAlloDialingQueue({ numbers, userId, email });
    return NextResponse.json({
      ok: true,
      target: { userId, email, name: automaticTarget.user?.name || null, source: automaticTarget.source },
      ...result,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const safe = safeWithAlloError(error);
    const status = Number((error as { status?: number })?.status) || safe.status || 500;
    return NextResponse.json({ error: safe }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}
