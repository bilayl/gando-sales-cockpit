import { hubspotJson } from "@/lib/hubspot";
import { ensureCompanyProspectionOptions, ensureContactProspectionOptions } from "@/lib/hubspot/qualification-schema";

export type HubSpotRecord = {
  id: string;
  properties: Record<string, string | null | undefined>;
  associations?: Record<string, { results?: Array<{ id: string; type?: string }> }>;
  createdAt?: string;
  updatedAt?: string;
};

export const CONTACT_PROPERTIES = [
  "firstname", "lastname", "email", "phone", "mobilephone", "company", "jobtitle",
  "hubspot_owner_id", "statut_prospection", "resultat_prospection", "statut_de_lappel",
  "date_prochaine_relance", "date_recyclage", "minari_call_count", "referly_call_outcome",
  "referly_reason_to_reach_out", "notes_last_contacted", "hs_last_sales_activity_timestamp",
  "hs_object_source_label", "state", "city", "createdate",
];

const CALLBACK_STATUSES = new Set(["occupe", "a rappeler", "a une date ulterieure", "interesse mais"]);

function normalize(value?: string | null) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export function parseHubSpotDate(value?: string | null) {
  if (!value) return null;
  const raw = String(value).trim();
  const numeric = Number(raw);
  const milliseconds = raw.length >= 12 && Number.isFinite(numeric) ? numeric : Date.parse(raw);
  return Number.isFinite(milliseconds) ? new Date(milliseconds) : null;
}

