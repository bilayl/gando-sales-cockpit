import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function text(value: unknown) {
  return String(value || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function timestamp(value: unknown) {
  const time = new Date(String(value || 0)).getTime();
  return Number.isFinite(time) ? time : 0;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: activityRows, error: activityError } = await supabase
      .from("activities")
      .select("hubspot_id,contact_id,activity_type,occurred_at,subject,body,outcome,raw_data")
      .in("activity_type", ["call", "note"])
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(400);
    if (activityError) throw activityError;

    const rows = activityRows || [];
    const contactIds = [...new Set(rows.map((row: any) => row.contact_id).filter(Boolean))];
    if (!contactIds.length) return NextResponse.json({ candidates: [] }, { headers: { "cache-control": "no-store" } });

    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("id,hubspot_id,email,first_name,last_name,company_id,raw_data")
      .in("id", contactIds);
    if (contactsError) throw contactsError;

    const companyIds = [...new Set((contacts || []).map((row: any) => row.company_id).filter(Boolean))];
    const companies = companyIds.length
      ? await supabase.from("companies").select("id,name,raw_data").in("id", companyIds)
      : { data: [], error: null };
    if (companies.error) throw companies.error;

    const contactById = new Map((contacts || []).map((row: any) => [String(row.id), row]));
    const companyById = new Map((companies.data || []).map((row: any) => [String(row.id), row]));
    const notesByContact = new Map<string, any[]>();

    for (const row of rows) {
      if (row.activity_type !== "note" || !row.contact_id) continue;
      const key = String(row.contact_id);
      const current = notesByContact.get(key) || [];
      current.push(row);
      notesByContact.set(key, current);
    }

    const candidates = rows
      .filter((row: any) => row.activity_type === "call" && row.contact_id)
      .map((call: any) => {
        const contact = contactById.get(String(call.contact_id));
        const props = contact?.raw_data?.properties || {};
        const email = text(contact?.email || props.email);
        if (!contact || !contact.hubspot_id || !email) return null;

        const callAt = timestamp(call.occurred_at || call.raw_data?.properties?.hs_timestamp);
        const callBody = text(call.body || call.raw_data?.properties?.hs_call_body);
        const nearbyNotes = (notesByContact.get(String(call.contact_id)) || [])
          .map(note => ({ note, at: timestamp(note.occurred_at || note.raw_data?.properties?.hs_timestamp), body: text(note.body || note.raw_data?.properties?.hs_note_body) }))
          .filter(item => item.body.length >= 80 && item.at >= callAt - 10 * 60_000 && item.at <= callAt + 12 * 60 * 60_000)
          .sort((a, b) => Math.abs(a.at - callAt) - Math.abs(b.at - callAt));

        const transcription = nearbyNotes[0]?.body || (callBody.length >= 80 ? callBody : "");
        if (!transcription) return null;

        const company = contact.company_id ? companyById.get(String(contact.company_id)) : null;
        const companyName = text(company?.name || company?.raw_data?.properties?.name || props.company);
        return {
          callId: String(call.hubspot_id),
          contactId: String(contact.hubspot_id),
          email,
          firstName: text(contact.first_name || props.firstname),
          lastName: text(contact.last_name || props.lastname),
          companyName,
          callTitle: text(call.subject || call.raw_data?.properties?.hs_call_title || "Appel"),
          callBody,
          transcription,
          occurredAt: call.occurred_at || call.raw_data?.properties?.hs_timestamp || null,
          outcome: text(call.outcome || call.raw_data?.properties?.hs_call_disposition || call.raw_data?.properties?.hs_call_status),
        };
      })
      .filter(Boolean)
      .slice(0, 25);

    return NextResponse.json({ candidates }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger les suivis après appel" }, { status: 500 });
  }
}
