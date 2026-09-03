import type { MutualActionItem } from "@/lib/sd-stage-content";
import type { SD01Content } from "@/lib/sd-room-types";

type Workstream = "business" | "technical" | "legal" | "procurement" | "other";
type Organization = "joint" | "client" | "gando";

function clean(value: unknown, max = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function detectWorkstream(value: string): Workstream {
  const text = value.toLowerCase();
  if (/api|intégr|integration|tech|dsi|sso|webhook|donnée|data|erp/.test(text)) return "technical";
  if (/jurid|contrat|legal|légal|rgpd|conform|assurance/.test(text)) return "legal";
  if (/achat|procurement|commande|fournisseur/.test(text)) return "procurement";
  return "business";
}

function step(input: {
  milestone: string;
  dependency?: string;
  owner?: string;
  dueDate?: string | null;
  organization?: Organization;
  workstream?: Workstream;
}): MutualActionItem {
  return {
    milestone: clean(input.milestone, 800),
    dependency: clean(input.dependency, 1000),
    owner: clean(input.owner, 240),
    dueDate: clean(input.dueDate, 40),
    organization: input.organization || "joint",
    workstream: input.workstream || detectWorkstream(`${input.milestone} ${input.dependency || ""}`),
    status: "not_started",
  };
}

export function generateSD02NextSteps(sd01: SD01Content, maxSteps = 6): MutualActionItem[] {
  const candidates: MutualActionItem[] = [];

  for (const item of Array.isArray(sd01.nextSteps) ? sd01.nextSteps : []) {
    const action = clean(item.action, 800);
    if (!action) continue;
    candidates.push(step({ milestone: action, owner: item.owner, dueDate: item.dueDate, organization: "joint" }));
  }

  for (const metric of Array.isArray(sd01.roi?.valueLevers) ? sd01.roi.valueLevers : []) {
    const label = clean(metric.lever, 240);
    const value = clean(metric.value, 240);
    if (!label || value) continue;
    candidates.push(step({
      milestone: `Confirmer la métrique « ${label} »`,
      dependency: clean(metric.mechanism, 600) || "Valeur attendue pour finaliser le cadrage.",
      organization: "client",
      workstream: "business",
    }));
  }

  for (const question of Array.isArray(sd01.openQuestions) ? sd01.openQuestions : []) {
    const text = clean(question, 500);
    if (!text) continue;
    candidates.push(step({ milestone: `Clarifier : ${text}`, dependency: "Point ouvert identifié dans le SD01.", organization: "joint" }));
  }

  for (const fit of Array.isArray(sd01.solutionFit) ? sd01.solutionFit : []) {
    const need = clean(fit.need, 320);
    const response = clean(fit.response, 600);
    if (!need) continue;
    candidates.push(step({
      milestone: `Valider le périmètre de la solution pour « ${need} »`,
      dependency: response ? `Réponse Gando envisagée : ${response}` : "Solution Fit à confirmer avec le client.",
      organization: "joint",
      workstream: detectWorkstream(`${need} ${response}`),
    }));
  }

  if (Array.isArray(sd01.currentProcess) && sd01.currentProcess.some(item => clean(item))) {
    candidates.push(step({
      milestone: "Valider le processus cible et les responsabilités opérationnelles",
      dependency: "Le processus actuel est documenté dans le SD01 ; cette étape doit confirmer le fonctionnement cible avec Gando.",
      organization: "joint",
      workstream: detectWorkstream(sd01.currentProcess.join(" ")),
    }));
  }

  const stakeholders = Array.isArray(sd01.stakeholders) ? sd01.stakeholders.filter(item => clean(item.name) || clean(item.role)) : [];
  if (stakeholders.length >= 2) {
    candidates.push(step({
      milestone: "Aligner les parties prenantes sur le périmètre et les prochaines validations",
      dependency: stakeholders.slice(0, 5).map(item => clean(item.name) || clean(item.role)).filter(Boolean).join(", "),
      organization: "joint",
      workstream: "business",
    }));
  }

  const seen = new Set<string>();
  return candidates.filter(item => {
    const key = item.milestone.toLowerCase().replace(/[^a-z0-9à-ÿ]+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, Math.max(1, maxSteps));
}
