import "server-only";

import { hubspotJson } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type ContactProperties = Record<string, string | null | undefined>;

type LocalContactRow = {
  id: string;
  hubspot_id?: string | null;
  raw_data?: any;
};

function syncMeta(rawData: any, status: "pending" | "synced", error?: string | null) {
  return {
    ...(rawData?.__cockpit_sync ?? {}),
    status,
    lastError: error || null,
    updatedAt: new Date().toISOString(),
  };
}

async function resolveHubSpotContact(properties: ContactProperties) {
  const email = String(properties.email || "").trim();
  if (email) {
    const found = await hubspotJson("/crm/objects/2026-03/contacts/search", {
      method: "POST",
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
        properties: ["firstname", "lastname", "email", "phone", "mobilephone", "jobtitle", "company", "city", "state", "hubspot_owner_id"],
        limit: 1,
      }),
    });
    const existing = found.results?.[0];
    if (existing?.id) {
      return hubspotJson(`/crm/objects/2026-03/contacts/${encodeURIComponent(String(existing.id))}`, {
        method: "PATCH",
        body: JSON.stringify({ properties }),
      });
    }
  }

  return hubspotJson("/crm/objects/2026-03/contacts", {
    method: "POST",
    body: JSON.stringify({ properties }),
  });
}

async function syncCompanyAssociations(contactId: string, companyIds: string[]) {
  for (const companyId of [...new Set(companyIds.filter(Boolean))]) {
    await hubspotJson(
      `/crm/objects/2026-03/contact/${encodeURIComponent(contactId)}/associations/default/company/${encodeURIComponent(companyId)}`,
      { method: "PUT" },
    );
  }
}

export async function pushLocalContactToHubSpot(localContactId: string) {
  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("contacts")
    .select("id,hubspot_id,raw_data")
    .eq("id", localContactId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Contact Cockpit introuvable");

  if (row.hubspot_id) {
    return {
      id: String(row.hubspot_id),
      local_id: String(row.id),
      properties: row.raw_data?.properties ?? {},
      sync_status: "synced" as const,
    };
  }

  const properties = (row.raw_data?.properties ?? {}) as ContactProperties;
  const companyIds = Array.isArray(row.raw_data?.__cockpit_sync?.pendingCompanyIds)
    ? row.raw_data.__cockpit_sync.pendingCompanyIds.map((value: unknown) => String(value)).filter(Boolean)
    : [];

  try {
    const contact = await resolveHubSpotContact(properties);
    const hubspotId = String(contact.id);
    if (companyIds.length) await syncCompanyAssociations(hubspotId, companyIds);

    const mergedProperties = { ...properties, ...(contact.properties ?? {}) };
    const rawData = {
      ...row.raw_data,
      ...contact,
      properties: mergedProperties,
      __cockpit_sync: {
        ...syncMeta(row.raw_data, "synced"),
        pendingCompanyIds: [],
      },
    };
    const { error: updateError } = await supabase.from("contacts").update({
      hubspot_id: hubspotId,
      raw_data: rawData,
      hubspot_updated_at: contact.updatedAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", localContactId);
    if (updateError) throw updateError;

    return {
      id: hubspotId,
      local_id: String(row.id),
      properties: mergedProperties,
      sync_status: "synced" as const,
    };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    await supabase.from("contacts").update({
      raw_data: {
        ...row.raw_data,
        properties,
        __cockpit_sync: {
          ...syncMeta(row.raw_data, "pending", message),
          pendingCompanyIds: companyIds,
        },
      },
      updated_at: new Date().toISOString(),
    }).eq("id", localContactId);
    throw cause;
  }
}

export async function syncPendingLocalContacts(limit = 100) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("contacts")
    .select("id")
    .is("hubspot_id", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  let pushed = 0;
  let failed = 0;
  for (const row of data ?? []) {
    try {
      await pushLocalContactToHubSpot(String(row.id));
      pushed += 1;
    } catch {
      failed += 1;
    }
  }

  return { resource: "contacts_outbox", pending: data?.length ?? 0, pushed, failed };
}
