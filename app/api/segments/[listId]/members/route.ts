import { NextRequest, NextResponse } from "next/server";
import { hubspotJsonWithServiceFallback } from "@/lib/hubspot-service-fallback";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const contactProps = ["firstname","lastname","email","phone","mobilephone","company","jobtitle","hubspot_owner_id","statut_prospection","resultat_prospection","statut_de_lappel","date_prochaine_relance","minari_call_count","referly_call_outcome","referly_reason_to_reach_out","state","city","country","zip","hs_last_sales_activity_timestamp","notes_last_contacted","hs_object_source_label","createdate"];

const companyProps = [
  "name","domain","phone","website","zip","city","state","country","industry","description","hubspot_owner_id",
  "num_associated_contacts","num_associated_deals","hs_lead_status","lifecyclestage","statut_de_lappel","date_de_rappel","statut_prospection",
  "notes_next_activity_date","notes_last_updated","hs_last_sales_activity_timestamp","hs_object_source_label","createdate",
];

const QUALIFICATION_COLUMNS = [
  "qualification_status","qualification_score","qualification_reason","qualification_last_activity_at","qualification_next_action_at",
  "qualification_contacts_count","qualification_open_tasks","qualification_overdue_tasks","qualification_deals_count",
  "qualification_last_call_status","qualification_source","prospecting_status",
];

function qualificationProperties(row: any) {
  const value = (input: unknown) => input === undefined || input === null ? undefined : String(input);
  return {
    qualification_status: value(row?.qualification_status || row?.prospecting_status),
    qualification_score: value(row?.qualification_score),
    qualification_reason: value(row?.qualification_reason),
    qualification_last_activity_at: value(row?.qualification_last_activity_at),
    qualification_next_action_at: value(row?.qualification_next_action_at),
    qualification_contacts_count: value(row?.qualification_contacts_count),
    qualification_open_tasks: value(row?.qualification_open_tasks),
    qualification_overdue_tasks: value(row?.qualification_overdue_tasks),
    qualification_deals_count: value(row?.qualification_deals_count),
    qualification_last_call_status: value(row?.qualification_last_call_status),
    qualification_source: value(row?.qualification_source),
  };
}

function freshProspectionStatus(properties: Record<string, unknown>) {
  const explicit = String(properties?.statut_prospection || "").trim();
  const genericExplicit = ["À travailler", "À contacter", "À prospecter", "En prospection", ""].includes(explicit);

  if (String(properties?.lifecyclestage || "").toLowerCase() === "customer") return "Gagné";
  if (!genericExplicit) return explicit;

  const leadStatus = String(properties?.hs_lead_status || "");
  if (leadStatus === "UNQUALIFIED") return "Perdu";
  if (leadStatus === "OPEN_DEAL") return "Opportunité";
  if (leadStatus === "CONNECTED") return "Contact établi";
  if (leadStatus === "ATTEMPTED_TO_CONTACT") return "Tentative";
  if (leadStatus === "BAD_TIMING") {
    return properties?.statut_de_lappel === "a_une_date_ulterieure" ? "Ultérieur" : "À relancer";
  }

  const callStatus = String(properties?.statut_de_lappel || "").toLowerCase().split(";").map(item => item.trim()).filter(Boolean).at(-1) || "";
  if (callStatus === "nrp") return "Tentative";
  if (["a_rappeler", "occupe", "interesse_mais", "en_attente_decision"].includes(callStatus)) return "À relancer";
  if (callStatus === "a_une_date_ulterieure") return "Ultérieur";
  if (callStatus === "interesse") return "Contact établi";
  if (callStatus === "pas_interesse") return "Pas intéressé";
  if (["hors_cible", "numero_invalide"].includes(callStatus)) return "Perdu";

  if (leadStatus === "OPEN" || leadStatus === "NEW") return "À contacter";
  return explicit || undefined;
}

type AssociatedContactPhone = {
  id: string;
  phone?: string;
  name?: string;
};

