import "server-only";

import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getWithAlloCalls } from "@/lib/withallo";
import { shapeWithAlloCallDetail } from "@/lib/withallo-call-detail";
import { normalizeWithAlloDialNumber } from "@/lib/withallo-phone";
import { getAuthorizedAlloCall } from "@/lib/withallo-recordings";

type RecordKind = "contact" | "company";
type CrmRow = {
  hubspot_id: string;
  phone: string | null;
  raw_data: { properties?: { phone?: string | null; mobilephone?: string | null } } | null;
};
type Link = { contactId: string | null; phone: string };

function phonesFrom(row: CrmRow): string[] {
  return [...new Set([row.phone, row.raw_data?.properties?.phone, row.raw_data?.properties?.mobilephone]
    .map(normalizeWithAlloDialNumber).filter((value): value is string => Boolean(value)))];
}

async function getRecordPhones(kind: RecordKind, id: string): Promise<Link[]> {
  const db = getSupabaseAdmin();
  if (kind === "contact") {
    const { data, error } = await db.from("contacts").select("hubspot_id,phone,raw_data")
      .eq("hubspot_id", id).maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("Contact absent du CRM."), { status: 404 });
    return phonesFrom(data as CrmRow).map(phone => ({ phone, contactId: id }));
  }
  const { data: company, error } = await db.from("companies")
    .select("id,hubspot_id,phone,raw_data").eq("hubspot_id", id).maybeSingle();
  if (error) throw error;
  if (!company) throw Object.assign(new Error("Entreprise absente du CRM."), { status: 404 });
  const { data: contacts, error: contactError } = await db.from("contacts")
    .select("hubspot_id,phone,raw_data")
    .eq("company_id", company.id).order("hubspot_updated_at", { ascending: false })
    .limit(80);
  if (contactError) throw contactError;

  const all: Link[] = [
    ...phonesFrom(company as CrmRow).map(phone => ({ phone, contactId: null })),
    ...(contacts || []).flatMap(contact =>
      phonesFrom(contact as CrmRow).map(phone => ({ phone, contactId: String(contact.hubspot_id) })),
    ),
  ];
  return [...new Map(all.map(item => [item.phone, item])).values()].slice(0, 80);
}

export async function getAlloAiForCrm(kind: RecordKind, id: string) {
  const access = await requireCockpitAccess();
  const linkedPhones = await getRecordPhones(kind, id);
  const expected = new Set(linkedPhones.map(item => item.phone));
  if (!expected.size) return { calls: [], scanned: 0, linkedPhones: 0, limited: false };

  // Allo's history endpoint reads the latest 100 calls. We only associate a call
  // using its external counterparty number, NEVER the Gando line (from/to).
  const history = await getWithAlloCalls(100);
  const eligible = history.filter(call => {
    const external = normalizeWithAlloDialNumber(call.externalNumber);
    if (!external || !expected.has(external)) return false;
    if (access.role === "admin") return true;
    return Boolean(access.email && call.ownerEmail?.toLowerCase() === access.email.toLowerCase());
  }).slice(0, 8);

  const detailed = await Promise.allSettled(eligible.map(async entry => {
    // The same endpoint used by the telephone workspace enforces per-agent ACL.
    const raw = await getAuthorizedAlloCall(entry.id, access, true);
    const detail = shapeWithAlloCallDetail(raw);
    const external = normalizeWithAlloDialNumber(entry.externalNumber);
    const link = linkedPhones.find(item => item.phone === external);
    if (!external || !link) return null;
    return {
      id: detail.id,
      title: detail.title,
      startedAt: detail.startedAt || entry.startedAt,
      status: detail.status || entry.status,
      direction: detail.direction || entry.direction,
      contactName: detail.contactName || entry.contactName,
      contactNumber: external,
      contactId: link.contactId,
      memberEmail: detail.memberEmail || entry.ownerEmail,
      summary: detail.summary || entry.summary,
      transcriptText: detail.transcriptText?.slice(0, 30000) || entry.transcript?.slice(0, 30000) || null,
      actions: detail.actions.slice(0, 12).map(action => ({
        text: action.text.slice(0, 500),
        dueAt: action.dueAt,
      })),
    };
  }));

  return {
    calls: detailed.flatMap(item => item.status === "fulfilled" && item.value ? [item.value] : []),
    scanned: history.length,
    linkedPhones: expected.size,
    limited: history.length >= 100,
  };
}
