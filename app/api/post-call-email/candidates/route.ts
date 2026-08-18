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

function emailRequestDetected(value: string) {
  const normalized = value.toLowerCase();
  return [
    /(?:envoy|transmet|adress).{0,50}(?:mail|email|e-mail|récap|récapitulatif|présentation|documentation|devis)/i,
    /(?:mail|email|e-mail).{0,45}(?:récap|récapitulatif|présentation|documentation|devis|envoy|transmet)/i,
    /(?:récap|récapitulatif|présentation|documentation|devis).{0,45}(?:mail|email|e-mail)/i,
  ].some(pattern => pattern.test(normalized));
}

function formatContextDate(value: number) {
  if (!value) return "date non précisée";
  return new Date(value).toISOString();
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const callSince = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const noteSince = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();

    const { data: callRows, error: callError } = await supabase
      .from("activities")
      .select("hubspot_id,contact_id,activity_type,occurred_at,subject,body,outcome,raw_data")
      .eq("activity_type", "call")
      .gte("occurred_at", callSince)
      .order("occurred_at", { ascending: false })
      .limit(250);
    if (callError) throw callError;

    const calls = callRows || [];
    const contactIds = [...new Set(calls.map((row: any) => row.contact_id).filter(Boolean))];
    if (!contactIds.length) return NextResponse.json({ candidates: [] }, { headers: { "cache-control": "no-store" } });

    const { data: noteRows, error: noteError } = await supabase
      .from("activities")
      .select("hubspot_id,contact_id,activity_type,occurred_at,subject,body,outcome,raw_data")
      .eq("activity_type", "note")
      .in("contact_id", contactIds)
      .gte("occurred_at", noteSince)
      .order("occurred_at", { ascending: false })
      .limit(1000);
    if (noteError) throw noteError;

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

    for (const row of noteRows || []) {
      if (!row.contact_id) continue;
      const key = String(row.contact_id);
      const current = notesByContact.get(key) || [];
      current.push(row);
      notesByContact.set(key, current);
    }

    const candidates = calls
      .filter((row: any) => row.contact_id)
      .map((call: any) => {
        const contact = contactById.get(String(call.contact_id));
        const props = contact?.raw_data?.properties || {};
        const email = text(contact?.email || props.email);
        if (!contact || !contact.hubspot_id || !email) return null;

        const callId = String(call.hubspot_id);
        const notesForContact = notesByContact.get(String(call.contact_id)) || [];
        const sentMarker = `[GANDO_POST_CALL_EMAIL:${callId}]`;
        const alreadySent = notesForContact.some(note => text(note.body || note.raw_data?.properties?.hs_note_body).includes(sentMarker));
        if (alreadySent) return null;

        const callAt = timestamp(call.occurred_at || call.raw_data?.properties?.hs_timestamp);
        const callBody = text(call.body || call.raw_data?.properties?.hs_call_body);
        const contextFloor = callAt - 120 * 24 * 60 * 60_000;
        const contextCeiling = callAt + 12 * 60 * 60_000;

        const contextualNotes = notesForContact
          .map(note => ({
            note,
            at: timestamp(note.occurred_at || note.raw_data?.properties?.hs_timestamp),
            body: text(note.body || note.raw_data?.properties?.hs_note_body),
          }))
          .filter(item => !item.body.startsWith("[GANDO_POST_CALL_EMAIL:") && item.body.length >= 80 && item.at >= contextFloor && item.at <= contextCeiling)
          .sort((a, b) => b.at - a.at)
          .filter((item, index, array) => array.findIndex(other => other.body.toLowerCase() === item.body.toLowerCase()) === index)
          .slice(0, 5);

        const nearbyNote = contextualNotes
          .filter(item => item.at >= callAt - 10 * 60_000 && item.at <= callAt + 12 * 60 * 60_000)
          .sort((a, b) => Math.abs(a.at - callAt) - Math.abs(b.at - callAt))[0];

        const primaryTranscription = nearbyNote?.body || (callBody.length >= 80 ? callBody : contextualNotes[0]?.body || "");
        if (!primaryTranscription) return null;

        const contextParts: string[] = [];
        if (nearbyNote) {
          contextParts.push(`Note principale — ${formatContextDate(nearbyNote.at)}\n${nearbyNote.body}`);
        } else if (callBody.length >= 80) {
          contextParts.push(`Compte-rendu de l'appel — ${formatContextDate(callAt)}\n${callBody}`);
        }

        if (callBody.length >= 80 && callBody !== primaryTranscription) {
          contextParts.push(`Compte-rendu de l'appel — ${formatContextDate(callAt)}\n${callBody}`);
        }

        for (const item of contextualNotes) {
          if (item.body === primaryTranscription || item.body === callBody) continue;
          contextParts.push(`Note de contexte — ${formatContextDate(item.at)}\n${item.body}`);
          if (contextParts.length >= 5) break;
        }

        const transcription = contextParts.join("\n\n").slice(0, 12000) || primaryTranscription;
        const company = contact.company_id ? companyById.get(String(contact.company_id)) : null;
        const companyName = text(company?.name || company?.raw_data?.properties?.name || props.company);
        return {
          callId,
          contactId: String(contact.hubspot_id),
          email,
          firstName: text(contact.first_name || props.firstname),
          lastName: text(contact.last_name || props.lastname),
          companyName,
          callTitle: text(call.subject || call.raw_data?.properties?.hs_call_title || "Appel"),
          callBody,
          transcription,
          emailRequested: emailRequestDetected(primaryTranscription),
          occurredAt: call.occurred_at || call.raw_data?.properties?.hs_timestamp || null,
          outcome: text(call.outcome || call.raw_data?.properties?.hs_call_disposition || call.raw_data?.properties?.hs_call_status),
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => Number(b.emailRequested) - Number(a.emailRequested) || timestamp(b.occurredAt) - timestamp(a.occurredAt))
      .slice(0, 25);

    return NextResponse.json({ candidates }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger les suivis après appel" }, { status: 500 });
  }
}
