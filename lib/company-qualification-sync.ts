import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { hubspotJson } from "@/lib/hubspot";

const STATUS_TO_HUBSPOT: Record<string, Record<string, string>> = {
  "À travailler": { statut_prospection: "À travailler", hs_lead_status: "NEW" },
  "À contacter": { statut_prospection: "À contacter", hs_lead_status: "OPEN" },
  "Tentative": { statut_prospection: "Tentative", hs_lead_status: "ATTEMPTED_TO_CONTACT" },
  "Contact établi": { statut_prospection: "Contact établi", hs_lead_status: "CONNECTED" },
  "À relancer": { statut_prospection: "À relancer", hs_lead_status: "BAD_TIMING", statut_de_lappel: "a_rappeler" },
  "Ultérieur": { statut_prospection: "Ultérieur", hs_lead_status: "BAD_TIMING", statut_de_lappel: "a_une_date_ulterieure" },
  "Opportunité": { statut_prospection: "Opportunité", hs_lead_status: "OPEN_DEAL" },
  "Gagné": { statut_prospection: "Gagné", hs_lead_status: "OPEN_DEAL", lifecyclestage: "customer" },
  "Perdu": { statut_prospection: "Perdu", hs_lead_status: "UNQUALIFIED" },
};

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export async function syncCompanyContactLinks() {
  const supabase = getSupabaseAdmin();
  const [{ data: companies, error: companyError }, { data: contacts, error: contactError }] = await Promise.all([
    supabase.from("companies").select("id,hubspot_id"),
    supabase.from("contacts").select("id,hubspot_id"),
  ]);
  if (companyError) throw companyError;
  if (contactError) throw contactError;

  const companyByHubSpot = new Map((companies ?? []).map(row => [String(row.hubspot_id), String(row.id)]));
  const contactByHubSpot = new Map((contacts ?? []).map(row => [String(row.hubspot_id), String(row.id)]));
  const hubspotContactIds = [...contactByHubSpot.keys()];
  let relations = 0;

  for (const ids of chunk(hubspotContactIds, 100)) {
    const data = await hubspotJson("/crm/associations/2026-03/contacts/companies/batch/read", {
      method: "POST",
      body: JSON.stringify({ inputs: ids.map(id => ({ id })) }),
    });
    const rows: Array<Record<string, string>> = [];
    for (const association of data.results ?? []) {
      const hubspotContactId = String(association.from?.id || association.fromObjectId || "");
      const contactId = contactByHubSpot.get(hubspotContactId);
      if (!contactId) continue;
      for (const target of association.to ?? []) {
        const hubspotCompanyId = String(target.toObjectId || target.id || "");
        const companyId = companyByHubSpot.get(hubspotCompanyId);
        if (!companyId) continue;
        rows.push({
          company_id: companyId,
          contact_id: contactId,
          hubspot_company_id: hubspotCompanyId,
          hubspot_contact_id: hubspotContactId,
          synced_at: new Date().toISOString(),
        });
      }
    }
    if (rows.length) {
      const { error } = await supabase.from("company_contacts").upsert(rows, { onConflict: "company_id,contact_id" });
      if (error) throw error;
      relations += rows.length;
    }
  }

  return { contactsChecked: hubspotContactIds.length, relations };
}

export async function refreshCompanyQualifications() {
  const { data, error } = await getSupabaseAdmin().rpc("refresh_company_qualifications");
  if (error) throw error;
  return { refreshed: Number(data ?? 0) };
}

function desiredHubSpotProperties(row: any) {
  const base = STATUS_TO_HUBSPOT[String(row.qualification_status || "")] || null;
  if (!base) return null;
  const properties = { ...base };
  if (["À relancer", "Ultérieur"].includes(String(row.qualification_status)) && row.qualification_next_action_at) {
    properties.date_de_rappel = new Date(row.qualification_next_action_at).toISOString();
  }
  return properties;
}

function hasDiff(current: Record<string, unknown>, desired: Record<string, string>) {
  return Object.entries(desired).some(([key, value]) => String(current?.[key] ?? "") !== String(value ?? ""));
}

export async function pushCompanyQualificationsToHubSpot() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("companies")
    .select("hubspot_id,raw_data,qualification_status,qualification_next_action_at")
    .not("qualification_status", "is", null);
  if (error) throw error;

  const changes = (data ?? []).flatMap(row => {
    const desired = desiredHubSpotProperties(row);
    if (!desired) return [];
    const current = row.raw_data?.properties ?? {};
    if (!hasDiff(current, desired)) return [];
    return [{ id: String(row.hubspot_id), properties: desired }];
  });

  let updated = 0;
  for (const inputs of chunk(changes, 100)) {
    await hubspotJson("/crm/objects/2026-03/companies/batch/update", {
      method: "POST",
      body: JSON.stringify({ inputs }),
    });
    updated += inputs.length;
  }

  if (updated) {
    const fresh = await hubspotJson("/crm/objects/2026-03/companies/search", {
      method: "POST",
      body: JSON.stringify({ limit: 1, properties: ["statut_prospection"] }),
    }).catch(() => null);
    void fresh;
  }

  return { checked: data?.length ?? 0, toUpdate: changes.length, updated };
}
