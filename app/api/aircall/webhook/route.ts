import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeAircallPhone } from "@/lib/aircall";

export const dynamic = "force-dynamic";

function safeTokenMatch(actual: unknown, expected: string) {
  if (typeof actual !== "string") return false;
  const a = Buffer.from(actual, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function iso(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value * 1000).toISOString();
  if (typeof value === "string" && value.trim() && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const expected = process.env.AIRCALL_WEBHOOK_TOKEN?.trim();
    if (!expected) return NextResponse.json({ error: "Webhook Aircall non configuré." }, { status: 503 });
    const rawBody = await request.text();
    if (rawBody.length > 128_000) return NextResponse.json({ error: "Payload trop volumineux." }, { status: 413 });
    const payload = JSON.parse(rawBody) as { token?: unknown; event?: string; data?: Record<string, unknown> };
    if (!safeTokenMatch(payload.token, expected)) return NextResponse.json({ error: "Webhook non autorisé." }, { status: 401 });
    const accepted = new Set(["call.ended", "call.tagged", "call.commented", "call.comm_assets_generated"]);
    if (!payload.event || !accepted.has(payload.event)) return NextResponse.json({ ok: true, ignored: true });
    const call = payload.data || {};
    const id = Number(call.id);
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Identifiant d’appel invalide." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    if (payload.event === "call.tagged") {
      const tags = Array.isArray(call.tags) ? call.tags.map(tag => typeof tag === "string" ? tag : tag && typeof tag === "object" ? String((tag as Record<string, unknown>).name || "") : "").filter(Boolean).slice(0, 30) : [];
      const { error } = await supabase.from("aircall_calls").update({ tags, updated_at: new Date().toISOString() }).eq("call_id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (payload.event === "call.comm_assets_generated") {
      const recording = typeof call.recording === "string" && call.recording.startsWith("https://") ? call.recording : null;
      if (recording) {
        const { error } = await supabase.from("aircall_calls").update({ recording_url: recording, updated_at: new Date().toISOString() }).eq("call_id", id);
        if (error) throw error;
      }
      return NextResponse.json({ ok: true });
    }
    if (payload.event === "call.commented") return NextResponse.json({ ok: true });
    const user = (call.user || {}) as Record<string, unknown>;
    const from = typeof call.raw_digits === "string" ? call.raw_digits : "";
    const externalNumber = normalizeAircallPhone(from);
    const tags = Array.isArray(call.tags) ? call.tags.map(tag => {
      if (typeof tag === "string") return tag;
      if (tag && typeof tag === "object") return String((tag as Record<string, unknown>).name || "");
      return "";
    }).filter(Boolean).slice(0, 30) : [];
    const row = {
      call_id: id,
      direction: typeof call.direction === "string" ? call.direction : null,
      external_number: externalNumber,
      started_at: iso(call.started_at) || iso(call.created_at) || new Date().toISOString(),
      ended_at: iso(call.ended_at),
      duration_seconds: Number.isFinite(Number(call.duration)) ? Math.max(0, Number(call.duration)) : null,
      status: typeof call.status === "string" ? call.status : null,
      recording_url: typeof call.recording === "string" && /^https:\/\//.test(call.recording) ? call.recording : null,
      agent_id: Number.isSafeInteger(Number(user.id)) ? Number(user.id) : null,
      agent_email: typeof user.email === "string" ? user.email : null,
      tags,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("aircall_calls").upsert(row, { onConflict: "call_id" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Aircall webhook processing failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Impossible de traiter l’événement Aircall." }, { status: 500 });
  }
}
