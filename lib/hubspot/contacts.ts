import { hubspotJson } from "@/lib/hubspot";
import { createReminderTask, countOpenTasksThrough } from "@/lib/hubspot/tasks";
import { getTodayMeetingContext } from "@/lib/hubspot/meetings";

export type HubSpotRecord = {
  id: string;
  properties: Record<string, string | null | undefined>;
  associations?: Record<string, { results?: Array<{ id: string; type?: string }> }>;
  createdAt?: string;
  updatedAt?: string;
};

export type PriorityContact = HubSpotRecord & {
  priorityScore: number;
  priorityLabel: string;
  priorityTone: "urgent" | "today" | "normal" | "healthy";
  priorityReason: string;
  nextReminderAt: string | null;
  attemptCount: number;
};

export const CONTACT_PROPERTIES = [
  "firstname", "lastname", "email", "phone", "mobilephone", "company", "jobtitle",
  "hubspot_owner_id", "statut_prospection", "resultat_prospection", "statut_de_lappel",
  "date_prochaine_relance", "minari_call_count", "referly_call_outcome",
  "referly_reason_to_reach_out", "notes_last_contacted", "hs_last_sales_activity_timestamp",
  "hs_object_source_label", "state", "city", "createdate",
];

const EXCLUDED_CALL_STATUSES = new Set(["pas interesse", "hors cible", "numero invalide"]);
const EXCLUDED_PROSPECTION_STATUSES = new Set(["non qualifie", "perdu"]);
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

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function attemptCount(properties: HubSpotRecord["properties"]) {
  const count = Number.parseInt(String(properties.minari_call_count || "0"), 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export function calculateContactPriority(contact: HubSpotRecord, now = new Date()) {
  const p = contact.properties;
  const callStatus = normalize(p.statut_de_lappel);
  const prospectionStatus = normalize(p.statut_prospection);
  const nextReminder = parseHubSpotDate(p.date_prochaine_relance);
  const lastContact = parseHubSpotDate(p.notes_last_contacted || p.hs_last_sales_activity_timestamp);
  const attempts = attemptCount(p);
  const reason = (p.referly_reason_to_reach_out || "").trim();
  const hasPhone = Boolean((p.phone || p.mobilephone || "").trim());
  const terminal = EXCLUDED_CALL_STATUSES.has(callStatus) || EXCLUDED_PROSPECTION_STATUSES.has(prospectionStatus);
  const deferred = Boolean(nextReminder && nextReminder.getTime() > now.getTime() + 30 * 60_000 && CALLBACK_STATUSES.has(callStatus));

  if (!hasPhone || terminal || deferred) {
    return {
      eligible: false,
      score: terminal || !hasPhone ? 0 : 10,
      label: !hasPhone ? "Sans téléphone" : terminal ? "Hors file" : "Planifié",
      tone: "healthy" as const,
      reason: reason || (nextReminder ? "Rappel déjà planifié." : "Ce contact ne fait pas partie de la file active."),
      attempts,
      nextReminder,
    };
  }

  if (nextReminder && nextReminder.getTime() < now.getTime()) {
    return { eligible: true, score: 100, label: "Rappel en retard", tone: "urgent" as const, reason: reason || "La date de relance est dépassée.", attempts, nextReminder };
  }
  if (nextReminder && nextReminder.getTime() <= now.getTime() + 30 * 60_000) {
    return { eligible: true, score: 90, label: "À rappeler maintenant", tone: "urgent" as const, reason: reason || "Le créneau de rappel est arrivé.", attempts, nextReminder };
  }
  if (reason && /rappel|rappeler|recontact|call back/.test(normalize(reason))) {
    return { eligible: true, score: 80, label: "Rappel demandé", tone: "today" as const, reason, attempts, nextReminder };
  }
  if (["interesse", "interesse mais", "en attente decision"].includes(callStatus)) {
    return { eligible: true, score: 70, label: "Contact intéressé", tone: "today" as const, reason: reason || "Le contact a montré de l’intérêt.", attempts, nextReminder };
  }
  if (!lastContact && attempts === 0) {
    return { eligible: true, score: 60, label: "Nouveau prospect", tone: "normal" as const, reason: reason || "Ce prospect n’a encore jamais été appelé.", attempts, nextReminder };
  }
  if (callStatus === "nrp") {
    const firstAttempt = attempts <= 1;
    return { eligible: true, score: firstAttempt ? 50 : 40, label: firstAttempt ? "NRP · 1 tentative" : "NRP · plusieurs tentatives", tone: "normal" as const, reason: reason || "Nouvelle tentative après un appel sans réponse.", attempts, nextReminder };
  }
  if (lastContact && now.getTime() - lastContact.getTime() < 24 * 60 * 60_000) {
    return { eligible: true, score: 20, label: "Appelé récemment", tone: "normal" as const, reason: reason || "Ce contact a été appelé dans les dernières 24 heures.", attempts, nextReminder };
  }
  return { eligible: true, score: 30, label: "À contacter", tone: "normal" as const, reason: reason || "Prospect actif dans la prospection.", attempts, nextReminder };
}

export async function loadAllContacts(owner?: string) {
  const rows: HubSpotRecord[] = [];
  let after: string | undefined;
  do {
    const query = new URLSearchParams({ limit: "100", properties: CONTACT_PROPERTIES.join(",") });
    if (after) query.set("after", after);
    const page = await hubspotJson(`/crm/objects/2026-03/contacts?${query}`);
    rows.push(...(page.results || []));
    after = page.paging?.next?.after;
  } while (after);
  return owner ? rows.filter(contact => contact.properties.hubspot_owner_id === owner) : rows;
}

export async function getTodayCockpit(owner?: string) {
  const now = new Date();
  const [contacts, tasksDue, meetingContext] = await Promise.all([
    loadAllContacts(owner),
    countOpenTasksThrough(endOfDay(now), owner),
    getTodayMeetingContext(owner),
  ]);
  const scheduledContactIds = new Set(meetingContext.scheduledContactIds);
  const scheduledCompanyNames = new Set(meetingContext.scheduledCompanyNames);

  const enriched = contacts.map(contact => {
    const priority = calculateContactPriority(contact, now);
    return {
      ...contact,
      priorityScore: priority.score,
      priorityLabel: priority.label,
      priorityTone: priority.tone,
      priorityReason: priority.reason,
      nextReminderAt: priority.nextReminder?.toISOString() || null,
      attemptCount: priority.attempts,
      eligible: priority.eligible,
    };
  });

  const queue = enriched
    .filter(contact => contact.eligible
      && !scheduledContactIds.has(contact.id)
      && !scheduledCompanyNames.has(contact.properties.company?.trim().toLowerCase() || ""))
    .sort((a, b) => b.priorityScore - a.priorityScore || (a.nextReminderAt ? Date.parse(a.nextReminderAt) : Number.MAX_SAFE_INTEGER) - (b.nextReminderAt ? Date.parse(b.nextReminderAt) : Number.MAX_SAFE_INTEGER))
    .map(contact => ({
      id: contact.id,
      properties: contact.properties,
      associations: contact.associations,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      priorityScore: contact.priorityScore,
      priorityLabel: contact.priorityLabel,
      priorityTone: contact.priorityTone,
      priorityReason: contact.priorityReason,
      nextReminderAt: contact.nextReminderAt,
      attemptCount: contact.attemptCount,
    } satisfies PriorityContact));

  const dayStart = startOfDay(now).getTime();
  const dayEnd = endOfDay(now).getTime();
  const overdueReminders = enriched.filter(c => c.nextReminderAt && Date.parse(c.nextReminderAt) < now.getTime() && c.priorityScore > 0).length;
  const remindersToday = enriched.filter(c => c.nextReminderAt && Date.parse(c.nextReminderAt) >= dayStart && Date.parse(c.nextReminderAt) <= dayEnd && c.priorityScore > 0).length;
  const newProspects = queue.filter(c => c.priorityScore === 60).length;

  return {
    generatedAt: now.toISOString(),
    queue,
    stats: {
      overdueReminders,
      remindersToday,
      newProspects,
      tasksDue,
      meetingsToday: meetingContext.meetingsToday,
      actionsToday: queue.length + tasksDue,
    },
  };
}

export function outcomeNeedsReminder(outcome: string) {
  return CALLBACK_STATUSES.has(normalize(outcome));
}

const OUTCOME_MAP: Record<string, { callStatus: string; prospectionStatus?: string }> = {
  "NRP": { callStatus: "NRP" },
  "Occupé": { callStatus: "Occupé" },
  "À rappeler": { callStatus: "A Rappeler" },
  "A Rappeler": { callStatus: "A Rappeler" },
  "Intéressé": { callStatus: "Intéressé", prospectionStatus: "Conversation" },
  "RDV pris": { callStatus: "Intéressé", prospectionStatus: "RDV booké" },
  "Pas intéressé": { callStatus: "pas intéressé" },
  "Hors cible": { callStatus: "HORS CIBLE", prospectionStatus: "Non qualifié" },
  "Numéro invalide": { callStatus: "Numéro invalide", prospectionStatus: "Non qualifié" },
  "A une date ultérieure": { callStatus: "A une date ultérieure" },
  "Intéressé mais": { callStatus: "Intéressé mais", prospectionStatus: "Conversation" },
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
    date_prochaine_relance: parsedReminder ? parsedReminder.toISOString() : "",
  };
  if (mapped.prospectionStatus) properties.statut_prospection = mapped.prospectionStatus;

  const updatedContact = await hubspotJson(`/crm/objects/2026-03/contacts/${encodeURIComponent(contactId)}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });

  let task = null;
  if (parsedReminder) task = await createReminderTask(contact, parsedReminder);
  return { contact: updatedContact, task };
}
