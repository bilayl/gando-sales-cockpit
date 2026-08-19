import type { ProspectionBucket } from "./company-prospection-priority";

type Contact = { id: string; properties: Record<string, string | null | undefined> };

export type ContactProspectionDecision = {
  bucket: ProspectionBucket;
  priority: number;
  priorityLabel: string;
  reason: string;
  suggestion: string;
};

function normalize(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dateMs(value?: string | null) {
  if (!value) return NaN;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && String(value).length >= 12) return numeric;
  return Date.parse(value);
}

function containsAny(value: string, terms: string[]) {
  return terms.some(term => value.includes(term));
}

const EXCLUDED_TERMS = [
  "non qualifie",
  "perdu",
  "hors cible",
  "pas interesse",
  "numero invalide",
];

const OPPORTUNITY_TERMS = [
  "rdv booke",
  "rendez vous booke",
  "rendez vous pris",
  "rdv pris",
  "rdv",
];

const HIGH_INTENT_TERMS = [
  "interesse",
  "conversation",
  "devis envoye",
  "en attente decision",
];

const CALLBACK_TERMS = [
  "a rappeler",
  "occupe",
  "a une date ulterieure",
  "a recycler",
];

export function getContactProspectionDecision(
  contact: Contact,
  now = Date.now(),
): ContactProspectionDecision {
  const p = contact.properties;
  const statusText = [
    p.statut_prospection,
    p.statut_de_lappel,
    p.resultat_prospection,
    p.hs_lead_status,
  ].map(normalize).filter(Boolean).join(" | ");

  if (normalize(p.lifecyclestage) === "customer" || containsAny(statusText, ["signe", "gagne", "won"])) {
    return {
      bucket: "EXCLUDED",
      priority: 99,
      priorityLabel: "Converti",
      reason: "Contact déjà converti : ne pas le remettre dans la file d'appels.",
      suggestion: "Suivi client hors prospection",
    };
  }

  if (containsAny(statusText, EXCLUDED_TERMS)) {
    const reason = containsAny(statusText, ["pas interesse"])
      ? "Le contact a indiqué ne pas être intéressé."
      : containsAny(statusText, ["hors cible", "non qualifie"])
        ? "Le contact est hors cible ou non qualifié."
        : containsAny(statusText, ["numero invalide"])
          ? "Le numéro est invalide."
          : "Le contact est marqué comme perdu.";
    return {
      bucket: "EXCLUDED",
      priority: 99,
      priorityLabel: "Exclu",
      reason,
      suggestion: "Ne pas appeler",
    };
  }

  if (containsAny(statusText, OPPORTUNITY_TERMS)) {
    return {
      bucket: "OPPORTUNITY",
      priority: 90,
      priorityLabel: "RDV / opportunité",
      reason: "Un rendez-vous ou une opportunité est déjà identifié(e).",
      suggestion: "Préparer le RDV plutôt qu'un cold call",
    };
  }

  const reminder = dateMs(
    p.date_prochaine_relance
    || p.qualification_next_action_at
    || p.date_de_rappel
    || p.notes_next_activity_date,
  );

  if (Number.isFinite(reminder) && reminder > now) {
    return {
      bucket: "SNOOZED",
      priority: 80,
      priorityLabel: "À échéance",
      reason: "Une prochaine relance est déjà planifiée dans le futur.",
      suggestion: "Attendre la date de relance",
    };
  }

  if (Number.isFinite(reminder) && reminder <= now) {
    return {
      bucket: "ACTIONABLE",
      priority: 1,
      priorityLabel: "P1 · Relance due",
      reason: "La date de relance est arrivée ou dépassée.",
      suggestion: "Rappeler maintenant",
    };
  }

  if (containsAny(statusText, HIGH_INTENT_TERMS)) {
    return {
      bucket: "ACTIONABLE",
      priority: 2,
      priorityLabel: "P2 · Chaud",
      reason: "Le statut indique un signal d'intérêt ou une conversation engagée.",
      suggestion: containsAny(statusText, ["devis envoye"]) ? "Relancer le devis" : "Appeler et qualifier la prochaine étape",
    };
  }

  if (containsAny(statusText, CALLBACK_TERMS)) {
    return {
      bucket: "ACTIONABLE",
      priority: 2,
      priorityLabel: "P2 · À rappeler",
      reason: "Le dernier résultat demande explicitement une nouvelle tentative.",
      suggestion: "Rappeler en priorité",
    };
  }

  if (containsAny(statusText, ["nrp", "en prospection"])) {
    return {
      bucket: "ACTIONABLE",
      priority: 3,
      priorityLabel: "P3 · Recontact",
      reason: "Une tentative a déjà été faite sans connexion utile.",
      suggestion: "Retenter l'appel",
    };
  }

  if (containsAny(statusText, ["contact", "autres"])) {
    return {
      bucket: "ACTIONABLE",
      priority: 4,
      priorityLabel: "P4 · À qualifier",
      reason: "Le contact existe mais la prochaine étape commerciale n'est pas claire.",
      suggestion: "Appeler pour qualifier",
    };
  }

  return {
    bucket: "ACTIONABLE",
    priority: 5,
    priorityLabel: "P5 · Premier appel",
    reason: "Aucun signal de traitement récent : contact à prospecter.",
    suggestion: "Effectuer le premier appel",
  };
}

export function compareContactProspectionPriority(
  a: Contact,
  b: Contact,
  now = Date.now(),
) {
  const aDecision = getContactProspectionDecision(a, now);
  const bDecision = getContactProspectionDecision(b, now);
  if (aDecision.priority !== bDecision.priority) return aDecision.priority - bDecision.priority;

  const aReminder = dateMs(a.properties.date_prochaine_relance || a.properties.qualification_next_action_at || a.properties.date_de_rappel || a.properties.notes_next_activity_date);
  const bReminder = dateMs(b.properties.date_prochaine_relance || b.properties.qualification_next_action_at || b.properties.date_de_rappel || b.properties.notes_next_activity_date);
  const aReminderTime = Number.isFinite(aReminder) ? aReminder : Number.MAX_SAFE_INTEGER;
  const bReminderTime = Number.isFinite(bReminder) ? bReminder : Number.MAX_SAFE_INTEGER;
  if (aReminderTime !== bReminderTime) return aReminderTime - bReminderTime;

  const aActivity = dateMs(a.properties.notes_last_contacted || a.properties.hs_last_sales_activity_timestamp);
  const bActivity = dateMs(b.properties.notes_last_contacted || b.properties.hs_last_sales_activity_timestamp);
  const aActivityTime = Number.isFinite(aActivity) ? aActivity : 0;
  const bActivityTime = Number.isFinite(bActivity) ? bActivity : 0;
  return aActivityTime - bActivityTime;
}
