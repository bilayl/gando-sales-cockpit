import "server-only";

import { hubspotJson } from "@/lib/hubspot";
import {
  type ClosingPlan,
  type ClosingPlanStatus,
  type DealDocument,
  type DealIntelligence,
  type DealMeeting,
  type DealMeetingsGroup,
  type DealRoomActionInput,
  type DealRoomCompany,
  type DealRoomContact,
  type DealRoomDeal,
  type DealRoomDetail,
  type DealRoomHealth,
  type DealRoomKPIs,
  type IntelligenceField,
  type NextStepItem,
  type Stakeholder,
  type StakeholderRole,
  type TimelineItem,
} from "@/lib/deal-room-types";
import { createTask } from "@/lib/hubspot/tasks";

const DEAL_DEFAULT_PROPERTIES = [
  "dealname", "dealstage", "pipeline", "amount", "closedate", "hubspot_owner_id",
  "hs_next_step", "hs_last_sales_activity_timestamp", "hs_is_closed_count",
  "hs_is_closed_won", "hs_date_entered_closedwon", "hs_lastmodifieddate", "createdate",
];

const DEAL_CUSTOM_WANTED = [
  "notes_last_updated", "notes_next_activity_date", "strategic_deal", "potential_arr",
  "potential_volume", "dr_blockers", "dr_champion_id", "dr_decisionmaker_id",
  "dr_closing_plan", "dr_doc_proposal", "dr_doc_contract", "dr_doc_deck",
  "dr_doc_pricing", "dr_doc_technical",
];

const CONTACT_PROPERTIES = [
  "firstname", "lastname", "email", "phone", "mobilephone", "company", "jobtitle",
  "hubspot_owner_id", "hs_last_sales_activity_timestamp", "createdate",
];

const COMPANY_PROPERTIES = [
  "name", "domain", "industry", "city", "hubspot_owner_id",
  "hs_last_sales_activity_timestamp",
];

const NOTE_PROPERTIES = ["hs_note_body", "hs_timestamp", "hs_createdate", "hs_lastmodifieddate"];
const CALL_PROPERTIES = [
  "hs_call_title", "hs_call_body", "hs_call_status", "hs_call_disposition",
  "hs_call_duration", "hs_timestamp", "hs_createdate", "hs_lastmodifieddate",
];
const EMAIL_PROPERTIES = [
  "hs_email_subject", "hs_email_text", "hs_timestamp", "hs_createdate", "hs_lastmodifieddate",
];
const MEETING_PROPERTIES = [
  "hs_meeting_title", "hs_meeting_start_time", "hs_meeting_end_time", "hs_meeting_outcome",
  "hs_meeting_body", "hs_internal_meeting_notes", "hs_meeting_location", "hubspot_owner_id",
  "hs_timestamp", "hs_createdate",
];
const TASK_PROPERTIES = [
  "hs_task_subject", "hs_task_body", "hs_timestamp", "hs_task_status",
  "hs_task_priority", "hs_task_type", "hubspot_owner_id", "hs_createdate",
];

const ASSOCIATION_TYPES = {
  dealToContact: 33,
  contactToDeal: 3,
  callToDeal: 203,
  callToContact: 196,
  callToCompany: 198,
  noteToDeal: 214,
  noteToContact: 202,
  noteToCompany: 207,
  meetingToDeal: 212,
  meetingToContact: 200,
  meetingToCompany: 188,
  taskToDeal: 216,
  taskToContact: 204,
  taskToCompany: 192,
} as const;

const STRATEGIC_MIN_AMOUNT = 20_000;
const STRATEGIC_MIN_ARR = 50_000;

const BLOCKER_CATEGORIES = [
  "Pricing", "Juridique", "Sécurité", "Technique", "API", "ERP", "Décision interne",
  "Budget", "Timing", "Concurrence", "Absence de champion", "Absence de décideur",
];