function attemptCount(properties: HubSpotRecord["properties"]) {
  const count = Number.parseInt(String(properties.minari_call_count || "0"), 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export function outcomeNeedsReminder(outcome: string) {
  return CALLBACK_STATUSES.has(normalize(outcome));
}

type OutcomeMapping = {
  callStatus: string;
  prospectionStatus?: string;
  resultStatus?: string;
  recycle?: boolean;
};

const OUTCOME_MAP: Record<string, OutcomeMapping> = {
  "NRP": { callStatus: "NRP", prospectionStatus: "En prospection", resultStatus: "Sans réponse" },
  "Occupé": { callStatus: "Occupé", prospectionStatus: "En prospection", resultStatus: "À rappeler" },
  "À rappeler": { callStatus: "A Rappeler", prospectionStatus: "En prospection", resultStatus: "À rappeler" },
  "A Rappeler": { callStatus: "A Rappeler", prospectionStatus: "En prospection", resultStatus: "À rappeler" },
  "Intéressé": { callStatus: "Intéressé", prospectionStatus: "Conversation", resultStatus: "Conversation" },
  "RDV pris": { callStatus: "Intéressé", prospectionStatus: "RDV booké", resultStatus: "RDV obtenu" },
  "Pas intéressé": { callStatus: "pas intéressé", prospectionStatus: "Pas intéressé", resultStatus: "Pas intéressé" },
  "Hors cible": { callStatus: "HORS CIBLE", prospectionStatus: "Non qualifié", resultStatus: "" },
  "Numéro invalide": { callStatus: "Numéro invalide", prospectionStatus: "Non qualifié", resultStatus: "" },
  "A une date ultérieure": { callStatus: "A une date ultérieure", prospectionStatus: "À recycler", resultStatus: "", recycle: true },
  "Intéressé mais": { callStatus: "Intéressé mais", prospectionStatus: "Conversation", resultStatus: "À rappeler" },
};

const COMPANY_OUTCOME_MAP: Record<string, { callStatus: string; leadStatus?: string; prospectionStatus?: string }> = {
  "NRP": { callStatus: "nrp", leadStatus: "ATTEMPTED_TO_CONTACT", prospectionStatus: "Tentative" },
  "Occupé": { callStatus: "occupe", leadStatus: "BAD_TIMING", prospectionStatus: "À relancer" },
  "À rappeler": { callStatus: "a_rappeler", leadStatus: "BAD_TIMING", prospectionStatus: "À relancer" },
  "A Rappeler": { callStatus: "a_rappeler", leadStatus: "BAD_TIMING", prospectionStatus: "À relancer" },
  "Intéressé": { callStatus: "interesse", leadStatus: "CONNECTED", prospectionStatus: "Contact établi" },
  "RDV pris": { callStatus: "interesse", leadStatus: "OPEN_DEAL", prospectionStatus: "Opportunité" },
  "Pas intéressé": { callStatus: "pas_interesse", leadStatus: "UNQUALIFIED", prospectionStatus: "Pas intéressé" },
  "Hors cible": { callStatus: "hors_cible", leadStatus: "UNQUALIFIED", prospectionStatus: "Perdu" },
  "Numéro invalide": { callStatus: "numero_invalide", leadStatus: "UNQUALIFIED", prospectionStatus: "Perdu" },
  "A une date ultérieure": { callStatus: "a_une_date_ulterieure", leadStatus: "BAD_TIMING", prospectionStatus: "Ultérieur" },
  "Intéressé mais": { callStatus: "interesse_mais", leadStatus: "BAD_TIMING", prospectionStatus: "À relancer" },
};

export async function saveCallOutcome(contactId: string, outcome: string, reminderAt?: string) {
  const mapped = OUTCOME_MAP[outcome];
  if (!mapped) throw new Error("Résultat d’appel invalide");
  if (outcomeNeedsReminder(mapped.callStatus) && !reminderAt) throw new Error("Choisissez une date de rappel");

  const parsedReminder = reminderAt ? new Date(reminderAt) : null;
  if (parsedReminder && Number.isNaN(parsedReminder.getTime())) throw new Error("Date de rappel invalide");
  if (parsedReminder && parsedReminder.getTime() <= Date.now()) throw new Error("La date de rappel doit être dans le futur");

  const query = new URLSearchParams({
    properties: ["firstname", "lastname", "company", "hubspot_owner_id", "minari_call_count"].join(","),
    associations: "companies,deals",
  });
  const contact = await hubspotJson(`/crm/objects/2026-03/contacts/${encodeURIComponent(contactId)}?${query}`) as HubSpotRecord;
  const currentCount = attemptCount(contact.properties);
  const properties: Record<string, string> = {
    statut_de_lappel: mapped.callStatus,
    minari_call_count: String(currentCount + 1),
    statut_prospection: mapped.prospectionStatus || "En prospection",
    resultat_prospection: mapped.resultStatus ?? "",
    date_prochaine_relance: mapped.recycle ? "" : parsedReminder ? parsedReminder.toISOString() : "",
    date_recyclage: mapped.recycle && parsedReminder ? parsedReminder.toISOString() : "",
  };

  await ensureContactProspectionOptions();
  const updatedContact = await hubspotJson(`/crm/objects/2026-03/contacts/${encodeURIComponent(contactId)}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });

  let updatedCompany = null;
  const companyId = contact.associations?.companies?.results?.[0]?.id;
  const companyOutcome = COMPANY_OUTCOME_MAP[outcome];
  if (companyId && companyOutcome) {
    await ensureCompanyProspectionOptions();
    const companyProperties: Record<string, string> = {
      statut_de_lappel: companyOutcome.callStatus,
      date_de_rappel: parsedReminder ? parsedReminder.toISOString() : "",
    };
    if (companyOutcome.leadStatus) companyProperties.hs_lead_status = companyOutcome.leadStatus;
    if (companyOutcome.prospectionStatus) companyProperties.statut_prospection = companyOutcome.prospectionStatus;
    updatedCompany = await hubspotJson(`/crm/objects/2026-03/companies/${encodeURIComponent(companyId)}`, {
      method: "PATCH",
      body: JSON.stringify({ properties: companyProperties }),
    });
  }

  // WF01-WF04 remain the source of truth for tasks and recycling.
  return { contact: updatedContact, company: updatedCompany, task: null };
}
