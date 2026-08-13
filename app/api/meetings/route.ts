import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";

const properties = ["hs_meeting_title","hs_meeting_start_time","hs_meeting_end_time","hs_meeting_location","hs_meeting_outcome","hubspot_owner_id","hs_timestamp","hs_meeting_body"];
const contactProperties = ["firstname","lastname","email","phone","mobilephone","company","jobtitle","hubspot_owner_id","statut_prospection","statut_de_lappel","hs_last_sales_activity_timestamp"];

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const after = url.searchParams.get("after");
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const owner = url.searchParams.get("owner")?.trim();
    const outcome = url.searchParams.get("outcome")?.trim();

    const filters = [] as { propertyName: string; operator: string; value: string }[];
    if (start) filters.push({ propertyName: "hs_meeting_start_time", operator: "GTE", value: start });
    if (end) filters.push({ propertyName: "hs_meeting_start_time", operator: "LTE", value: end });
    if (owner) filters.push({ propertyName: "hubspot_owner_id", operator: "EQ", value: owner });
    if (outcome) filters.push({ propertyName: "hs_meeting_outcome", operator: "EQ", value: outcome });

    const body: Record<string, unknown> = { limit: 100, properties, sorts: [{ propertyName: "hs_meeting_start_time", direction: "DESCENDING" }] };
    if (after) body.after = after;
    if (filters.length) body.filterGroups = [{ filters }];

    const data = await hubspotJson("/crm/objects/2026-03/meetings/search", { method: "POST", body: JSON.stringify(body) });
    const meetings = (data.results ?? []) as any[];

    if (meetings.length) {
      try {
        const assoc = await hubspotJson("/crm/associations/2026-03/meetings/contacts/batch/read", {
          method: "POST",
          body: JSON.stringify({ inputs: meetings.map(m => ({ id: String(m.id) })) }),
        });
        const meetingToContact = new Map<string, string>();
        for (const r of assoc.results ?? []) {
          const to = Array.isArray(r?.to) ? r.to : [];
          const contact = to.find((x: any) => x?.id);
          if (contact) meetingToContact.set(String(r.from.id), String(contact.id));
        }
        const contactIds = [...new Set(meetingToContact.values())];
        const contactsBy = new Map<string, any>();
        if (contactIds.length) {
          const contacts = await hubspotJson("/crm/objects/2026-03/contacts/batch/read", {
            method: "POST",
            body: JSON.stringify({ properties: contactProperties, inputs: contactIds.map(id => ({ id })) }),
          });
          for (const c of contacts.results ?? []) contactsBy.set(String(c.id), c);
        }
        for (const m of meetings) {
          const contactId = meetingToContact.get(String(m.id)) || null;
          m.contactId = contactId;
          m.contact = contactId && contactsBy.has(contactId) ? contactsBy.get(contactId).properties : null;
        }
      } catch { /* meetings restent affichés sans contact associé */ }
    }

    return NextResponse.json({ results: meetings, total: data.total ?? meetings.length, paging: data.paging });
  } catch (error) { return apiError(error); }
}
