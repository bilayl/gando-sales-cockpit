import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { hubspotJson } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeWithAlloDialNumber } from "@/lib/withallo-phone";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

type Contact = { id: string; name: string; company: string | null; href: string };
type SyncedContact = {
  hubspot_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobilephone: string | null;
  company: string | null;
};
type HubSpotContact = {
  id?: string;
  properties?: Record<string, string | null | undefined>;
};
type HubSpotSearch = { results?: HubSpotContact[]; total?: number };

function isExactPhoneMatch(value: string | null | undefined, expected: string) {
  return normalizeWithAlloDialNumber(value) === expected;
}
function mapSynced(row: SyncedContact, expected: string): Contact | null {
  if (!/^\d+$/.test(String(row.hubspot_id || ""))) return null;
  if (![row.phone, row.mobilephone].some(number => isExactPhoneMatch(number, expected))) return null;
  return {
    id: String(row.hubspot_id),
    href: "/contacts/" + encodeURIComponent(row.hubspot_id),
    name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || row.email || "Contact CRM",
    company: row.company || null,
  };
}
function mapHubSpot(row: HubSpotContact, expected: string): Contact | null {
  if (!/^\d+$/.test(String(row.id || ""))) return null;
  const p = row.properties || {};
  if (![p.phone, p.mobilephone].some(number => isExactPhoneMatch(number, expected))) return null;
  const id = String(row.id);
  return {
    id,
    href: "/contacts/" + encodeURIComponent(id),
    name: [p.firstname, p.lastname].filter(Boolean).join(" ").trim() || p.email || "Contact HubSpot",
    company: p.company || null,
  };
}

async function lookupCockpit(phone: string): Promise<{ contacts: Contact[]; truncated: boolean }> {
  const suffix = phone.replace(/\D/g, "").slice(-9);
  if (!/^\d{9}$/.test(suffix)) return { contacts: [], truncated: false };
  // The same Supabase contacts table is the source of Gando's CRM directory.
  // Execute through a server-only service role, after Cockpit authentication.
  const { data, error } = await getSupabaseAdmin()
    .rpc("lookup_cockpit_contacts_by_phone_suffix", { p_suffix: suffix });
  if (error) throw new Error("Recherche dans le répertoire Gando indisponible : " + error.message);
  const rows = (Array.isArray(data) ? data : []) as SyncedContact[];
  const contacts = [...new Map(rows.map(row => mapSynced(row, phone)).filter((row): row is Contact => Boolean(row)).map(row => [row.id, row])).values()];
  return { contacts, truncated: rows.length >= 51 };
}

function candidateNumbers(e164: string) {
  const options = new Set<string>([e164, "00" + e164.slice(1)]);
  if (e164.startsWith("+33") && e164.length === 12) options.add("0" + e164.slice(3));
  for (const code of ["590", "594", "596", "262"]) {
    if (e164.startsWith("+" + code) && e164.length >= 12) options.add("0" + e164.slice(code.length + 1));
  }
  const local = [...options].find(value => /^0\d{9}$/.test(value));
  if (local) options.add(local.replace(/(\d{2})(?=\d)/g, "$1 ").trim());
  return [...options];
}

async function lookupHubSpot(phone: string): Promise<Contact[]> {
  const numbers = candidateNumbers(phone);
  const groups = numbers.flatMap(value => ["phone", "mobilephone"].map(propertyName => ({
    filters: [{ propertyName, operator: "EQ", value }],
  })));
  const exact = await Promise.allSettled([groups.slice(0, 5), groups.slice(5, 10)].filter(g => g.length).map(filterGroups =>
    hubspotJson("/crm/objects/2026-03/contacts/search", {
      method: "POST",
      body: JSON.stringify({ filterGroups, limit: 100, properties: ["firstname", "lastname", "email", "phone", "mobilephone", "company"] }),
    }) as Promise<HubSpotSearch>,
  ));
  const distinct = new Map<string, Contact>();
  for (const response of exact) {
    if (response.status !== "fulfilled") continue;
    for (const row of response.value.results || []) {
      const item = mapHubSpot(row, phone);
      if (item) distinct.set(item.id, item);
    }
  }
  if (distinct.size) return [...distinct.values()];
  // HubSpot may store the number with arbitrary separators; compare the full
  // E.164 value after finding candidates by suffix. A suffix alone is never
  // enough to associate an inbound call to a specific person.
  const query = phone.replace(/\D/g, "").slice(-9);
  const attempts = await Promise.allSettled([
    hubspotJson("/crm/objects/2026-03/contacts/search", {
      method: "POST",
      body: JSON.stringify({
        filterGroups: ["phone", "mobilephone"].map(propertyName => ({
          filters: [{ propertyName, operator: "CONTAINS_TOKEN", value: "*" + query }],
        })),
        limit: 100,
        properties: ["firstname", "lastname", "email", "phone", "mobilephone", "company"],
      }),
    }) as Promise<HubSpotSearch>,
  ]);
  for (const attempt of attempts) {
    if (attempt.status !== "fulfilled") continue;
    for (const row of attempt.value.results || []) {
      const item = mapHubSpot(row, phone);
      if (item) distinct.set(item.id, item);
    }
  }
  return [...distinct.values()];
}

export async function GET(request: NextRequest) {
  try {
    await requireCockpitAccess();
    const phone = normalizeWithAlloDialNumber(request.nextUrl.searchParams.get("phone"));
    if (!phone) return NextResponse.json({ error: "Numéro entrant non valide." }, { status: 400 });

    let source = "cockpit";
    let contacts: Contact[] = [];
    let truncated = false;
    let mirrorError = "";
    try {
      const synced = await lookupCockpit(phone);
      contacts = synced.contacts;
      truncated = synced.truncated;
    } catch (error) {
      mirrorError = error instanceof Error ? error.message : "Répertoire Cockpit indisponible.";
    }
    if (!contacts.length && !truncated) {
      source = "hubspot";
      try {
        contacts = await lookupHubSpot(phone);
      } catch (error) {
        if (mirrorError) throw new Error(mirrorError + " ; recherche HubSpot également indisponible.");
        throw error;
      }
    }
    // If the result set was truncated, do not assume a unique contact.
    const distinct = [...new Map(contacts.map(item => [item.id, item])).values()];
    const matches = distinct.slice(0, 20);
    const result = !truncated && distinct.length === 1 ? "match" : distinct.length ? "multiple" : "unknown";
    return NextResponse.json(
      {
        result,
        contacts: matches,
        phone,
        source,
        ...(truncated ? { message: "Plus de 50 contacts candidats : affinez les données CRM avant de permettre une ouverture automatique." } : {}),
      },
      { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
    );
  } catch (error) {
    const code = Number((error as { status?: number }).status || 502);
    const status = [400, 401, 403, 404, 429, 503].includes(code) ? code : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de trouver le contact entrant." },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
