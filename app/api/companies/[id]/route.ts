import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function hubspotRecord(row: any) {
  return { id: String(row.hubspot_id), properties: row.raw_data?.properties ?? {} };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data: company, error } = await supabaseAdmin.from("companies").select("*").eq("hubspot_id", id).maybeSingle();
    if (error) throw error;
    if (!company) return NextResponse.json({ error: "Entreprise introuvable dans Supabase. Lancez une synchronisation." }, { status: 404 });

    const [contactsResult, activitiesResult] = await Promise.all([
      supabaseAdmin.from("contacts").select("hubspot_id,raw_data").eq("company_id", company.id),
      supabaseAdmin.from("activities").select("hubspot_id,activity_type,occurred_at,raw_data").eq("company_id", company.id),
    ]);
    if (contactsResult.error) throw contactsResult.error;
    if (activitiesResult.error) throw activitiesResult.error;

    const contacts = (contactsResult.data ?? []).map(hubspotRecord);
    const notes = (activitiesResult.data ?? [])
      .filter(a => a.activity_type === "note")
      .map(hubspotRecord);
    const meetings = (activitiesResult.data ?? [])
      .filter(a => a.activity_type === "meeting")
      .map(hubspotRecord)
      .map((meeting: any) => {
        const startAt = meeting.properties?.hs_meeting_start_time || meeting.properties?.hs_timestamp || null;
        const outcome = meeting.properties?.hs_meeting_outcome || (startAt && new Date(startAt).getTime() >= Date.now() ? "SCHEDULED" : "UNREVIEWED");
        return { ...meeting, derived: { startAt, status: outcome } };
      })
      .sort((a: any, b: any) => new Date(b.derived.startAt || 0).getTime() - new Date(a.derived.startAt || 0).getTime());
    const nextMeeting = [...meetings]
      .filter((meeting: any) => meeting.derived.status === "SCHEDULED" && new Date(meeting.derived.startAt || 0).getTime() >= Date.now())
      .sort((a: any, b: any) => new Date(a.derived.startAt).getTime() - new Date(b.derived.startAt).getTime())[0] || null;

    return NextResponse.json({ company: hubspotRecord(company), contacts, notes, meetings, nextMeeting });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message || "Erreur Supabase", details: e }, { status: 500 });
  }
}
