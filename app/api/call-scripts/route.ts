import { NextRequest, NextResponse } from "next/server"
import { requireCockpitAccess } from "@/lib/cockpit-access"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const TEXT_FIELDS = ["name", "segment", "description", "source_url", "introduction", "value_proposition", "closing"] as const
const ARRAY_FIELDS = ["discovery_questions", "qualification_rules", "objections"] as const

function cleanString(value: unknown) {
  return value === undefined || value === null ? undefined : String(value).trim()
}

function cleanArray(value: unknown) {
  if (!Array.isArray(value)) return undefined
  return value.map(item => String(item).trim()).filter(Boolean)
}

function normalizePayload(body: any) {
  const payload: Record<string, unknown> = {}
  for (const field of TEXT_FIELDS) {
    const value = cleanString(body?.[field])
    if (value !== undefined) payload[field] = value || null
  }
  for (const field of ARRAY_FIELDS) {
    const value = cleanArray(body?.[field])
    if (value !== undefined) payload[field] = value
  }
  if (body?.is_active !== undefined) payload.is_active = Boolean(body.is_active)
  if (body?.is_default !== undefined) payload.is_default = Boolean(body.is_default)
  return payload
}

function canManage(role: string) {
  return role !== "commercial"
}

export async function GET() {
  try {
    const access = await requireCockpitAccess()
    const supabase = getSupabaseAdmin()
    let query = supabase.from("sales_call_scripts").select("*").order("is_default", { ascending: false }).order("updated_at", { ascending: false })
    if (!canManage(access.role)) query = query.eq("is_active", true)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ results: data || [], canManage: canManage(access.role) }, { headers: { "cache-control": "no-store" } })
  } catch (error) {
    const e = error as Error & { status?: number }
    return NextResponse.json({ error: e.message || "Impossible de charger les scripts" }, { status: e.status || 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireCockpitAccess()
    if (!canManage(access.role)) return NextResponse.json({ error: "Seuls les responsables peuvent gérer les scripts." }, { status: 403 })
    const body = await request.json()
    const payload = normalizePayload(body)
    if (!payload.name || !payload.introduction || !payload.value_proposition || !payload.closing) {
      return NextResponse.json({ error: "Nom, introduction, proposition de valeur et closing sont requis." }, { status: 400 })
    }
    const supabase = getSupabaseAdmin()
    if (payload.is_default) {
      const { error } = await supabase.from("sales_call_scripts").update({ is_default: false }).eq("is_default", true)
      if (error) throw error
    }
    const now = new Date().toISOString()
    const { data, error } = await supabase.from("sales_call_scripts").insert({
      ...payload,
      segment: payload.segment || "Loueurs indépendants",
      created_by: access.email || null,
      updated_by: access.email || null,
      updated_at: now,
    }).select("*").single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    const e = error as Error & { status?: number; code?: string }
    const message = e.code === "23505" ? "Un script porte déjà ce nom." : e.message || "Impossible de créer le script"
    return NextResponse.json({ error: message }, { status: e.status || 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await requireCockpitAccess()
    if (!canManage(access.role)) return NextResponse.json({ error: "Seuls les responsables peuvent gérer les scripts." }, { status: 403 })
    const body = await request.json()
    const id = String(body?.id || "").trim()
    if (!id) return NextResponse.json({ error: "SCRIPT_ID_REQUIRED" }, { status: 400 })
    const payload = normalizePayload(body)
    const supabase = getSupabaseAdmin()
    if (payload.is_default) {
      const { error } = await supabase.from("sales_call_scripts").update({ is_default: false }).neq("id", id).eq("is_default", true)
      if (error) throw error
    }
    const { data, error } = await supabase.from("sales_call_scripts").update({
      ...payload,
      updated_by: access.email || null,
      updated_at: new Date().toISOString(),
    }).eq("id", id).select("*").single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    const e = error as Error & { status?: number; code?: string }
    const message = e.code === "23505" ? "Un script porte déjà ce nom." : e.message || "Impossible de modifier le script"
    return NextResponse.json({ error: message }, { status: e.status || 500 })
  }
}
