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
): Promise<{ rows: HubSpotContact[]; total: number }> {
  const filterGroups = values.flatMap(value => ["phone", "mobilephone"].map(propertyName => ({
    filters: [{ propertyName, operator, value }],
  }))).slice(0, 5);
  if (!filterGroups.length) return { rows: [], total: 0 };
  const payload = await hubspotJson("/crm/objects/2026-03/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups,
      limit: 20,
      properties: ["firstname", "lastname", "email", "phone", "mobilephone", "company"],
    }),
  }) as HubSpotSearch;
  return { rows: Array.isArray(payload.results) ? payload.results : [], total: Number(payload.total || 0) };
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
    const national = numbers.find(value => /^0\d{9}$/.test(value));
    const spaced = national?.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
    const dotted = national?.replace(/(\d{2})(?=\d)/g, "$1.").replace(/\.$/, "");
    const variants = [...new Set([
      phone, national, spaced, dotted, "00" + phone.slice(1),
    ].filter((value): value is string => Boolean(value)))];

    // HubSpot phones have no single reliable storage format. Try exact
    // comparisons across E.164, local, spaced and dotted representations.
    // A failed format must not make every other lookup fail.
    const calls = [];
    for (let start = 0; start < variants.length; start += 2) {
      calls.push(searchNumber(variants.slice(start, start + 2), "EQ"));
    }
    const exactResults = await Promise.allSettled(calls);
    const exact = exactResults.flatMap(item => item.status === "fulfilled" ? item.value.rows : []);
    const incomplete = exactResults.some(item => item.status === "rejected" || (item.status === "fulfilled" && item.value.total > item.value.rows.length));

    const distinct = new Map<string, Contact>();
    function appendMatches(rows: HubSpotContact[]) {
      for (const row of rows) {
        if (!isExactMatch(row, phone)) continue;
        const entry = present(row);
        if (entry) distinct.set(entry.id, entry);
      }
    }
    appendMatches(exact);

    if (!distinct.size || incomplete) {
      const digits = phone.replace(/\D/g, "");
      const suffix = digits.slice(-9);
      const fallbacks = await Promise.allSettled([
        searchNumber(["*" + suffix], "CONTAINS_TOKEN"),
        hubspotJson("/crm/objects/2026-03/contacts/search", {
          method: "POST",
          body: JSON.stringify({
            query: suffix,
            limit: 30,
            properties: ["firstname", "lastname", "email", "phone", "mobilephone", "company"],
          }),
        }) as Promise<HubSpotSearch>,
      ]);
      for (const fallback of fallbacks) {
        if (fallback.status !== "fulfilled") continue;
        const data = fallback.value;
        appendMatches("rows" in data && Array.isArray(data.rows) ? data.rows : ("results" in data && Array.isArray(data.results) ? data.results : []));
      }
      if (!exact.length && fallbacks.every(item => item.status === "rejected")) {
        throw new Error("HubSpot ne permet pas de rechercher le numéro. Vérifiez la connexion CRM et les autorisations de lecture des contacts.");
      }
    }
    const contacts = [...distinct.values()].slice(0, 8);
    // Never open a single contact automatically when HubSpot may have omitted
    // more records from a truncated or failed search.
    const result = contacts.length === 1 && !incomplete ? "match" : contacts.length ? "multiple" : "unknown";
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
