import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { withAlloRequest, WithAlloError } from "@/lib/withallo";
import { normalizeWithAlloDialNumber } from "@/lib/withallo-phone";

type State = { resource: string; after_cursor: string | null; last_synced_at: string | null; status: string | null; last_error: string | null };
type Company = {
  id: string; hubspot_id: string; name: string | null; domain: string | null;
  website: string | null; hubspot_updated_at: string | null; raw_data: { properties?: Record<string, string | null> } | null;
};
type Contact = {
  hubspot_id: string; first_name: string | null; last_name: string | null;
  email: string | null; phone: string | null; job_title: string | null;
  company_id: string | null; hubspot_updated_at: string | null;
  raw_data: { properties?: Record<string, string | null> } | null;
};
type AlloCompany = { id: string; name: string; website?: string | null };
type AlloPerson = { id: string; name?: string | null; last_name?: string | null; numbers?: string[]; emails?: string[] };
type SearchResult<T> = { data?: T[]; has_more?: boolean; pagination?: { has_more?: boolean; total_count?: number } };
const CURRENT = "withallo:progress";

const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
const normalizedText = (value: unknown) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const same = (a: unknown, b: unknown) => normalizedText(a) === normalizedText(b);
const resourceFor = (type: "company" | "contact", id: string) => `withallo:${type}:${id}`;
const apiResponseData = (value: unknown) => {
  const object = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const nested = object.data && typeof object.data === "object" ? object.data as Record<string, unknown> : object;
  return typeof nested.id === "string" ? nested.id : null;
};
const phoneNumbers = (row: Contact) => [...new Set([
  row.phone,
  row.raw_data?.properties?.phone,
  row.raw_data?.properties?.mobilephone,
].map(normalizeWithAlloDialNumber).filter((phone): phone is string => Boolean(phone)))];
const safeWebsite = (value: unknown) => {
  const input = clean(value);
  if (!input) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    return ["https:", "http:"].includes(parsed.protocol) && parsed.hostname.includes(".") ? parsed.origin : null;
  } catch { return null; }
};

async function getState(resource: string): Promise<State | null> {
  const { data, error } = await getSupabaseAdmin().from("hubspot_sync_state")
    .select("resource,after_cursor,last_synced_at,status,last_error").eq("resource", resource).maybeSingle();
  if (error) throw error;
  return data as State | null;
}

