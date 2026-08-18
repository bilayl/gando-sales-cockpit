import type { CompanyStage } from "@/components/company-prospection-board";

type Company = { id: string; properties: Record<string, string | null | undefined> };

export type ProspectionBucket = "ACTIONABLE" | "OPPORTUNITY" | "SNOOZED" | "EXCLUDED";

export type CompanyProspectionDecision = {
  bucket: ProspectionBucket;
  priority: number;
  priorityLabel: string;
  reason: string;
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

const HARD_EXCLUSION_TERMS = [
  "pas interesse",
  "ne souhaite pas donner suite",
  "hors cible",
  "numero invalide",
  "non qualifie",
  "perdu",
];

const OPPORTUNITY_TERMS = [
  "rdv booke",
  "rdv pris",
  "rendez vous planifie",
  "rendez vous pris",
  "opportunite",
];

export function getCompanyProspectionDecision(
  company: Company,
  stage: CompanyStage,
  now = Date.now(),
): CompanyProspectionDecision {
  const p = company.properties;
  const statusText = [
    p.statut_de_lappel,
    p.statut_prospection,
    p.qualification_status,
    p.prospecting_status,
    p.qualification_last_call_status,
    p.hs_lead_status,
  ].map(normalize).filter(Boolean).join(" | ");

  if (stage === "WON" || normalize(p.lifecyclestage) === "customer") {
    return { bucket: "EXCLUDED", priority: 99, priorityLabel: "Exclu", reason: "Client gagné / compte clôturé" };
  }

  if (stage === "LOST" || containsAny(statusText, HARD_EXCLUSION_TERMS)) {
    const reason = containsAny(statusText, ["pas interesse", "ne souhaite pas donner suite"])
      ? "Pas intéressé / ne souhaite pas donner suite"
      : containsAny(statusText, ["hors cible", "non qualifie"])
        ? "Hors cible / non qualifié"
        : containsAny(statusText, ["numero invalide"])
          ? "Numéro invalide"
          : "Compte perdu / clôturé";
    return { bucket: "EXCLUDED", priority: 99, priorityLabel: "Exclu", reason };
  }

  if (stage === "OPEN_DEAL" || containsAny(statusText, OPPORTUNITY_TERMS)) {
    return { bucket: "OPPORTUNITY", priority: 90, priorityLabel: "RDV / deal", reason: "Déjà qualifié : RDV ou opportunité en cours" };
  }

  const reminder = dateMs(p.qualification_next_action_at || p.date_de_rappel || p.notes_next_activity_date);
  if (stage === "LATER" && Number.isFinite(reminder) && reminder > now) {
    return { bucket: "SNOOZED", priority: 80, priorityLabel: "À échéance", reason: "Relance future non échue" };
  }

  const overdueTasks = Number(p.qualification_overdue_tasks || 0);
  if (overdueTasks > 0) {
    return { bucket: "ACTIONABLE", priority: 1, priorityLabel: "P1 · En retard", reason: `${overdueTasks} tâche${overdueTasks > 1 ? "s" : ""} HubSpot en retard` };
  }

  if (stage === "FOLLOW_UP" || (Number.isFinite(reminder) && reminder <= now)) {
    return { bucket: "ACTIONABLE", priority: 2, priorityLabel: "P2 · Relance", reason: "Relance ou rappel arrivé à échéance" };
  }

  if (stage === "ATTEMPTED_TO_CONTACT") {
    return { bucket: "ACTIONABLE", priority: 3, priorityLabel: "P3 · Recontact", reason: "Tentative précédente sans conversion" };
  }

  if (stage === "CONNECTED") {
    return { bucket: "ACTIONABLE", priority: 4, priorityLabel: "P4 · Contacté", reason: "Contact établi, prochaine action à qualifier" };
  }

  if (stage === "OPEN") {
    return { bucket: "ACTIONABLE", priority: 5, priorityLabel: "P5 · À contacter", reason: "Compte à contacter" };
  }

  return { bucket: "ACTIONABLE", priority: 6, priorityLabel: "P6 · Nouveau", reason: "Nouveau compte jamais traité" };
}

export function compareCompanyProspectionPriority(
  a: { company: Company; stage: CompanyStage },
  b: { company: Company; stage: CompanyStage },
  now = Date.now(),
) {
  const aDecision = getCompanyProspectionDecision(a.company, a.stage, now);
  const bDecision = getCompanyProspectionDecision(b.company, b.stage, now);
  if (aDecision.priority !== bDecision.priority) return aDecision.priority - bDecision.priority;

  const aReminder = dateMs(a.company.properties.qualification_next_action_at || a.company.properties.date_de_rappel || a.company.properties.notes_next_activity_date);
  const bReminder = dateMs(b.company.properties.qualification_next_action_at || b.company.properties.date_de_rappel || b.company.properties.notes_next_activity_date);
  const aTime = Number.isFinite(aReminder) ? aReminder : Number.MAX_SAFE_INTEGER;
  const bTime = Number.isFinite(bReminder) ? bReminder : Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;

  const aActivity = dateMs(a.company.properties.qualification_last_activity_at || a.company.properties.hs_last_sales_activity_timestamp || a.company.properties.notes_last_updated);
  const bActivity = dateMs(b.company.properties.qualification_last_activity_at || b.company.properties.hs_last_sales_activity_timestamp || b.company.properties.notes_last_updated);
  const aActivityTime = Number.isFinite(aActivity) ? aActivity : 0;
  const bActivityTime = Number.isFinite(bActivity) ? bActivity : 0;
  return aActivityTime - bActivityTime;
}