async function associatedContactPhones(companyIds: string[]) {
  const result = new Map<string, AssociatedContactPhone>();
  if (!companyIds.length) return result;

  try {
    const associations = await hubspotJsonWithServiceFallback(`/crm/v3/associations/companies/contacts/batch/read`, {
      method: "POST",
      body: JSON.stringify({ inputs: companyIds.map(id => ({ id })) }),
    });

    const companyToContacts = new Map<string, string[]>();
    const allContactIds = new Set<string>();
    for (const association of associations.results ?? []) {
      const companyId = String(association?.from?.id || association?.from?.objectId || association?.id || "");
      if (!companyId) continue;
      const targets = Array.isArray(association?.to) ? association.to : Array.isArray(association?.results) ? association.results : [];
      const ids = targets.map((target: any) => String(target?.id || target?.toObjectId || target?.objectId || "")).filter(Boolean);
      companyToContacts.set(companyId, ids);
      ids.forEach(id => allContactIds.add(id));
    }

    const contactIds = Array.from(allContactIds);
    if (!contactIds.length) return result;
    const contacts = await hubspotJsonWithServiceFallback(`/crm/objects/2026-03/contacts/batch/read`, {
      method: "POST",
      body: JSON.stringify({
        properties: ["firstname", "lastname", "email", "phone", "mobilephone"],
        inputs: contactIds.map(id => ({ id })),
      }),
    });
    const contactById = new Map((contacts.results ?? []).map((contact: any) => [String(contact.id), contact.properties ?? {}]));

    for (const [companyId, ids] of companyToContacts) {
      let fallback: AssociatedContactPhone | null = null;
      for (const contactId of ids) {
        const properties: any = contactById.get(contactId) || {};
        const phone = String(properties.phone || properties.mobilephone || "").trim();
        const name = [properties.firstname, properties.lastname].filter(Boolean).join(" ") || properties.email || undefined;
        const candidate = { id: contactId, phone: phone || undefined, name };
        if (!fallback) fallback = candidate;
        if (phone) { fallback = candidate; break; }
      }
      if (fallback) result.set(companyId, fallback);
    }
  } catch (error) {
    console.error("HubSpot associated contact phone batch:", error);
  }

  return result;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const url = new URL(request.url);
    const after = url.searchParams.get("after");
    const objectTypeId = url.searchParams.get("objectTypeId") === "0-2" ? "0-2" : "0-1";
    const objectPath = objectTypeId === "0-2" ? "companies" : "contacts";
    const props = objectTypeId === "0-2" ? companyProps : contactProps;
    const membershipPath = `/crm/lists/2026-03/${encodeURIComponent(listId)}/memberships?limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`;
    const memberships = await hubspotJsonWithServiceFallback(membershipPath);
    const ids = (memberships.results ?? []).map((r: { recordId: string }) => String(r.recordId));
    if (!ids.length) return NextResponse.json({ results: [], total: memberships.total ?? 0, paging: memberships.paging ?? null });

    const select = objectTypeId === "0-2" ? `hubspot_id,raw_data,${QUALIFICATION_COLUMNS.join(",")}` : "hubspot_id,raw_data";
    const { data, error } = await getSupabaseAdmin()
      .from(objectPath)
      .select(select)
      .in("hubspot_id", ids);
    if (error) throw error;
    const byId = new Map((data ?? []).map((row: any) => [String(row.hubspot_id), row]));

    const fresh = await hubspotJsonWithServiceFallback(`/crm/objects/2026-03/${objectPath}/batch/read`, {
      method: "POST",
      body: JSON.stringify({ properties: props, inputs: ids.map((id: string) => ({ id })) }),
    });
    const freshById = new Map((fresh.results ?? []).map((r: any) => [String(r.id), r.properties ?? {}]));
    const associatedPhones = objectTypeId === "0-2" ? await associatedContactPhones(ids) : new Map<string, AssociatedContactPhone>();

    if (objectTypeId === "0-2") {
      const results = ids.map((id: string) => {
        const local: any = byId.get(id);
        const freshProperties = (freshById.get(id) ?? {}) as Record<string, unknown>;
        const localQualification = qualificationProperties(local);
        const freshStatus = freshProspectionStatus(freshProperties);
        const associatedContact = associatedPhones.get(id);
        const companyPhone = String(freshProperties.phone || local?.raw_data?.properties?.phone || "").trim();
        const effectivePhone = companyPhone || associatedContact?.phone || "";
        return {
          id,
          properties: {
            ...(local?.raw_data?.properties ?? {}),
            ...localQualification,
            ...freshProperties,
            phone: effectivePhone || undefined,
            associated_contact_phone: associatedContact?.phone,
            associated_contact_name: associatedContact?.name,
            phone_source: companyPhone ? "company" : associatedContact?.phone ? "associated_contact" : undefined,
            qualification_status: freshStatus || localQualification.qualification_status,
            prospecting_status: freshStatus || localQualification.qualification_status,
            qualification_last_call_status: freshProperties.statut_de_lappel
              ? String(freshProperties.statut_de_lappel)
              : localQualification.qualification_last_call_status,
          },
        };
      });
      return NextResponse.json({ results, total: memberships.total ?? results.length, paging: memberships.paging ?? null });
    }

    const results = ids.map((id: string) => {
      const local: any = byId.get(id);
      return {
        id,
        properties: {
          ...(local?.raw_data?.properties ?? {}),
          ...(freshById.get(id) ?? {}),
        },
      };
    });

    return NextResponse.json({ results, total: memberships.total ?? results.length, paging: memberships.paging ?? null });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Erreur", details: e }, { status: e.status || 500 });
  }
}