async function saveState(resource: string, id: string | null, status: string, errorMessage: string | null = null) {
  const { error } = await getSupabaseAdmin().from("hubspot_sync_state").upsert({
    resource, after_cursor: id, status, last_error: errorMessage,
    last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, { onConflict: "resource" });
  if (error) throw error;
}

function sourceUnchanged(state: State | null, updated: string | null) {
  if (!state?.after_cursor || state.status !== "complete" || !state.last_synced_at) return false;
  return !updated || new Date(updated).getTime() <= new Date(state.last_synced_at).getTime();
}

async function requireCrmWrite() {
  const response = await withAlloRequest<{ scopes?: string[] }>("/v2/api/me");
  if (!response.scopes?.includes("CRM_WRITE")) {
    throw new WithAlloError("La clé Allo doit disposer de la permission CRM_WRITE pour synchroniser le CRM.", 403);
  }
}

function searchItems<T>(result: SearchResult<T>): T[] {
  if (!Array.isArray(result.data)) throw new WithAlloError("Réponse de recherche CRM Allo incorrecte.");
  if (result.has_more || result.pagination?.has_more) throw new WithAlloError("Correspondances Allo trop nombreuses, association automatique désactivée.", 409);
  return result.data;
}

async function findAlloCompany(row: Company): Promise<string | null> {
  const response = await withAlloRequest<SearchResult<AlloCompany>>("/v2/api/crm/companies/search", {
    method: "POST",
    body: JSON.stringify({ filters: { name: row.name }, size: 100, page: 1 }),
  });
  const exact = searchItems(response).filter(company => same(company.name, row.name));
  if (!exact.length) return null;
  const sourceWebsite = safeWebsite(row.website || row.domain);
  const sameSite = sourceWebsite
    ? exact.filter(company => safeWebsite(company.website) === sourceWebsite)
    : [];
  if (sameSite.length === 1) return sameSite[0].id;
  if (exact.length === 1 && (!sourceWebsite || !exact[0].website || safeWebsite(exact[0].website) === sourceWebsite)) return exact[0].id;
  throw new WithAlloError("Entreprise Allo ambiguë ou domaine différent : rapprochement manuel requis.", 409);
}

async function upsertCompany(row: Company): Promise<string | null> {
  if (!row.hubspot_id || !clean(row.name)) return null;
  const resource = resourceFor("company", row.hubspot_id);
  const state = await getState(resource);
  if (sourceUnchanged(state, row.hubspot_updated_at)) return state?.after_cursor ?? null;
  const body = {
    name: row.name!.trim(),
    ...(safeWebsite(row.website || row.domain) ? { website: safeWebsite(row.website || row.domain) } : {}),
    ...(clean(row.raw_data?.properties?.industry) ? { industry: clean(row.raw_data?.properties?.industry) } : {}),
  };
  try {
    let id = state?.after_cursor ?? null;
    if (id) {
      try {
        await withAlloRequest("/v2/api/crm/companies/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(body) });
      } catch (error) {
        if (!(error instanceof WithAlloError) || error.status !== 404) throw error;
        id = null;
      }
    }
    if (!id) {
      id = await findAlloCompany(row);
      if (id) {
        await withAlloRequest("/v2/api/crm/companies/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(body) });
      } else {
        id = apiResponseData(await withAlloRequest("/v2/api/crm/companies", { method: "POST", body: JSON.stringify(body) }));
      }
    }
    if (!id) throw new WithAlloError("Identifiant entreprise absent dans la réponse Allo.");
    await saveState(resource, id, "complete");
    return id;
  } catch (error) {
    await saveState(resource, state?.after_cursor || null, "error", error instanceof Error ? error.message.slice(0, 500) : "Erreur Allo");
    throw error;
  }
}

async function findAlloPerson(numbers: string[], row: Contact): Promise<string | null> {
  const matches = new Map<string, AlloPerson>();
  for (const number of numbers) {
    const response = await withAlloRequest<SearchResult<AlloPerson>>("/v2/api/crm/people/search", {
      method: "POST", body: JSON.stringify({ filters: { phone_number: number }, size: 100, page: 1 }),
    });
    for (const person of searchItems(response)) {
      if (person.numbers?.some(value => normalizeWithAlloDialNumber(value) === number)) matches.set(person.id, person);
    }
  }
  if (!matches.size) return null;
  if (matches.size > 1) throw new WithAlloError("Plusieurs fiches Allo correspondent à ce numéro : rapprochement manuel nécessaire.", 409);
  const person = [...matches.values()][0];
  const emailMatch = row.email && person.emails?.some(email => same(email, row.email));
  const fullNameMatch = Boolean(row.first_name && row.last_name && same(person.name, row.first_name) && same(person.last_name, row.last_name));
  if (!emailMatch && !fullNameMatch) {
    throw new WithAlloError("Un autre contact Allo utilise déjà ce numéro ; aucune fiche ne sera écrasée.", 409);
  }
  return person.id;
}

async function companyForContact(row: Contact) {
  if (!row.company_id) return null;
  const { data, error } = await getSupabaseAdmin().from("companies")
    .select("id,hubspot_id,name,domain,website,raw_data,hubspot_updated_at")
    .eq("id", row.company_id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return upsertCompany(data as Company);
}

async function upsertPerson(row: Contact): Promise<"created_or_updated" | "unchanged" | "skipped"> {
  if (!row.hubspot_id || !/^\d{1,25}$/.test(String(row.hubspot_id))) return "skipped";
  const numbers = phoneNumbers(row);
  // Allo requires at least one valid E.164 number. Never invent a phone or a country code.
  if (!numbers.length) return "skipped";
  const resource = resourceFor("contact", String(row.hubspot_id));
  const state = await getState(resource);
  if (sourceUnchanged(state, row.hubspot_updated_at)) return "unchanged";
  const companyId = await companyForContact(row);
  const properties = row.raw_data?.properties ?? {};
  const body = {
    ...(row.first_name ? { name: row.first_name.trim() } : {}),
    ...(row.last_name ? { last_name: row.last_name.trim() } : {}),
    ...(row.job_title ? { job_title: row.job_title.trim() } : {}),
    ...(row.email && row.email.includes("@") ? { emails: [row.email.trim().toLowerCase()] } : {}),
    ...(companyId ? { company_id: companyId } : {}),
  };
  try {
    let id = state?.after_cursor ?? null;
    if (id) {
      try {
        await withAlloRequest("/v2/api/crm/people/" + encodeURIComponent(id), {
          method: "PUT", body: JSON.stringify(body),
        });
      } catch (error) {
        if (!(error instanceof WithAlloError) || error.status !== 404) throw error;
        id = null;
      }
    }
    if (!id) {
      id = await findAlloPerson(numbers, row);
      if (id) {
        await withAlloRequest("/v2/api/crm/people/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(body) });
      } else {
        id = apiResponseData(await withAlloRequest("/v2/api/crm/people", {
          method: "POST",
          body: JSON.stringify({ ...body, numbers, allow_duplicate_number: false }),
        }));
      }
    }
    if (!id) throw new WithAlloError("Identifiant contact absent dans la réponse Allo.");
    await saveState(resource, id, "complete");
    return "created_or_updated";
  } catch (error) {
    await saveState(resource, state?.after_cursor || null, "error", error instanceof Error ? error.message.slice(0, 500) : "Erreur Allo");
    throw error;
  }
}

export async function syncOneCockpitContact(id: string) {
  if (!/^\d{1,25}$/.test(id)) throw new WithAlloError("Identifiant CRM invalide.", 400);
  await requireCrmWrite();
  const { data, error } = await getSupabaseAdmin().from("contacts")
    .select("hubspot_id,first_name,last_name,email,phone,job_title,company_id,raw_data,hubspot_updated_at")
    .eq("hubspot_id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new WithAlloError("Contact Cockpit introuvable.", 404);
  return upsertPerson(data as Contact);
}

export async function syncCockpitContactsToAllo(limit = 30) {
  await requireCrmWrite();
  const pageSize = Math.min(40, Math.max(1, Math.floor(limit)));
  const db = getSupabaseAdmin();
  const progress = await getState(CURRENT);
  const cursor = progress?.after_cursor || "company:0";
  const [kind, offsetString] = cursor.split(":");
  const stage = kind === "contact" ? "contact" : "company";
  const offset = Math.max(0, Number(offsetString) || 0);
  const table = stage === "company" ? "companies" : "contacts";
  const selection = stage === "company"
    ? "id,hubspot_id,name,domain,website,raw_data,hubspot_updated_at"
    : "hubspot_id,first_name,last_name,email,phone,job_title,company_id,raw_data,hubspot_updated_at";
  const { data, error } = await db.from(table).select(selection)
    .not("hubspot_id", "is", null).order("hubspot_id", { ascending: true }).range(offset, offset + pageSize - 1);
  if (error) throw error;

  let changed = 0, skipped = 0, failed = 0;
  for (const item of data || []) {
    try {
      if (stage === "company") {
        const value = await upsertCompany(item as unknown as Company);
        if (value) changed++;
        else skipped++;
      } else {
        const outcome = await upsertPerson(item as unknown as Contact);
        if (outcome === "created_or_updated") changed++;
        else skipped++;
      }
    } catch (error) {
      console.error("Allo CRM sync failed", stage, (item as { hubspot_id?: string }).hubspot_id, error);
      failed++;
    }
    // Respect the documented limit of five write requests per second.
    await new Promise(resolve => setTimeout(resolve, 260));
  }

  const endOfPage = (data || []).length < pageSize;
  const next = endOfPage ? (stage === "company" ? "contact:0" : "company:0") : `${stage}:${offset + pageSize}`;
  await saveState(CURRENT, next, failed ? "partial_error" : endOfPage && stage === "contact" ? "complete" : "in_progress",
    failed ? `${failed} fiches non synchronisées ; elles seront réessayées au prochain cycle.` : null);
  return { stage, cursor: next, processed: (data || []).length, changed, skipped, failed, cycleComplete: endOfPage && stage === "contact" };
}

export async function getWithAlloCrmSyncStatus() {
  const progress = await getState(CURRENT);
  const db = getSupabaseAdmin();
  const [{ count: contacts }, { count: companies }] = await Promise.all([
    db.from("hubspot_sync_state").select("resource", { count: "exact", head: true }).like("resource", "withallo:contact:%").eq("status", "complete"),
    db.from("hubspot_sync_state").select("resource", { count: "exact", head: true }).like("resource", "withallo:company:%").eq("status", "complete"),
  ]);
  return { configured: Boolean(process.env.WITHALLO_API_KEY?.trim()), enabled: process.env.WITHALLO_CRM_SYNC_ENABLED === "true",
    lastRunAt: progress?.last_synced_at ?? null, status: progress?.status ?? "not_started",
    lastError: progress?.last_error ?? null, cursor: progress?.after_cursor ?? null,
    contactsMapped: contacts ?? 0, companiesMapped: companies ?? 0 };
}