const CLOSING_PLAN_STEPS: Array<{ key: string; label: string; match: RegExp }> = [
  { key: "discovery", label: "Discovery", match: /discovery|découverte|qualification/i },
  { key: "validation_metier", label: "Validation métier", match: /métier|business case|cas d[’']usage/i },
  { key: "validation_technique", label: "Validation technique", match: /technique|intégration|api|erp|technic/i },
  { key: "demonstration", label: "Démonstration", match: /démo|demonstration|présentation|presentation/i },
  { key: "pilote", label: "Pilote", match: /pilote|poc|test/i },
  { key: "validation_pricing", label: "Validation pricing", match: /pricing|tarif|prix|budget/i },
  { key: "legal", label: "Legal", match: /legal|juridique|cgu|cookie|rgpd|confidentialité/i },
  { key: "security", label: "Sécurité", match: /security|sécurité|dpo/i },
  { key: "contract", label: "Contrat", match: /contrat|contract|signature/i },
  { key: "signature", label: "Signature", match: /signature|signer|bon de commande/i },
  { key: "deploiement", label: "Déploiement", match: /déploiement|deployment|go live|lancement/i },
];

const DOC_KINDS: Array<{ kind: string; match: RegExp }> = [
  { kind: "Contrat", match: /contrat|contract|signature/i },
  { kind: "Proposition", match: /proposition|proposal|offre|devis/i },
  { kind: "Deck", match: /deck|slides|présentation|presentation/i },
  { kind: "Documentation technique", match: /documentation|guide|manuel|wiki/i },
  { kind: "Pricing", match: /pricing|tarif|grille de prix|price list/i },
  { kind: "Compte rendu", match: /compte[- ]rendu|récap|synthèse du rdv/i },
  { kind: "Cahier des charges", match: /cahier des charges|spec|spécification/i },
  { kind: "Document juridique", match: /juridique|cgu|rgpd|nda|ncn|legal/i },
];

type HubSpotObject = {
  id: string;
  properties: Record<string, string | null | undefined>;
  createdAt?: string;
  updatedAt?: string;
};

type DealProperties = Record<string, string | null | undefined>;

let customPropertiesCache: string[] | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function chunks<T>(values: T[], size = 100) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toNumber(value?: string | null) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function trueFlag(value?: string | null) {
  return value === "true" || value === "1" || value === "oui" || value === "yes";
}

function latestDate(values: Array<string | null | undefined>) {
  return values
    .map(parseDate)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() || null;
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((from.getTime() - to.getTime()) / 86_400_000);
}

function fullName(label: string | null | undefined) {
  return label?.trim() || "Sans nom";
}

function sentenceFragments(value: string | null | undefined, max = 3, maxLength = 180) {
  if (!value) return [];
  const normalized = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const sentences = normalized.split(/(?<=[.!?])\s+/);
  return sentences
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 0)
    .slice(0, max)
    .map(sentence => (sentence.length > maxLength ? `${sentence.slice(0, maxLength)}…` : sentence));
}

function joinName(p: DealProperties) {
  return [p.firstname, p.lastname].filter(Boolean).join(" ");
}

async function readDealStageAndPipelines() {
  try {
    const data = await hubspotJson("/crm/v3/pipelines/deals");
    const stages = new Map<string, { label: string; probability: number | null; pipelineId: string; pipelineLabel: string }>();
    const pipelines = new Map<string, string>();
    for (const pipeline of (data.results || []) as Array<{ id: string; label: string; stages: Array<{ id: string; label: string; probability?: number }> }>) {
      pipelines.set(pipeline.id, pipeline.label);
      for (const stage of pipeline.stages || []) {
        stages.set(stage.id, {
          label: stage.label,
          probability: typeof stage.probability === "number" ? clamp(stage.probability, 0, 1) : null,
          pipelineId: pipeline.id,
          pipelineLabel: pipeline.label,
        });
      }
    }
    return { stages, pipelines };
  } catch {
    return { stages: new Map(), pipelines: new Map() };
  }
}

async function readOwners() {
  try {
    const data = await hubspotJson("/crm/owners/2026-03?limit=100&archived=false");
    return new Map<string, string>((data.results || []).map((owner: { id: string; firstName?: string; lastName?: string; email?: string }) => [
      String(owner.id),
      [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.email || String(owner.id),
    ]));
  } catch {
    return new Map<string, string>();
  }
}

async function readPortalId() {
  try {
    const data = await hubspotJson("/account-info/v3/details");
    return typeof data.portalId === "number" ? data.portalId : null;
  } catch {
    return null;
  }
}

async function readCustomDealProperties() {
  if (customPropertiesCache) return customPropertiesCache;
  try {
    const data = await hubspotJson("/crm/v3/properties/deals");
    const available = new Set((data.results || []).map((property: { name: string }) => property.name));
    customs = DEAL_CUSTOM_WANTED.filter(name => available.has(name));
    customPropertiesCache = [...customs];
    return [...customs];
  } catch {
    customPropertiesCache = [];
    return [];
  }
}

let customs: string[] = [];

function readyDealProperties() {
  const wanted = [...DEAL_DEFAULT_PROPERTIES, ...customs];
  return wanted.filter((name, index) => wanted.indexOf(name) === index);
}

function hasDealProperty(name: string) {
  return customPropertiesCache === null ? false : customPropertiesCache.includes(name);
}

function isStrategicProperties(p: DealProperties) {
  const amount = toNumber(p.amount) || 0;
  const arr = toNumber(p.potential_arr) || 0;
  return trueFlag(p.strategic_deal) || amount >= STRATEGIC_MIN_AMOUNT || arr >= STRATEGIC_MIN_ARR;
}

function strategicReason(p: DealProperties) {
  const reasons: string[] = [];
  if (trueFlag(p.strategic_deal)) reasons.push("marqué comme stratégique");
  if ((toNumber(p.amount) || 0) >= STRATEGIC_MIN_AMOUNT) reasons.push(`montant ≥ ${STRATEGIC_MIN_AMOUNT.toLocaleString("fr-FR")} €`);
  if ((toNumber(p.potential_arr) || 0) >= STRATEGIC_MIN_ARR) reasons.push("potentiel annuel élevé");
  return reasons.join(" · ") || "non stratégique";
}

async function searchAllDeals(properties: string[]) {
  const rows: HubSpotObject[] = [];
  let after: string | undefined;
  do {
    const body: Record<string, unknown> = {
      limit: 100,
      properties,
      sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
    };
    if (after) body.after = after;
    const data = await hubspotJson("/crm/objects/2026-03/deals/search", { method: "POST", body: JSON.stringify(body) });
    rows.push(...((data.results || []) as HubSpotObject[]));
    after = data.paging?.next?.after ? String(data.paging.next.after) : undefined;
  } while (after && rows.length < 2_000);
  return rows;
}

async function searchClosedMonth(properties: string[], won: boolean, start: string, end: string) {
  try {
    const data = await hubspotJson("/crm/objects/2026-03/deals/search", {
      method: "POST",
      body: JSON.stringify({
        limit: 1_000,
        properties,
        filterGroups: [{
          filters: [
            { propertyName: "hs_is_closed_won", operator: "EQ", value: won ? "true" : "false" },
            { propertyName: "closedate", operator: "GTE", value: start },
            { propertyName: "closedate", operator: "LTE", value: end },
          ],
        }],
      }),
    });
    return (data.results || []) as HubSpotObject[];
  } catch {
    return [];
  }
}

async function batchAssociations(ids: string[], toType: "contacts" | "companies" | "tasks" | "meetings" | "notes" | "calls" | "emails") {
  const result = new Map<string, string[]>();
  await Promise.all(chunks(unique(ids)).map(async inputIds => {
    try {
      const data = await hubspotJson(`/crm/associations/2026-03/deals/${toType}/batch/read`, {
        method: "POST",
        body: JSON.stringify({ inputs: inputIds.map(id => ({ id })) }),
      });
      for (const row of data.results || []) {
        const fromId = String(row.from?.id || row.fromObjectId || "");
        const targetIds = (row.to || [])
          .map((target: { id?: string; toObjectId?: string }) => String(target.toObjectId || target.id || ""))
          .filter(Boolean);
        if (fromId) result.set(fromId, targetIds);
      }
    } catch {
      // Famille d'association indisponible : on continue sans elle.
    }
  }));
  return result;
}

async function batchRead(type: "contacts" | "companies" | "tasks" | "meetings" | "notes" | "calls" | "emails", ids: string[]) {
  const result = new Map<string, HubSpotObject>();
  const properties = type === "contacts" ? CONTACT_PROPERTIES
    : type === "companies" ? COMPANY_PROPERTIES
    : type === "tasks" ? TASK_PROPERTIES
    : type === "meetings" ? MEETING_PROPERTIES
    : type === "notes" ? NOTE_PROPERTIES
    : type === "calls" ? CALL_PROPERTIES
    : EMAIL_PROPERTIES;
  await Promise.all(chunks(unique(ids)).map(async inputIds => {
    if (!inputIds.length) return;
    try {
      const data = await hubspotJson(`/crm/objects/2026-03/${type}/batch/read`, {
        method: "POST",
        body: JSON.stringify({ properties, inputs: inputIds.map(id => ({ id })) }),
      });
      for (const row of data.results || []) result.set(String(row.id), row as HubSpotObject);
    } catch {
      // Enregistrements associés manquants : ne doit pas masquer le deal.
    }
  }));
  return result;
}

export type DealEnrichment = {
  deal: HubSpotObject;
  companies: HubSpotObject[];
  contacts: HubSpotObject[];
  tasks: HubSpotObject[];
  meetings: HubSpotObject[];
  notes: HubSpotObject[];
  calls: HubSpotObject[];
  emails: HubSpotObject[];
  dealMeetings: Map<string, string[]>;
  dealContacts: Map<string, string[]>;
  dealCompanies: Map<string, string[]>;
  dealTasks: Map<string, string[]>;
  dealNotes: Map<string, string[]>;
  dealCalls: Map<string, string[]>;
  dealEmails: Map<string, string[]>;
  owners: Map<string, string>;
  stages: Map<string, { label: string; probability: number | null }>;
  stagesWithPipeline: Map<string, { label: string; probability: number | null; pipelineId: string; pipelineLabel: string }>;
  portalId: number | null;
  availableProperties: string[];
};

async function enrichDeal(deal: HubSpotObject, owners: Map<string, string>, enriched: { stages: Map<string, { label: string; probability: number | null; pipelineId: string; pipelineLabel: string }>; portalId: number | null }) {
  const dealId = String(deal.id);
  const [companies, contacts, tasks, meetings, notes, calls, emails] = await Promise.all([
    batchAssociations([dealId], "companies"),
    batchAssociations([dealId], "contacts"),
    batchAssociations([dealId], "tasks"),
    batchAssociations([dealId], "meetings"),
    batchAssociations([dealId], "notes"),
    batchAssociations([dealId], "calls"),
    batchAssociations([dealId], "emails"),
  ]);
  const companyIds = [...new Set([...companies.values()].flat())];
  const contactIds = [...new Set([...contacts.values()].flat())];
  const taskIds = [...new Set([...tasks.values()].flat())];
  const meetingIds = [...new Set([...meetings.values()].flat())];
  const noteIds = [...new Set([...notes.values()].flat())];
  const callIds = [...new Set([...calls.values()].flat())];
  const emailIds = [...new Set([...emails.values()].flat())];
  const [companyRows, contactRows, taskRows, meetingRows, noteRows, callRows, emailRows] = await Promise.all([
    batchRead("companies", companyIds),
    batchRead("contacts", contactIds),
    batchRead("tasks", taskIds),
    batchRead("meetings", meetingIds),
    batchRead("notes", noteIds),
    batchRead("calls", callIds),
    batchRead("emails", emailIds),
  ]);

  const properties = deal.properties || {};
  const companyId = (companies.get(dealId) || [])[0] || (properties.associatedcompanyid ? String(properties.associatedcompanyid) : "");
  const company = companyId ? companyRows.get(companyId) || null : null;
  const dealContacts = (contacts.get(dealId) || []).map(id => contactRows.get(id)).filter(Boolean) as HubSpotObject[];
  const dealCompanies = company ? [company] : [];
  const dealMeetings = (meetings.get(dealId) || []).map(id => meetingRows.get(id)).filter(Boolean) as HubSpotObject[];
  const dealTasks = (tasks.get(dealId) || []).map(id => taskRows.get(id)).filter(Boolean) as HubSpotObject[];
  const dealNotes = (notes.get(dealId) || []).map(id => noteRows.get(id)).filter(Boolean) as HubSpotObject[];
  const dealCalls = (calls.get(dealId) || []).map(id => callRows.get(id)).filter(Boolean) as HubSpotObject[];
  const dealEmails = (emails.get(dealId) || []).map(id => emailRows.get(id)).filter(Boolean) as HubSpotObject[];

  return {
    deal,
    companies: dealCompanies,
    contacts: dealContacts,
    tasks: dealTasks,
    meetings: dealMeetings,
    notes: dealNotes,
    calls: dealCalls,
    emails: dealEmails,
    dealMeetings: new Map([[dealId, dealMeetings.map(m => m.id)]]),
    dealContacts: new Map([[dealId, dealContacts.map(c => c.id)]]),
    dealCompanies: new Map([[dealId, dealCompanies.map(c => c.id)]]),
    dealTasks: new Map([[dealId, dealTasks.map(t => t.id)]]),
    dealNotes: new Map([[dealId, dealNotes.map(n => n.id)]]),
    dealCalls: new Map([[dealId, dealCalls.map(c => c.id)]]),
    dealEmails: new Map([[dealId, dealEmails.map(e => e.id)]]),
    owners,
    stages: new Map([...enriched.stages].map(([key, value]) => [key, { label: value.label, probability: value.probability }])),
    stagesWithPipeline: enriched.stages,
    portalId: enriched.portalId,
    availableProperties: readyDealProperties(),
  } satisfies DealEnrichment;
}

function contactInfluence(jobtitle: string | null, roles: StakeholderRole[]) {
  const title = (jobtitle || "").toLowerCase();
  if (roles.includes("Decision Maker") || roles.includes("Economic Buyer") || roles.includes("Champion")) return "strong" as const;
  if (/ceo|founder|fondateur|dirigeant|président|president|directeur|dg\b|gérant|patron|propriétaire|managing/i.test(title)) return "strong" as const;
  if (roles.length > 0) return "medium" as const;
  return "low" as const;
}

export function inferStakeholderRoles(jobtitle: string | null): StakeholderRole[] {
  const title = (jobtitle || "").toLowerCase();
  const roles: StakeholderRole[] = [];
  if (/champion|sponsor|parrain|ambassadeur/i.test(title)) roles.push("Champion");
  if (/ceo|chief executive|founder|fondateur|président|president|directeur général|managing director|dirigeant|\bdg\b|propriétaire|gérant|patron/i.test(title)) roles.push("Decision Maker");
  if (/finance|achat|purchasing|procurement|budget|controller|financier|acheteur/i.test(title)) roles.push("Economic Buyer");
  if (/cto|technique|\btech\b|\bit\b|developer|développeur|ingénieur|ingenieur|informatique|data|product|produit|architecte|admin/i.test(title)) roles.push("Technical");
  if (/legal|juridique|\bdpo\b|rgpd|counsel|avocat|juriste/i.test(title)) roles.push("Legal");
  if (/opérations|ops|exploitation|parc|location|réseau|agence|déploiement/i.test(title)) roles.push("Operational");
  return [...new Set(roles)];
}

function applyManualRoles(contact: DealRoomContact, championId: string | null, decisionMakerId: string | null) {
  const roles = inferStakeholderRoles(contact.jobtitle);
  if (contact.id === championId && !roles.includes("Champion")) roles.push("Champion");
  if (contact.id === decisionMakerId && !roles.includes("Decision Maker")) roles.push("Decision Maker");
  return roles;
}

function contactLastActivity(contact: HubSpotObject, dealNotes: HubSpotObject[], dealCalls: HubSpotObject[], dealMeetings: HubSpotObject[], dealTasks: HubSpotObject[]) {
  return latestDate([
    contact.properties?.hs_last_sales_activity_timestamp,
    ...dealNotes.map(note => latestDate([note.properties?.hs_timestamp, note.properties?.hs_createdate])),
    ...dealCalls.map(call => latestDate([call.properties?.hs_timestamp, call.properties?.hs_createdate])),
    ...dealMeetings.map(meeting => latestDate([meeting.properties?.hs_meeting_start_time, meeting.properties?.hs_createdate])),
    ...dealTasks.map(task => latestDate([task.properties?.hs_timestamp, task.properties?.hs_createdate])),
  ]);
}

function dealLastActivity(properties: DealProperties, company: HubSpotObject | null, notes: HubSpotObject[], calls: HubSpotObject[], meetings: HubSpotObject[], tasks: HubSpotObject[]) {
  return latestDate([
    properties.hs_last_sales_activity_timestamp,
    properties.notes_last_updated,
    company?.properties?.hs_last_sales_activity_timestamp,
    company?.properties?.notes_last_updated,
    ...notes.map(note => latestDate([note.properties?.hs_timestamp, note.properties?.hs_createdate])),
    ...calls.map(call => latestDate([call.properties?.hs_timestamp, call.properties?.hs_createdate])),
    ...meetings.map(meeting => latestDate([meeting.properties?.hs_meeting_start_time, meeting.properties?.hs_createdate])),
    ...tasks.map(task => latestDate([task.properties?.hs_timestamp, task.properties?.hs_createdate])),
  ]);
}

function logScore(value: number | null, min: number, max: number, cap: number) {
  if (!value || value <= 0) return 0;
  if (value >= max) return cap;
  if (value <= min) return round(cap * 0.25);
  const fraction = (Math.log(value) - Math.log(min)) / (Math.log(max) - Math.log(min));
  return round(cap * clamp(fraction, 0.15, 1));
}

function economicScore(p: DealProperties) {
  return Math.round(clamp(
    logScore(toNumber(p.amount), 5_000, 250_000, 12)
    + logScore(toNumber(p.potential_arr), 10_000, 150_000, 9)
    + logScore(toNumber(p.potential_volume), 50, 5_000, 4),
    0, 25,
  ));
}

function strategicScore(p: DealProperties, company: HubSpotObject | null, stageProbability: number | null) {
  let score = 0;
  if (trueFlag(p.strategic_deal)) score += 8;
  else if (isStrategicProperties(p)) score += 5;
  const industry = (company?.properties?.industry || "").toLowerCase();
  if (/location|immobilier|assurance|courtier|banque|réseau|agence|franchise|auto/i.test(industry)) score += 4;
  if (company?.properties?.name && company?.properties?.domain) score += 3;
  if ((toNumber(p.potential_arr) || 0) >= 100_000 || (toNumber(p.potential_volume) || 0) >= 5_000) score += 4;
  if (stageProbability !== null) score += Math.min(6, round(stageProbability * 10));
  const created = parseDate(p.createdate);
  if (created && daysBetween(new Date(), created) >= 90) score += 2;
  return Math.min(25, score);
}

function momentumScore(p: DealProperties, env: { lastActivityAt: string | null; meetingPlanned: boolean; nextTaskDueAt: string | null; recentlyCompletedMeeting: boolean }) {
  let score = 0;
  const last = env.lastActivityAt ? parseDate(env.lastActivityAt) : null;
  if (last) {
    const days = daysBetween(new Date(), last);
    if (days <= 2) score += 10;
    else if (days <= 7) score += 8;
    else if (days <= 14) score += 6;
    else if (days <= 30) score += 3;
  }
  if (p.hs_next_step?.trim()) score += 5;
  if (env.meetingPlanned) score += 4;
  if (env.recentlyCompletedMeeting) score += 3;
  if (env.nextTaskDueAt) {
    const due = parseDate(env.nextTaskDueAt);
    if (due && daysBetween(due, new Date()) <= 7) score += 3;
  }
  return Math.min(25, score);
}

function healthScore(p: DealProperties, env: { daysInactive: number | null; hasNextStep: boolean; hasOpenTask: boolean; decisionMakerIdentified: boolean; blockers: string[]; closeDateOverdue: boolean; hasAnyPlan: boolean; recentNoShowOrCancelled: boolean }) {
  let penalty = 0;
  if (env.daysInactive !== null && env.daysInactive > 30) penalty += 8;
  else if (env.daysInactive !== null && env.daysInactive > 14) penalty += 5;
  else if (env.daysInactive !== null && env.daysInactive > 7) penalty += 3;
  if (!env.hasNextStep && !env.hasOpenTask) penalty += 6;
  if (!env.decisionMakerIdentified) penalty += 4;
  penalty += Math.min(6, env.blockers.length * 3);
  if (env.closeDateOverdue) penalty += 5;
  if (!env.hasAnyPlan) penalty += 4;
  if (env.recentNoShowOrCancelled) penalty += 3;
  return Math.round(clamp(25 - penalty, 0, 25));
}

function healthFromScore(score: number): { health: DealRoomHealth; reason: string } {
  if (score >= 66) return { health: "on_track", reason: "Le deal avance : activité récente et prochaines étapes claires." };
  if (score >= 45) return { health: "attention", reason: "Des signaux de vigilance existent : relancer rapidement." };
  return { health: "at_risk", reason: "Le deal présente des risques importants : à traiter en priorité." };
}

export type ScoreReason = { text: string; tone: "good" | "warn" | "bad" | "neutral" };

function buildReasons(input: {
  amount: number | null; potentialArr: number | null; potentialVolume: number | null;
  strategic: boolean; strategicReason: string; daysInactive: number | null;
  meetingPlanned: boolean; nextTaskDueAt: string | null; hsNextStep: string | null | undefined;
  decisionMakerIdentified: boolean; championIdentified: boolean;
  blockers: string[]; closeDateOverdue: boolean; recentNoShowOrCancelled: boolean;
}): ScoreReason[] {
  const reasons: ScoreReason[] = [];
  if (input.amount) reasons.push({ text: `€${input.amount.toLocaleString("fr-FR")}`, tone: "good" });
  if (input.potentialArr) reasons.push({ text: `ARR €${input.potentialArr.toLocaleString("fr-FR")}`, tone: "good" });
  if (input.potentialVolume) reasons.push({ text: `Volume ${input.potentialVolume.toLocaleString("fr-FR")}`, tone: "neutral" });
  if (input.strategic) reasons.push({ text: "Stratégique", tone: "good" });
  if (input.meetingPlanned) reasons.push({ text: "RDV planifié", tone: "good" });
  if (input.nextTaskDueAt) reasons.push({ text: `Action ${input.nextTaskDueAt.slice(0, 10)}`, tone: "good" });
  else if (!input.hsNextStep) reasons.push({ text: "Sans prochaine action", tone: "bad" });
  if (input.daysInactive !== null && input.daysInactive > 7) reasons.push({ text: `Inactif ${input.daysInactive} j`, tone: "bad" });
  if (input.decisionMakerIdentified) reasons.push({ text: "Décideur identifié", tone: "good" });
  else reasons.push({ text: "Décideur ?", tone: "warn" });
  if (input.championIdentified) reasons.push({ text: "Champion identifié", tone: "good" });
  for (const blocker of input.blockers.slice(0, 2)) reasons.push({ text: `Blocage ${blocker}`, tone: "bad" });
  if (input.closeDateOverdue) reasons.push({ text: "Close date dépassée", tone: "bad" });
  if (input.recentNoShowOrCancelled) reasons.push({ text: "No-show récent", tone: "warn" });
  return reasons;
}

function priorityExplanation(input: { economic: number; strategic: number; momentum: number; health: number; blockers: string[]; decisionMakerIdentified: boolean; daysInactive: number | null; strategicReason: string; nextTaskSubject: string | null }) {
  const parts: string[] = [];
  if (input.economic >= 15) parts.push("forte valeur économique");
  if (input.strategic >= 15) parts.push(`valeur stratégique (${input.strategicReason})`);
  if (input.momentum >= 15) parts.push("bonne dynamique commerciale");
  if (input.momentum < 8) parts.push("dynamique commerciale faible");
  if (input.health < 12) parts.push("risque élevé");
  else if (input.health < 18) parts.push("quelques points de vigilance");
  if (!input.decisionMakerIdentified) parts.push("décideur à identifier");
  if (input.daysInactive !== null && input.daysInactive > 7) parts.push(`inactif depuis ${input.daysInactive} jours`);
  if (input.blockers.length) parts.push(`blocage(s) : ${input.blockers.slice(0, 2).join(", ")}`);
  if (input.nextTaskSubject) parts.push(`à faire : « ${input.nextTaskSubject} »`);
  if (!parts.length) return "Pas encore assez de données HubSpot pour prioriser ce deal.";
  return parts.join(" ⸱ ");
}

function buildDealRoomDeal(enrich: DealEnrichment, available: { stageLabels: Map<string, { label: string; probability: number | null }>; ownerNames: Map<string, string>; portalId: number | null }) {
  const { deal } = enrich;
  const p = deal.properties || {};
  const company = enrich.companies[0] || null;
  const companyRecord: DealRoomCompany | null = company ? {
    id: String(company.id),
    name: fullName(company.properties?.name),
    domain: company.properties?.domain?.trim() || null,
    industry: company.properties?.industry?.trim() || null,
    city: company.properties?.city?.trim() || null,
  } : null;

  const contacts: DealRoomContact[] = enrich.contacts.map(contact => {
    const cp = contact.properties || {};
    return {
      id: String(contact.id),
      name: joinName(cp) || cp.email || "Contact sans nom",
      jobtitle: cp.jobtitle?.trim() || null,
      email: cp.email?.trim() || null,
      phone: cp.mobilephone?.trim() || cp.phone?.trim() || null,
      company: cp.company?.trim() || null,
      lastActivityAt: contactLastActivity(contact, enrich.notes, enrich.calls, enrich.meetings, enrich.tasks),
    };
  });

  const championId = p.dr_champion_id?.trim() || null;
  const decisionMakerId = p.dr_decisionmaker_id?.trim() || null;
  const championContact = contacts.find(contact => contact.id === championId) || null;
  const decisionMakerContact = contacts.find(contact => contact.id === decisionMakerId) || contacts.find(contact => inferStakeholderRoles(contact.jobtitle).includes("Decision Maker")) || null;
  const championByTitle = contacts.find(contact => inferStakeholderRoles(contact.jobtitle).includes("Champion"));

  const stageId = p.dealstage || null;
  const stageInfo = (stageId && available.stageLabels.get(stageId)) || null;
  const closedWon = trueFlag(p.hs_is_closed_won);
  const closed = closedWon || trueFlag(p.hs_is_closed_count);
  const lastActivityAt = dealLastActivity(p, company, enrich.notes, enrich.calls, enrich.meetings, enrich.tasks);
  const daysInactive = lastActivityAt ? Math.max(0, daysBetween(new Date(), new Date(lastActivityAt))) : null;

  const nowDate = new Date();
  const plannedMeetings = enrich.meetings
    .filter(meeting => {
      const outcome = (meeting.properties?.hs_meeting_outcome || "").toUpperCase();
      const start = parseDate(meeting.properties?.hs_meeting_start_time || meeting.properties?.hs_timestamp);
      return (!outcome || outcome === "SCHEDULED" || outcome === "UNREVIEWED") && start !== null && start.getTime() > nowDate.getTime();
    })
    .sort((a, b) => (parseDate(a.properties?.hs_meeting_start_time)?.getTime() || 0) - (parseDate(b.properties?.hs_meeting_start_time)?.getTime() || 0));
  const nextMeetingAt = plannedMeetings[0]?.properties.hs_meeting_start_time || plannedMeetings[0]?.properties.hs_timestamp || null;

  const openTasks = enrich.tasks
    .filter(task => !["COMPLETED", "DEFERRED"].includes((task.properties?.hs_task_status || "").toUpperCase()))
    .sort((a, b) => (parseDate(a.properties?.hs_timestamp)?.getTime() || 0) - (parseDate(b.properties?.hs_timestamp)?.getTime() || 0));
  const nextTask = openTasks[0] || null;

  const recentlyCompletedMeeting = enrich.meetings.some(meeting => {
    const outcome = (meeting.properties?.hs_meeting_outcome || "").toUpperCase();
    const start = parseDate(meeting.properties?.hs_meeting_start_time || meeting.properties?.hs_timestamp);
    return outcome === "COMPLETED" && start !== null && daysBetween(nowDate, start) <= 14;
  });

  const storedBlockers = hasDealProperty("dr_blockers")
    ? (p.dr_blockers || "").split(/[;,]/).map(value => value.trim()).filter(Boolean)
    : [];
  const detectedBlockers: string[] = [];
  if (daysInactive !== null && daysInactive > 14) detectedBlockers.push("Aucune activité récente");
  if (!p.hs_next_step?.trim() && !openTasks.length && !nextMeetingAt) detectedBlockers.push("Pas de prochaine étape");
  if (p.closedate && !closed && parseDate(p.closedate) !== null && parseDate(p.closedate)!.getTime() < nowDate.getTime()) detectedBlockers.push("Close date dépassée");
  if (!decisionMakerContact) detectedBlockers.push("Pas de décideur identifié");
  const recentNoShow = enrich.meetings.some(meeting => {
    const outcome = (meeting.properties?.hs_meeting_outcome || "").toUpperCase();
    const start = parseDate(meeting.properties?.hs_meeting_start_time || meeting.properties?.hs_timestamp);
    return ["NO_SHOW", "CANCELED"].includes(outcome) && start !== null && daysBetween(nowDate, start) <= 30;
  });
  if (recentNoShow) detectedBlockers.push("No-show / RDV annulé récent");
  const blockers = [...new Set([...storedBlockers, ...detectedBlockers])];

  const amount = toNumber(p.amount);
  const closeDateOverdue = Boolean(p.closedate && !closed && parseDate(p.closedate) !== null && parseDate(p.closedate)!.getTime() < nowDate.getTime());
  const hasNextStep = Boolean(p.hs_next_step?.trim());
  const hasOpenTask = openTasks.length > 0;
  const hasAnyPlan = hasNextStep || hasOpenTask || plannedMeetings.length > 0 || Boolean(p.notes_next_activity_date);

  const economic = economicScore(p);
  const strategic = strategicScore(p, company, stageInfo?.probability ?? null);
  const momentum = momentumScore(p, {
    lastActivityAt, meetingPlanned: plannedMeetings.length > 0,
    nextTaskDueAt: nextTask?.properties.hs_timestamp || null, recentlyCompletedMeeting,
  });
  const health = healthScore(p, {
    daysInactive, hasNextStep, hasOpenTask,
    decisionMakerIdentified: Boolean(decisionMakerContact), blockers, closeDateOverdue, hasAnyPlan,
    recentNoShowOrCancelled: recentNoShow,
  });
  const score = Math.round(clamp((momentum + health) * 2, 0, 100));
  const { health: healthStatus, reason: healthReason } = healthFromScore(score);
  const priorityScore = Math.round(clamp((economic + strategic + momentum) * (4 / 3), 0, 100));
  const nextTaskDueAt = nextTask?.properties.hs_timestamp || null;
  const nextTaskSubject = nextTask?.properties.hs_task_subject || null;

  const strategicFlag = isStrategicProperties(p);

  return {
    id: String(deal.id),
    name: fullName(p.dealname),
    amount,
    currency: "EUR",
    closeDate: p.closedate || null,
    createdDate: p.createdate || null,
    stageId,
    stageLabel: stageInfo?.label || null,
    stageProbability: stageInfo?.probability ?? null,
    pipelineId: p.pipeline || null,
    pipelineLabel: null,
    ownerId: p.hubspot_owner_id?.trim() || null,
    ownerName: (p.hubspot_owner_id && available.ownerNames.get(p.hubspot_owner_id)) || null,
    hsNextStep: p.hs_next_step?.trim() || null,
    nextActivityDate: p.notes_next_activity_date?.trim() || null,
    lastActivityAt,
    daysSinceLastActivity: daysInactive,
    closed,
    closedWon,
    company: companyRecord,
    contacts,
    championId,
    decisionMakerId,
    championIdentified: Boolean(championContact || championByTitle),
    championName: (championContact || championByTitle)?.name || null,
    decisionMakerIdentified: Boolean(decisionMakerContact),
    decisionMakerName: decisionMakerContact?.name || null,
    strategic: strategicFlag,
    strategicReason: strategicReason(p),
    potentialArr: toNumber(p.potential_arr),
    potentialVolume: toNumber(p.potential_volume),
    blockers,
    detectedBlockers,
    meetingPlanned: plannedMeetings.length > 0,
    nextMeetingAt,
    nextTaskDueAt,
    nextTaskSubject,
    openTasksCount: openTasks.length,
    recentNoShowOrCancelled: recentNoShow,
    score,
    priorityScore,
    priorityExplanation: priorityExplanation({
      economic, strategic, momentum, health,
      blockers, decisionMakerIdentified: Boolean(decisionMakerContact), daysInactive,
      strategicReason: strategicReason(p), nextTaskSubject,
    }),
    health: healthStatus,
    healthReason,
    breakdown: { economic, strategic, momentum, health },
    scoreReasons: buildReasons({
      amount, potentialArr: toNumber(p.potential_arr), potentialVolume: toNumber(p.potential_volume),
      strategic: strategicFlag, strategicReason: strategicReason(p), daysInactive,
      meetingPlanned: plannedMeetings.length > 0, nextTaskDueAt, hsNextStep: p.hs_next_step,
      decisionMakerIdentified: Boolean(decisionMakerContact), championIdentified: Boolean(championContact || championByTitle),
      blockers, closeDateOverdue, recentNoShowOrCancelled: recentNoShow,
    }),
    hubspotUrl: available.portalId ? `https://app.hubspot.com/contacts/${available.portalId}/deal/${String(deal.id)}` : null,
  } satisfies DealRoomDeal;
}

export async function getDealRoomList(options: { owner?: string } = {}) {
  await readCustomDealProperties();
  const properties = readyDealProperties();
  const [allDeals, owners, stageData, portalId] = await Promise.all([
    searchAllDeals(properties),
    readOwners(),
    readDealStageAndPipelines(),
    readPortalId(),
  ]);

  const nowDate = new Date();
  const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
  const monthEnd = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0, 23, 59, 59, 999);
  const [wonThisMonth, lostThisMonth] = await Promise.all([
    searchClosedMonth(properties, true, monthStart.toISOString(), monthEnd.toISOString()),
    searchClosedMonth(properties, false, monthStart.toISOString(), monthEnd.toISOString()),
  ]);

  const strategicOpen = allDeals.filter(deal => !isClosed(deal) && isStrategicProperties(deal.properties || {}));
  const strategicWon = wonThisMonth.filter(deal => isStrategicProperties(deal.properties || {}));
  const strategicLost = lostThisMonth.filter(deal => isStrategicProperties(deal.properties || {}));

  const results: DealRoomDeal[] = [];
  for (const deal of strategicOpen) {
    if (options.owner && deal.properties?.hubspot_owner_id !== options.owner) continue;
    const enrichment = await enrichDeal(deal, owners, { stages: stageData.stages, portalId });
    results.push(buildDealRoomDeal(enrichment, { stageLabels: stageData.stages, ownerNames: owners, portalId }));
  }

  results.sort((a, b) => b.priorityScore - a.priorityScore || (b.amount || 0) - (a.amount || 0));

  const kpis: DealRoomKPIs = {
    pipelineValue: results.reduce((sum, deal) => sum + (deal.amount || 0), 0),
    activeDeals: results.length,
    atRisk: results.filter(deal => deal.health === "at_risk").length,
    noNextAction: results.filter(deal => !deal.hsNextStep && !deal.nextTaskDueAt && !deal.nextActivityDate).length,
    noMeeting: results.filter(deal => !deal.meetingPlanned).length,
    closingSoon: results.filter(deal => {
      const close = parseDate(deal.closeDate);
      return close !== null && close.getTime() >= nowDate.getTime() && daysBetween(close, nowDate) <= 30;
    }).length,
    wonThisMonth: strategicWon.length,
    wonThisMonthValue: strategicWon.reduce((sum, deal) => sum + (toNumber(deal.properties?.amount) || 0), 0),
    lostThisMonth: strategicLost.length,
    weightedForecast: results.reduce((sum, deal) => sum + ((deal.amount || 0) * (deal.stageProbability ?? 0)), 0),
  };

  return { generatedAt: new Date().toISOString(), kpis, results, total: results.length };
}

function isClosed(deal: HubSpotObject) {
  const p = deal.properties || {};
  return trueFlag(p.hs_is_closed_won) || trueFlag(p.hs_is_closed_count);
}

export async function getDealRoomDetail(id: string) {
  await readCustomDealProperties();
  const properties = readyDealProperties();
  const [deal, owners, stageData, portalId] = await Promise.all([
    hubspotJson(`/crm/objects/2026-03/deals/${encodeURIComponent(id)}?properties=${properties.join(",")}`) as Promise<HubSpotObject>,
    readOwners(),
    readDealStageAndPipelines(),
    readPortalId(),
  ]);
  const enrichment = await enrichDeal(deal, owners, { stages: stageData.stages, portalId });
  const base = buildDealRoomDeal(enrichment, { stageLabels: stageData.stages, ownerNames: owners, portalId });

  const p = deal.properties || {};
  const pipelineLabel = (p.pipeline && stageData.pipelines.get(p.pipeline)) || null;

  const stakeholders = buildStakeholders(enrichment, base);
  const nextSteps = buildNextSteps(enrichment, owners);
  const meetings = buildMeetings(enrichment, owners);
  const timeline = buildTimeline(enrichment, base);
  const closingPlan = buildClosingPlan(enrichment, base, owners);
  const documents = buildDocuments(enrichment, base);
  const intelligence = buildIntelligence({ base, stakeholders, nextSteps, meetings, timeline, closingPlan, documents });

  const dealStageOptions = [...stageData.stages.entries()]
    .filter(([, stage]) => !base.pipelineId || stage.pipelineId === base.pipelineId)
    .sort((a, b) => (a[1].probability ?? 0) - (b[1].probability ?? 0))
    .map(([stageId, stage]) => ({ id: stageId, label: stage.label, probability: stage.probability }));

  const overviewMissing = [
    !p.dealname?.trim() && "nom du deal",
    !base.amount && "montant",
    (!base.closeDate || parseDate(base.closeDate) === null) && "date de closing",
    !base.hsNextStep && "prochaine étape",
    !base.nextMeetingAt && "rendez-vous planifié",
    !base.decisionMakerIdentified && "décideur identifié",
    !base.championIdentified && "champion identifié",
    !base.potentialArr && "potentiel annuel",
  ].filter(Boolean) as string[];

  return {
    ...base,
    pipelineLabel: p.pipeline ? pipelineLabel : null,
    overviewMissing,
    stakeholders,
    nextSteps,
    meetings,
    timeline,
    intelligence,
    closingPlan,
    documents,
    stageOptions: dealStageOptions,
    contactsForAssociation: base.contacts,
  } satisfies DealRoomDetail;
}

function buildStakeholders(enrich: DealEnrichment, base: DealRoomDeal) {
  return enrich.contacts.map(contact => {
    const cp = contact.properties || {};
    const roles = applyManualRoles(
      {
        id: String(contact.id),
        name: joinName(cp) || cp.email || "Contact sans nom",
        jobtitle: cp.jobtitle?.trim() || null,
        email: cp.email?.trim() || null,
        phone: cp.mobilephone?.trim() || cp.phone?.trim() || null,
        company: cp.company?.trim() || null,
        lastActivityAt: contactLastActivity(contact, enrich.notes, enrich.calls, enrich.meetings, enrich.tasks),
      },
      base.championId,
      base.decisionMakerId,
    );
    const stakeholder: Stakeholder = {
      id: String(contact.id),
      name: joinName(cp) || cp.email || "Contact sans nom",
      jobtitle: cp.jobtitle?.trim() || null,
      company: cp.company?.trim() || null,
      email: cp.email?.trim() || null,
      phone: cp.mobilephone?.trim() || cp.phone?.trim() || null,
      influence: contactInfluence(cp.jobtitle || null, roles),
      roles,
      lastActivityAt: contactLastActivity(contact, enrich.notes, enrich.calls, enrich.meetings, enrich.tasks),
      hubspotUrl: enrich.portalId ? `https://app.hubspot.com/contacts/${enrich.portalId}/contact/${String(contact.id)}` : null,
    };
    return stakeholder;
  });
}

function buildNextSteps(enrich: DealEnrichment, owners: Map<string, string>): NextStepItem[] {
  const nowDate = new Date();
  const items: NextStepItem[] = [];

  if (enrich.deal.properties?.hs_next_step?.trim()) {
    items.push({
      id: "next-step",
      kind: "next_step",
      subject: enrich.deal.properties.hs_next_step.trim(),
      detail: "Prochaine étape renseignée sur le deal",
      dueAt: enrich.deal.properties.notes_next_activity_date?.trim() || null,
      ownerId: enrich.deal.properties.hubspot_owner_id?.trim() || null,
      ownerName: (enrich.deal.properties.hubspot_owner_id && owners.get(enrich.deal.properties.hubspot_owner_id)) || null,
      status: null,
      type: null,
    });
  }

  for (const task of enrich.tasks) {
    if (["COMPLETED", "DEFERRED"].includes((task.properties?.hs_task_status || "").toUpperCase())) continue;
    items.push({
      id: `task-${String(task.id)}`,
      kind: "task",
      subject: task.properties?.hs_task_subject?.trim() || "Tâche sans titre",
      detail: task.properties?.hs_task_body?.trim() || null,
      dueAt: task.properties?.hs_timestamp?.trim() || null,
      ownerId: task.properties?.hubspot_owner_id?.trim() || null,
      ownerName: (task.properties?.hubspot_owner_id && owners.get(task.properties.hubspot_owner_id)) || null,
      status: (task.properties?.hs_task_status || "NOT_STARTED"),
      type: task.properties?.hs_task_type?.trim() || null,
    });
  }

  for (const meeting of enrich.meetings) {
    const outcome = (meeting.properties?.hs_meeting_outcome || "").toUpperCase();
    const start = parseDate(meeting.properties?.hs_meeting_start_time || meeting.properties?.hs_timestamp);
    if (!["", "SCHEDULED", "UNREVIEWED"].includes(outcome)) continue;
    if (!start || start.getTime() < nowDate.getTime()) continue;
    items.push({
      id: `meeting-${String(meeting.id)}`,
      kind: "meeting",
      subject: meeting.properties?.hs_meeting_title?.trim() || "Rendez-vous",
      detail: `Rendez-vous · ${meeting.properties?.hs_meeting_location?.trim() || "lieu non renseigné"}`,
      dueAt: start.toISOString(),
      ownerId: meeting.properties?.hubspot_owner_id?.trim() || null,
      ownerName: (meeting.properties?.hubspot_owner_id && owners.get(meeting.properties.hubspot_owner_id)) || null,
      status: outcome || "SCHEDULED",
      type: "MEETING",
    });
  }

  items.sort((a, b) => (parseDate(a.dueAt)?.getTime() || Number.MAX_SAFE_INTEGER) - (parseDate(b.dueAt)?.getTime() || Number.MAX_SAFE_INTEGER));
  return items;
}

function parseMeetingNotes(raw: string | null | undefined) {
  const result: { status?: string; commercialOutcome?: string; notes?: string; nextAction?: string; dueAt?: string } = {};
  if (!raw) return result;
  for (const line of raw.split("\n")) {
    const status = line.match(/^Statut\s*:\s*(.+)$/);
    const outcome = line.match(/^Résultat commercial\s*:\s*(.+)$/);
    const notes = line.match(/^Notes\s*:\s*(.*)$/);
    const nextAction = line.match(/^Prochaine action\s*:\s*(.+)$/);
    const dueAt = line.match(/^Échéance\s*:\s*(.+)$/);
    if (status) result.status = status[1].trim();
    else if (outcome) result.commercialOutcome = outcome[1].trim();
    else if (notes) result.notes = notes[1].trim();
    else if (nextAction) result.nextAction = nextAction[1].trim();
    else if (dueAt) result.dueAt = dueAt[1].trim();
  }
  return result;
}

function extractEvidence(value: string | null | undefined, regex: RegExp) {
  const sentences = sentenceFragments(value, 30);
  return sentences.filter(sentence => regex.test(sentence));
}

function buildMeetings(enrich: DealEnrichment, owners: Map<string, string>): DealMeetingsGroup {
  const nowDate = new Date();
  const all = enrich.meetings.map(rawMeeting => {
    const outcomeRaw = (rawMeeting.properties?.hs_meeting_outcome || "").toUpperCase();
    const start = parseDate(rawMeeting.properties?.hs_meeting_start_time || rawMeeting.properties?.hs_timestamp);
    const end = parseDate(rawMeeting.properties?.hs_meeting_end_time);
    const parsed = parseMeetingNotes(rawMeeting.properties?.hs_internal_meeting_notes);
    const internalNotes = rawMeeting.properties?.hs_internal_meeting_notes || null;
    const notesText = [internalNotes, rawMeeting.properties?.hs_meeting_body?.replace(/<[^>]+>/g, " ")]
      .filter(Boolean)
      .join("\n")
      .replace(/\s+/g, " ")
      .trim();
    let outcome: DealMeeting["outcome"];
    if (["SCHEDULED", "COMPLETED", "RESCHEDULED", "NO_SHOW", "CANCELED"].includes(outcomeRaw)) {
      outcome = outcomeRaw as DealMeeting["outcome"];
    } else if (start && start.getTime() >= nowDate.getTime()) outcome = "SCHEDULED";
    else outcome = "UNREVIEWED";
    const pickedNotes = extractEvidence(parsed.notes || null, /décidé|validé|accord|confirmé|go|ok/i).slice(0, 2)
      || (parsed.commercialOutcome ? [`Résultat : ${parsed.commercialOutcome}`] : [])
      || extractEvidence(notesText, /décidé|validé|accord|confirmé/i).slice(0, 2);
    const objections = [...new Set([
      ...extractEvidence(parsed.notes || null, /objection|réserve|hésite|trop cher|budget|concurrent|doute/i),
      ...extractEvidence(rawMeeting.properties?.hs_meeting_body || null, /objection|réserve|hésite|trop cher|budget|concurrent|doute/i),
    ])].slice(0, 2);
    const commitments = [...new Set([
      ...extractEvidence(parsed.notes || null, /engagement|s[’']engage|va (envoyer|fournir|transmettre|confirmer)|promet|retournera|enverra/i),
      ...extractEvidence(rawMeeting.properties?.hs_meeting_body || null, /engagement|s[’']engage|va (envoyer|fournir|transmettre|confirmer)|promet/i),
    ])].slice(0, 2);
    const builtMeeting: DealMeeting = {
      id: String(rawMeeting.id),
      title: rawMeeting.properties?.hs_meeting_title?.trim() || "Rendez-vous sans titre",
      startAt: start?.toISOString() || null,
      endAt: end?.toISOString() || null,
      outcome,
      ownerId: rawMeeting.properties?.hubspot_owner_id?.trim() || null,
      ownerName: (rawMeeting.properties?.hubspot_owner_id && owners.get(rawMeeting.properties.hubspot_owner_id)) || null,
      participants: enrich.contacts.map(contact => [contact.properties?.firstname, contact.properties?.lastname].filter(Boolean).join(" ")).filter(Boolean),
      notes: notesText || null,
      decided: (pickedNotes.length ? pickedNotes.join(" ") : null) || parsed.commercialOutcome || null,
      objections: objections.length ? objections.join(" ") : null,
      commitments: commitments.length ? commitments.join(" ") : null,
      nextAction: parsed.nextAction || null,
      nextActionAt: parsed.dueAt || null,
      hubspotUrl: enrich.portalId ? `https://app.hubspot.com/contacts/${enrich.portalId}/meeting/${String(rawMeeting.id)}` : null,
    };
    return { meeting: builtMeeting, start };
  });

  const upcoming = all
    .filter(item => item.meeting.outcome === "SCHEDULED" || item.meeting.outcome === "UNREVIEWED")
    .filter(item => item.start !== null && item.start.getTime() >= nowDate.getTime())
    .sort((a, b) => (a.start?.getTime() || 0) - (b.start?.getTime() || 0))
    .map(item => item.meeting);
  const completed = all
    .filter(item => item.meeting.outcome === "COMPLETED" || (item.meeting.outcome === "UNREVIEWED" && (item.start === null || item.start.getTime() < nowDate.getTime())))
    .sort((a, b) => (b.start?.getTime() || 0) - (a.start?.getTime() || 0))
    .map(item => item.meeting);
  const noShow = all
    .filter(item => item.meeting.outcome === "NO_SHOW")
    .sort((a, b) => (b.start?.getTime() || 0) - (a.start?.getTime() || 0))
    .map(item => item.meeting);
  const cancelled = all
    .filter(item => item.meeting.outcome === "CANCELED" || item.meeting.outcome === "RESCHEDULED")
    .sort((a, b) => (b.start?.getTime() || 0) - (a.start?.getTime() || 0))
    .map(item => item.meeting);

  return { upcoming, completed, noShow, cancelled };
}

function buildTimeline(enrich: DealEnrichment, base: DealRoomDeal): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const note of enrich.notes) {
    const body = note.properties?.hs_note_body?.trim() || "";
    if (!body) continue;
    items.push({
      id: `note-${String(note.id)}`,
      kind: "note",
      title: "Note",
      at: latestDate([note.properties?.hs_timestamp, note.properties?.hs_createdate]) || "",
      body: body,
      actor: null,
      hubspotUrl: base.hubspotUrl,
    });
  }
  for (const call of enrich.calls) {
    items.push({
      id: `call-${String(call.id)}`,
      kind: "call",
      title: call.properties?.hs_call_title?.trim() || "Appel",
      at: latestDate([call.properties?.hs_timestamp, call.properties?.hs_createdate]) || "",
      body: call.properties?.hs_call_body?.trim() || null,
      actor: call.properties?.hs_call_disposition?.trim() || null,
      hubspotUrl: base.hubspotUrl,
    });
  }
  for (const meeting of enrich.meetings) {
    items.push({
      id: `meeting-${String(meeting.id)}`,
      kind: "meeting",
      title: meeting.properties?.hs_meeting_title?.trim() || "Rendez-vous",
      at: latestDate([meeting.properties?.hs_meeting_start_time, meeting.properties?.hs_createdate]) || "",
      body: [meeting.properties?.hs_internal_meeting_notes?.trim(), meeting.properties?.hs_meeting_body?.replace(/<[^>]+>/g, " ").trim()].filter(Boolean).join("\n") || null,
      actor: (meeting.properties?.hs_meeting_outcome || "").toUpperCase(),
      hubspotUrl: base.hubspotUrl,
    });
  }
  for (const task of enrich.tasks) {
    items.push({
      id: `task-${String(task.id)}`,
      kind: "task",
      title: task.properties?.hs_task_subject?.trim() || "Tâche",
      at: latestDate([task.properties?.hs_timestamp, task.properties?.hs_createdate]) || "",
      body: task.properties?.hs_task_body?.trim() || null,
      actor: task.properties?.hs_task_status?.trim() || null,
      hubspotUrl: base.hubspotUrl,
    });
  }
  for (const email of enrich.emails) {
    items.push({
      id: `email-${String(email.id)}`,
      kind: "email",
      title: email.properties?.hs_email_subject?.trim() || "Email",
      at: latestDate([email.properties?.hs_timestamp, email.properties?.hs_createdate]) || "",
      body: email.properties?.hs_email_text?.trim() || null,
      actor: null,
      hubspotUrl: base.hubspotUrl,
    });
  }
  return items
    .filter(item => item.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 80);
}

function buildClosingPlan(enrich: DealEnrichment, base: DealRoomDeal, owners: Map<string, string>): ClosingPlan {
  const storedRaw = hasDealProperty("dr_closing_plan") ? (enrich.deal.properties?.dr_closing_plan || "") : "";
  let stored: Record<string, { status?: ClosingPlanStatus; targetAt?: string; gandoOwnerId?: string; clientOwner?: string; notes?: string }> = {};
  try {
    stored = storedRaw ? JSON.parse(storedRaw) : {};
  } catch {
    stored = {};
  }

  const steps = CLOSING_PLAN_STEPS.map(step => {
    const relatedTasks = enrich.tasks
      .filter(task => step.match.test(`${task.properties?.hs_task_subject || ""} ${task.properties?.hs_task_body || ""}`))
      .map(task => ({
        id: String(task.id),
        subject: task.properties?.hs_task_subject?.trim() || "Tâche",
        status: task.properties?.hs_task_status || null,
        dueAt: task.properties?.hs_timestamp || null,
      }));
    const openCount = relatedTasks.filter(task => !["COMPLETED", "DEFERRED"].includes(String(task.status).toUpperCase())).length;
    const completedCount = relatedTasks.filter(task => String(task.status).toUpperCase() === "COMPLETED").length;
    let status: ClosingPlanStatus = "not_started";
    if (openCount > 0) status = openCount === 0 ? "done" : "in_progress";
    if (openCount === 0 && completedCount > 0) status = "done";
    const storedStep = stored[step.key];
    if (storedStep?.status) status = storedStep.status;
    return {
      key: step.key,
      label: step.label,
      status,
      targetAt: storedStep?.targetAt || null,
      gandoOwnerId: storedStep?.gandoOwnerId || null,
      gandoOwnerName: (storedStep?.gandoOwnerId && owners.get(storedStep.gandoOwnerId)) || null,
      clientOwner: storedStep?.clientOwner || null,
      notes: storedStep?.notes || null,
      relatedTasks,
    };
  });

  const doneCount = steps.filter(step => step.status === "done").length;
  const inProgressCount = steps.filter(step => step.status === "in_progress").length;
  return {
    steps,
    doneCount,
    inProgressCount,
    total: steps.length,
    progressLabel: `${doneCount} / ${steps.length} étapes terminées`,
  };
}

function buildDocuments(enrich: DealEnrichment, base: DealRoomDeal): DealDocument[] {
  const documents: DealDocument[] = [];
  const slots: Array<{ key: string; kind: string; url: string }> = [
    { key: "dr_doc_proposal", kind: "Proposition", url: (enrich.deal.properties?.dr_doc_proposal || "").trim() },
    { key: "dr_doc_contract", kind: "Contrat", url: (enrich.deal.properties?.dr_doc_contract || "").trim() },
    { key: "dr_doc_deck", kind: "Deck", url: (enrich.deal.properties?.dr_doc_deck || "").trim() },
    { key: "dr_doc_pricing", kind: "Pricing", url: (enrich.deal.properties?.dr_doc_pricing || "").trim() },
    { key: "dr_doc_technical", kind: "Documentation technique", url: (enrich.deal.properties?.dr_doc_technical || "").trim() },
  ];
  for (const slot of slots) {
    if (slot.url) documents.push({ id: slot.key, kind: slot.kind, title: `${slot.kind} · ${base.company?.name || base.name}`, at: null, url: slot.url, source: "propriété HubSpot", snippet: null });
  }

  const pool: Array<{ id: string; type: string; title: string; body: string; at: string | null }> = [
    ...enrich.notes.map(note => ({ id: `note-${note.id}`, type: "note", title: "Note", body: note.properties?.hs_note_body || "", at: latestDate([note.properties?.hs_timestamp, note.properties?.hs_createdate]) })),
    ...enrich.calls.map(call => ({ id: `call-${call.id}`, type: "appel", title: call.properties?.hs_call_title || "Appel", body: call.properties?.hs_call_body || "", at: latestDate([call.properties?.hs_timestamp, call.properties?.hs_createdate]) })),
    ...enrich.tasks.map(task => ({ id: `task-${task.id}`, type: "tâche", title: task.properties?.hs_task_subject || "Tâche", body: task.properties?.hs_task_body || "", at: latestDate([task.properties?.hs_timestamp, task.properties?.hs_createdate]) })),
    ...enrich.emails.map(email => ({ id: `email-${email.id}`, type: "email", title: email.properties?.hs_email_subject || "Email", body: email.properties?.hs_email_text || "", at: latestDate([email.properties?.hs_timestamp, email.properties?.hs_createdate]) })),
  ];

  for (const item of pool) {
    const text = `${item.title} ${item.body}`;
    const matched = DOC_KINDS.find(docKind => docKind.match.test(text));
    if (!matched) continue;
    const snippet = sentenceFragments(item.body, 1, 120)[0] || null;
    documents.push({
      id: item.id,
      kind: matched.kind,
      title: item.body ? `${matched.kind} · ${base.company?.name || base.name}` : `${matched.kind} · ${item.title}`,
      at: item.at,
      url: base.hubspotUrl,
      source: `repéré dans une ${item.type}`,
      snippet,
    });
  }

  const seen = new Set<string>();
  return documents
    .filter(doc => { if (seen.has(doc.kind)) return false; seen.add(doc.kind); return true; })
    .sort((a, b) => (b.at || "").localeCompare(a.at || ""))
    .slice(0, 12);
}

function buildIntelligence(context: {
  base: DealRoomDeal;
  stakeholders: Stakeholder[];
  nextSteps: NextStepItem[];
  meetings: DealMeetingsGroup;
  timeline: TimelineItem[];
  closingPlan: ClosingPlan;
  documents: DealDocument[];
}): DealIntelligence {
  const { base, stakeholders, nextSteps, meetings } = context;
  const evidencePool = context.timeline
    .filter(item => item.body)
    .map(item => `${item.kind === "meeting" ? "RDV" : item.kind} (${item.at.slice(0, 10)}) : ${item.body}`);

  const matchingEvidence = (regex: RegExp) => {
    const matches: string[] = [];
    for (const text of evidencePool) {
      const sentences = sentenceFragments(text, 40);
      for (const sentence of sentences) {
        if (regex.test(sentence)) {
          const cleaned = sentence.replace(/^.*:\s*/, "").slice(0, 180);
          if (!matches.includes(cleaned)) matches.push(cleaned);
          if (matches.length >= 3) break;
        }
      }
      if (matches.length >= 3) break;
    }
    return matches;
  };

  const lastCompleted = meetings.completed[0] || null;
  const situationParts: string[] = [];
  if (lastCompleted) {
    const parsed = lastCompleted.decided || lastCompleted.notes;
    if (parsed) situationParts.push(parsed);
  }
  const situation = situationParts.length ? situationParts : matchingEvidence(/situation|état des lieux|avancement|tour de table/i).slice(0, 2);

  const deciders = stakeholders
    .filter(stakeholder => stakeholder.roles.includes("Decision Maker") || stakeholder.roles.includes("Economic Buyer"))
    .map(stakeholder => `${stakeholder.name}${stakeholder.jobtitle ? ` (${stakeholder.jobtitle})` : ""}`);

  const riskFactors: string[] = [];
  riskFactors.push(base.healthReason);
  if (base.daysSinceLastActivity !== null && base.daysSinceLastActivity > 7) riskFactors.push(`Aucune activité depuis ${base.daysSinceLastActivity} jours.`);
  if (!base.decisionMakerIdentified) riskFactors.push("Aucun décideur identifié parmi les contacts associés.");
  if (!base.hsNextStep && !base.nextTaskDueAt && !base.nextMeetingAt) riskFactors.push("Aucune prochaine étape ni activité planifiée.");
  if (base.closeDate && new Date(base.closeDate).getTime() < Date.now()) riskFactors.push("La date de closing est dépassée.");
  for (const blocker of base.blockers) riskFactors.push(`Blocage signalé : ${blocker}.`);

  const recommendation = buildRecommendation({ base, stakeholders, nextSteps, meetings, closingPlan: context.closingPlan });

  const fields: IntelligenceField[] = [
    {
      key: "situation",
      label: "Situation",
      values: situation,
      empty: situation.length === 0,
    },
    {
      key: "besoin",
      label: "Besoin du client",
      values: matchingEvidence(/besoin|vouloir|cherche|souhaite|cible|objectif d/i),
      empty: false,
    },
    {
      key: "pains",
      label: "Pain points",
      values: matchingEvidence(/pain|problème|galère|perd|coûte|complexe|lent|fastidieux|pénible|chronophage/i),
      empty: false,
    },
    {
      key: "solution",
      label: "Solution discutée",
      values: matchingEvidence(/solution|module|intégr|démo|demonstration|pilote|déploiement|caution|garantie/i),
      empty: false,
    },
    {
      key: "objections",
      label: "Objections",
      values: matchingEvidence(/objection|réserve|hésite|pas convaincu|trop cher|budget|sceptique/i),
      empty: false,
    },
    {
      key: "pricing",
      label: "Pricing discuté",
      values: matchingEvidence(/pricing|prix|tarif|coût|abonnement|commission|forfait/i),
      empty: false,
    },
    {
      key: "deciders",
      label: "Décideurs",
      values: deciders,
      empty: deciders.length === 0,
    },
    {
      key: "competitors",
      label: "Concurrents",
      values: matchingEvidence(/concurrent|compétiteur|alternative|système actuel|solution en place|un autre éditeur|brevo|aqua|simpleloc/i),
      empty: false,
    },
    {
      key: "blockers",
      label: "Blocages",
      values: riskFactors.slice(0, 3),
      empty: riskFactors.length === 0,
    },
    {
      key: "commitments",
      label: "Engagements pris",
      values: matchingEvidence(/engagement|s[’']engage|va (envoyer|fournir|transmettre|confirmer)|promet|enverra|retournera/i),
      empty: false,
    },
    {
      key: "next",
      label: "Prochaine étape",
      values: nextSteps.slice(0, 3).map(step => `${step.subject}${step.dueAt ? ` (échéance ${step.dueAt.slice(0, 10)})` : ""}`),
      empty: nextSteps.length === 0,
    },
    {
      key: "risk",
      label: "Risque du deal",
      values: riskFactors.slice(0, 3),
      empty: riskFactors.length === 0,
    },
    {
      key: "recommendation",
      label: "Recommandation commerciale",
      values: [recommendation.recommendedAction, recommendation.recommendedActionReason].filter(Boolean) as string[],
      empty: false,
    },
  ];

  const mustKnow: string[] = [];
  if (base.amount) mustKnow.push(`${base.amount.toLocaleString("fr-FR")} € de valeur estimée sur ce deal.`);
  else mustKnow.push("Le montant du deal n’est pas renseigné dans HubSpot : à compléter pour fiabiliser le forecast.");
  if (base.daysSinceLastActivity !== null && base.daysSinceLastActivity > 7) mustKnow.push(`Aucune interaction depuis ${base.daysSinceLastActivity} jours : le deal refroidit.`);
  if (base.nextMeetingAt) mustKnow.push(`Prochaine réunion planifiée le ${base.nextMeetingAt.slice(0, 10)}.`);
  if (!base.nextMeetingAt && base.openTasksCount) mustKnow.push(`Pas de réunion planifiée mais ${base.openTasksCount} tâche(s) en attente.`);
  if (base.hsNextStep) mustKnow.push(`Prochaine action annoncée : « ${base.hsNextStep} »${base.nextActivityDate ? ` (échéance ${base.nextActivityDate.slice(0, 10)})` : ""}.`);
  else if (!base.nextTaskDueAt) mustKnow.push("Aucune prochaine action renseignée : définir la prochaine étape rapidement.");
  if (base.decisionMakerName) mustKnow.push(`Décideur identifié : ${base.decisionMakerName}.`);
  else mustKnow.push("Aucun décideur identifié : risque de blocage dans le cycle de décision.");
  if (base.championName) mustKnow.push(`Champion identifié : ${base.championName}.`);
  else mustKnow.push("Aucun champion identifié : difficile de faire avancer à l’intérieur du compte.");
  if (base.blockers.length) mustKnow.push(`Blocage(s) en cours : ${base.blockers.slice(0, 3).join(", ")}.`);
  if (base.stageLabel) mustKnow.push(`Stage actuel : ${base.stageLabel} (probabilité de closing ${Math.round((base.stageProbability || 0) * 100)} %).`);

  return {
    fields,
    mustKnow: mustKnow.slice(0, 6),
    recommendedAction: recommendation.recommendedAction,
    recommendedActionReason: recommendation.recommendedActionReason,
  };
}

function buildRecommendation(context: { base: DealRoomDeal; stakeholders: Stakeholder[]; nextSteps: NextStepItem[]; meetings: DealMeetingsGroup; closingPlan: ClosingPlan }) {
  const { base, stakeholders, nextSteps, meetings, closingPlan } = context;
  const decisionMaker = stakeholders.find(stakeholder => stakeholder.roles.includes("Decision Maker") || stakeholder.roles.includes("Economic Buyer"));

  if (base.blockers.includes("Pas de décideur identifié") || (!decisionMaker && !base.decisionMakerIdentified)) {
    return {
      recommendedAction: "Identifier et engager le décideur du compte",
      recommendedActionReason: "Aucun décideur n’est identifié sur ce deal : sans accès au décideur, le closing est improbable. Passer par le champion ou l’interlocuteur actuel pour remonter jusqu’à la décision.",
    };
  }

  for (const blocker of base.blockers) {
    if (["Pricing", "Juridique", "Sécurité", "Technique", "API", "ERP", "Economique", "Budget", "Concurrence"].includes(blocker)) {
      return {
        recommendedAction: `Débloquer le point « ${blocker} »`,
        recommendedActionReason: `Un blocage ${blocker.toLowerCase()} est signalé sur le deal : le résoudre conditionne la poursuite du cycle de vente. Planifier un échange dédié avec le ou les interlocuteurs concernés.`,
      };
    }
  }

  const nextMeeting = meetings.upcoming[0];
  if (nextMeeting) {
    return {
      recommendedAction: `Préparer le rendez-vous du ${nextMeeting.startAt?.slice(0, 10) || "à venir"} et fixer l’objectif du compte rendu`,
      recommendedActionReason: `Une réunion est planifiée (${nextMeeting.title}). Préparer les faits CRM, les questions de décision et la prochaine étape datée, puis publier un compte rendu avec décisions et engagements.`,
    };
  }

  const nextStep = nextSteps[0];
  if (nextStep) {
    return {
      recommendedAction: nextStep.kind === "task" ? `Exécuter la tâche « ${nextStep.subject} »` : `Suivre la prochaine action « ${nextStep.subject} »`,
      recommendedActionReason: `C’est la prochaine action engagée${nextStep.dueAt ? `, prévue le ${nextStep.dueAt.slice(0, 10)}` : ""}. Une fois réalisée, mettre à jour le résultat et la prochaine étape dans HubSpot.`,
    };
  }

  if (base.daysSinceLastActivity !== null && base.daysSinceLastActivity > 7) {
    const target = base.decisionMakerName || base.championName || base.contacts[0]?.name;
    return {
      recommendedAction: `Relancer ${target || "le compte"} pour relancer la conversation`,
      recommendedActionReason: `Aucune interaction depuis ${base.daysSinceLastActivity} jours. Organiser un échange (appel ou email) avec un angle utile : actualité, question précise ou nouvelle valeur Gando.`,
    };
  }

  const nextMilestone = closingPlan.steps.find(step => step.status === "not_started" || step.status === "in_progress");
  if (nextMilestone) {
    return {
      recommendedAction: `Faire avancer le plan de closing vers « ${nextMilestone.label} »`,
      recommendedActionReason: `Le plan de closing est à ${closingPlan.progressLabel}. L’étape « ${nextMilestone.label} » est${nextMilestone.status === "in_progress" ? " en cours" : " la prochaine à activer"} : définir les responsables, la date cible et les livrables attendus.`,
    };
  }

  return {
    recommendedAction: "Valider le plan de closing et la date de signature avec le décideur",
    recommendedActionReason: "Les étapes du plan de closing sont couvertes : sécuriser le calendrier de signature et la date de closing auprès du décideur.",
  };
}

export async function processDealRoomAction(id: string, input: DealRoomActionInput) {
  await readCustomDealProperties();
  const deal = await hubspotJson(`/crm/objects/2026-03/deals/${encodeURIComponent(id)}?properties=${readyDealProperties().join(",")}`) as HubSpotObject;
  const warnings: string[] = [];
  const properties = deal.properties || {};
  const companyName = properties.associatedcompanyid ? "Compte" : "Entreprise";
  const dealName = properties.dealname || deal.id;
  const ownerId = properties.hubspot_owner_id?.trim() || null;

  const requiredText = (value: string | undefined, label: string) => {
    const normalized = value?.trim();
    if (!normalized) throw new Error(`${label} obligatoire`);
    return normalized;
  };

  const parseDateValue = (value?: string) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error("Date invalide");
    return date;
  };

  const patchDeal = (patchProperties: Record<string, string>) => hubspotJson(`/crm/objects/2026-03/deals/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: patchProperties }),
  });

  switch (input.action) {
    case "log_call": {
      const outcome = requiredText(input.outcome, "Résultat de l’appel");
      const notes = requiredText(input.notes, "Notes de l’appel");
      const duration = clamp(Number(input.duration || 0) || 0, 0, 6_000);
      const associationTypes: Array<{ to: { id: string }; types: Array<{ associationCategory: "HUBSPOT_DEFINED"; associationTypeId: number }> }> = [
        { to: { id: String(id) }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: ASSOCIATION_TYPES.callToDeal }] },
      ];
      if (input.contactId) associationTypes.push({ to: { id: input.contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: ASSOCIATION_TYPES.callToContact }] });
      const callProperties: Record<string, string> = {
        hs_call_title: `Appel — ${dealName}${input.contactId ? "" : ` — ${companyName}`}`,
        hs_call_body: notes,
        hs_call_status: "COMPLETED",
        hs_call_disposition: outcome,
        hs_timestamp: new Date().toISOString(),
      };
      if (duration > 0) callProperties.hs_call_duration = String(Math.round(duration * 60));
      if (ownerId) callProperties.hubspot_owner_id = ownerId;
      const call = await hubspotJson("/crm/objects/2026-03/calls", {
        method: "POST",
        body: JSON.stringify({ properties: callProperties, associations: associationTypes }),
      });

      if (input.followUp) {
        const due = parseDateValue(input.followUpAt) || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        const followUpSubject = input.subject?.trim() || "Rappeler le prospect";
        await createTask({
          hs_task_subject: followUpSubject,
          hs_task_body: `Relance créée après l’appel du ${new Date().toLocaleDateString("fr-FR")} (résultat : ${outcome}).\n${notes}`,
          hs_timestamp: due.toISOString(),
          hs_task_status: "NOT_STARTED",
          hs_task_priority: "HIGH",
          hs_task_type: "CALL",
          ...(ownerId ? { hubspot_owner_id: ownerId } : {}),
        }, [
          { id: String(id), associationTypeId: ASSOCIATION_TYPES.taskToDeal },
          ...(input.contactId ? [{ id: input.contactId, associationTypeId: ASSOCIATION_TYPES.taskToContact }] : []),
        ]);
        await patchDeal({
          hs_next_step: followUpSubject,
          ...(hasDealProperty("notes_next_activity_date") ? { notes_next_activity_date: due.toISOString() } : {}),
        });
      }
      return { ok: true, call: call.id, taskCreated: Boolean(input.followUp), warnings };
    }

    case "note": {
      const body = requiredText(input.notes, "Texte de la note");
      const associations: Array<{ to: { id: string }; types: Array<{ associationCategory: "HUBSPOT_DEFINED"; associationTypeId: number }> }> = [
        { to: { id: String(id) }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: ASSOCIATION_TYPES.noteToDeal }] },
      ];
      if (input.contactId) associations.push({ to: { id: input.contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: ASSOCIATION_TYPES.noteToContact }] });
      const note = await hubspotJson("/crm/objects/2026-03/notes", {
        method: "POST",
        body: JSON.stringify({
          properties: { hs_note_body: body, hs_timestamp: new Date().toISOString(), ...(ownerId ? { hubspot_owner_id: ownerId } : {}) },
          associations,
        }),
      });
      return { ok: true, note: note.id, warnings };
    }

    case "task": {
      const subject = requiredText(input.subject, "Sujet de la tâche");
      const due = parseDateValue(input.dueAt) || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const type = input.taskType || (/appel|call/i.test(subject) ? "CALL" : /mail|email/i.test(subject) ? "EMAIL" : "TODO");
      const associations: Array<{ id: string; associationTypeId: number }> = [
        { id: String(id), associationTypeId: ASSOCIATION_TYPES.taskToDeal },
        ...(input.contactId ? [{ id: input.contactId, associationTypeId: ASSOCIATION_TYPES.taskToContact }] : []),
      ];
      const task = await createTask({
        hs_task_subject: subject,
        hs_task_body: input.notes || `Tâche liée au deal « ${dealName} » depuis Gando Sales Cockpit.`,
        hs_timestamp: due.toISOString(),
        hs_task_status: "NOT_STARTED",
        hs_task_priority: input.priority || "MEDIUM",
        hs_task_type: type,
        ...(ownerId ? { hubspot_owner_id: ownerId } : {}),
      }, associations);
      return { ok: true, task: task.id, warnings };
    }

    case "meeting": {
      const title = requiredText(input.title, "Titre du rendez-vous");
      const start = parseDateValue(input.startAt);
      if (!start) throw new Error("Date de début obligatoire");
      const end = parseDateValue(input.endAt) || new Date(start.getTime() + 60 * 60 * 1000);
      const associations: Array<{ to: { id: string }; types: Array<{ associationCategory: "HUBSPOT_DEFINED"; associationTypeId: number }> }> = [
        { to: { id: String(id) }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: ASSOCIATION_TYPES.meetingToDeal }] },
      ];
      if (input.contactId) associations.push({ to: { id: input.contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: ASSOCIATION_TYPES.meetingToContact }] });
      const meeting = await hubspotJson("/crm/objects/2026-03/meetings", {
        method: "POST",
        body: JSON.stringify({
          properties: {
            hs_meeting_title: title,
            hs_meeting_start_time: start.toISOString(),
            hs_meeting_end_time: end.toISOString(),
            hs_timestamp: start.toISOString(),
            hs_meeting_outcome: "SCHEDULED",
            ...(input.notes ? { hs_meeting_body: input.notes } : {}),
            ...(ownerId ? { hubspot_owner_id: ownerId } : {}),
          },
          associations,
        }),
      });
      return { ok: true, meeting: meeting.id, warnings };
    }

    case "stage": {
      const stageIdValue = requiredText(input.stageId, "Nouveau stage");
      await patchDeal({ dealstage: stageIdValue });
      return { ok: true, warnings };
    }

    case "next_step": {
      const nextStep = requiredText(input.nextStep, "Prochaine action");
      const due = parseDateValue(input.dueAt);
      const patch: Record<string, string> = { hs_next_step: nextStep };
      if (hasDealProperty("notes_next_activity_date")) patch.notes_next_activity_date = due ? due.toISOString() : "";
      await patchDeal(patch);
      if (due) {
        const type = /appel|call/i.test(nextStep) ? "CALL" : /mail|email/i.test(nextStep) ? "EMAIL" : "TODO";
        const task = await createTask({
          hs_task_subject: nextStep,
          hs_task_body: `Prochaine action du deal « ${dealName} » créée depuis Gando Sales Cockpit.`,
          hs_timestamp: due.toISOString(),
          hs_task_status: "NOT_STARTED",
          hs_task_priority: "HIGH",
          hs_task_type: type,
          ...(ownerId ? { hubspot_owner_id: ownerId } : {}),
        }, [{ id: String(id), associationTypeId: ASSOCIATION_TYPES.taskToDeal }]);
        return { ok: true, task: task.id, warnings };
      }
      return { ok: true, warnings };
    }

    case "blocker": {
      if (!hasDealProperty("dr_blockers")) {
        throw new Error("La propriété HubSpot `dr_blockers` n’existe pas sur l’objet deal. Documentez puis ajoutez-la (voir docs/deal-room-properties.md).");
      }
      const value = requiredText(input.blocker, "Blocage");
      if (!BLOCKER_CATEGORIES.includes(value)) throw new Error(`Catégorie de blocage invalide (${BLOCKER_CATEGORIES.join(", ")})`);
      const existing = (properties.dr_blockers || "").split(/[;,]/).map(item => item.trim()).filter(Boolean);
      if (!existing.includes(value)) existing.push(value);
      await patchDeal({ dr_blockers: existing.join(";") });
      return { ok: true, warnings };
    }

    case "contact": {
      const contactIdValue = requiredText(input.contactId, "Contact");
      await hubspotJson(`/crm/associations/2026-03/deals/${encodeURIComponent(id)}/contacts/${encodeURIComponent(contactIdValue)}`, {
        method: "POST",
        body: JSON.stringify({ types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: ASSOCIATION_TYPES.dealToContact }] }),
      });
      if (input.role && input.role !== "Blocker") {
        const propertyName = input.role === "Champion" ? "dr_champion_id" : input.role === "Decision Maker" || input.role === "Economic Buyer" ? "dr_decisionmaker_id" : null;
        if (propertyName) {
          if (!hasDealProperty(propertyName)) {
            warnings.push(`Le rôle « ${input.role} » n’a pas été enregistré : la propriété HubSpot \`${propertyName}\` n’existe pas (voir docs/deal-room-properties.md).`);
          } else {
            await patchDeal({ [propertyName]: contactIdValue });
          }
        }
      }
      return { ok: true, warnings };
    }

    case "stakeholder_role": {
      const contactIdValue = requiredText(input.contactId, "Contact");
      const propertyName = input.role === "Champion" ? "dr_champion_id" : input.role === "Decision Maker" || input.role === "Economic Buyer" ? "dr_decisionmaker_id" : null;
      if (!propertyName) throw new Error("Rôle invalide pour l’enregistrement HubSpot");
      if (!hasDealProperty(propertyName)) {
        throw new Error(`La propriété HubSpot \`${propertyName}\` n’existe pas sur l’objet deal (voir docs/deal-room-properties.md).`);
      }
      await patchDeal({ [propertyName]: contactIdValue });
      return { ok: true, warnings };
    }

    case "closing_plan": {
      if (!hasDealProperty("dr_closing_plan")) {
        throw new Error("La propriété HubSpot `dr_closing_plan` n’existe pas sur l’objet deal. Documentez puis ajoutez-la (voir docs/deal-room-properties.md).");
      }
      const stepKey = requiredText(input.stepKey, "Étape du plan");
      const stepStatus = input.stepStatus || "done";
      const current = properties.dr_closing_plan || "{}";
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(current);
      } catch {
        parsed = {};
      }
      parsed[stepKey] = { ...(typeof parsed[stepKey] === "object" && parsed[stepKey] ? parsed[stepKey] : {}), status: stepStatus };
      await patchDeal({ dr_closing_plan: JSON.stringify(parsed) });
      return { ok: true, warnings };
    }

    default:
      throw new Error("Action inconnue");
  }
}

export const dealRoomBlockers = BLOCKER_CATEGORIES;
export const dealRoomClosingPlanStepsLabels = CLOSING_PLAN_STEPS.map(step => step.label);