import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { hubspotJson } from "@/lib/hubspot";
import { normalizeWithAlloDialNumber } from "@/lib/withallo-phone";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

type Contact = { id: string; name: string; company: string | null; href: string };
type HubSpotContact = {
  id?: string;
  properties?: Record<string, string | null | undefined>;
};
type HubSpotSearch = { results?: HubSpotContact[]; total?: number };

function candidateNumbers(e164: string) {
  const list = new Set<string>([e164]);
  list.add("00" + e164.slice(1));
  if (e164.startsWith("+33") && e164.length === 12) list.add("0" + e164.slice(3));
  // The international form is unique; national forms are used only to query and
  // are revalidated against full E.164 below before a screen pop is allowed.
  if (e164.startsWith("+590") && e164.length === 13) list.add("0" + e164.slice(4));
  if (e164.startsWith("+596") && e164.length === 13) list.add("0" + e164.slice(4));
  if (e164.startsWith("+594") && e164.length === 13) list.add("0" + e164.slice(4));
  if (e164.startsWith("+262") && e164.length === 13) list.add("0" + e164.slice(4));
  return [...list];
}

async function searchNumber(
  values: string[], operator: "EQ" | "CONTAINS_TOKEN",
): Promise<HubSpotContact[]> {
  const filterGroups = values.flatMap(value => ["phone", "mobilephone"].map(propertyName => ({
    filters: [{ propertyName, operator, value }],
  }))).slice(0, 5);
  if (!filterGroups.length) return [];
  const payload = await hubspotJson("/crm/objects/2026-03/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups,
      limit: 20,
      properties: ["firstname", "lastname", "email", "phone", "mobilephone", "company"],
    }),
  }) as HubSpotSearch;
  return Array.isArray(payload.results) ? payload.results : [];
}

function isExactMatch(contact: HubSpotContact, expected: string) {
  const p = contact.properties || {};
  return [p.phone, p.mobilephone].some(value => normalizeWithAlloDialNumber(value) === expected);
}
function present(contact: HubSpotContact): Contact | null {
  const id = String(contact.id || "");
  if (!/^\d+$/.test(id)) return null;
  const p = contact.properties || {};
  return {
    id,
    href: "/contacts/" + encodeURIComponent(id),
    name: [p.firstname, p.lastname].filter(Boolean).join(" ").trim() || p.email || "Contact HubSpot",
    company: p.company || null,
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireCockpitAccess();
    const phone = normalizeWithAlloDialNumber(request.nextUrl.searchParams.get("phone"));
    if (!phone) return NextResponse.json({ error: "Numéro entrant non valide." }, { status: 400 });

    const numbers = candidateNumbers(phone);
    const exact = await searchNumber(numbers.slice(0, 2), "EQ");
    const local = numbers.slice(2);
    // EQ is preferred to avoid false matches; a token search is only a
    // discovery fallback, and every result is re-verified as a full number.
    const supplemental = exact.length === 0
      ? await searchNumber([...(local.slice(0, 1)), "*" + phone.replace(/\D/g, "").slice(-9)], "CONTAINS_TOKEN").catch(() => [])
      : [];
    const rows = [...exact, ...supplemental];
    const distinct = new Map<string, Contact>();
    for (const row of rows) {
      if (!isExactMatch(row, phone)) continue;
      const item = present(row);
      if (item) distinct.set(item.id, item);
    }
    const contacts = [...distinct.values()].slice(0, 8);
    const result = contacts.length === 1 ? "match" : contacts.length ? "multiple" : "unknown";
    return NextResponse.json(
      { result, contacts, phone },
      { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
    );
  } catch (error) {
    const raw = Number((error as { status?: number })?.status || 502);
    const status = [400, 401, 403, 404, 429, 503].includes(raw) ? raw : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recherche du contact entrant indisponible." },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
