import type { SDCode } from "@/lib/sd-room-types";

export type MutualActionItem = {
  milestone: string;
  owner: string;
  dueDate: string;
  status: "not_started" | "in_progress" | "done";
  dependency: string;
};

export type SD02Content = {
  objective: string;
  successDefinition: string;
  milestones: MutualActionItem[];
  clientCommitments: string[];
  gandoCommitments: string[];
  dependencies: string[];
  risks: string[];
  exitCriteria: string[];
};

export type SD03Content = {
  solutionSummary: string;
  scopeIn: string[];
  scopeOut: string[];
  integrations: string[];
  dataRequirements: string[];
  securityAndCompliance: string[];
  pilot: {
    perimeter: string;
    duration: string;
    successMetrics: string[];
  };
  deploymentPlan: string[];
  technicalOwners: string[];
};

export type SD04Content = {
  offerSummary: string;
  pricing: Array<{ item: string; model: string; price: string; notes: string }>;
  assumptions: string[];
  businessCase: Array<{ metric: string; baseline: string; target: string; value: string }>;
  commercialTerms: string[];
  procurementSteps: string[];
  validityDate: string;
};

export type SD05Content = {
  contractSummary: string;
  legalItems: Array<{ topic: string; status: "open" | "in_review" | "approved"; owner: string; notes: string }>;
  signatories: Array<{ name: string; role: string; organization: string }>;
  signatureSteps: string[];
  finalConditions: string[];
  goLiveDate: string;
  handoverPlan: string[];
};

export type SDStageContent = SD02Content | SD03Content | SD04Content | SD05Content;
type EmptyStage = Record<string, unknown>;

export function createEmptySD02(): SD02Content {
  return { objective: "", successDefinition: "", milestones: [], clientCommitments: [], gandoCommitments: [], dependencies: [], risks: [], exitCriteria: [] };
}

export function createEmptySD03(): SD03Content {
  return { solutionSummary: "", scopeIn: [], scopeOut: [], integrations: [], dataRequirements: [], securityAndCompliance: [], pilot: { perimeter: "", duration: "", successMetrics: [] }, deploymentPlan: [], technicalOwners: [] };
}

export function createEmptySD04(): SD04Content {
  return { offerSummary: "", pricing: [], assumptions: [], businessCase: [], commercialTerms: [], procurementSteps: [], validityDate: "" };
}

export function createEmptySD05(): SD05Content {
  return { contractSummary: "", legalItems: [], signatories: [], signatureSteps: [], finalConditions: [], goLiveDate: "", handoverPlan: [] };
}

export function emptyStageContent(code: SDCode): SDStageContent | EmptyStage {
  if (code === "SD02") return createEmptySD02();
  if (code === "SD03") return createEmptySD03();
  if (code === "SD04") return createEmptySD04();
  if (code === "SD05") return createEmptySD05();
  return {};
}

function text(value: unknown, max = 4000) {
  return String(value || "").trim().slice(0, max);
}

function stringList(value: unknown, maxItems = 80) {
  return Array.isArray(value) ? value.map(item => text(item, 1000)).filter(Boolean).slice(0, maxItems) : [];
}

export function normalizeStageContent(code: SDCode, value: unknown): SDStageContent | EmptyStage {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (code === "SD02") {
    const result: SD02Content = {
      objective: text(source.objective),
      successDefinition: text(source.successDefinition),
      milestones: Array.isArray(source.milestones) ? source.milestones.slice(0, 80).map(item => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
        const status: MutualActionItem["status"] = row.status === "done" || row.status === "in_progress" ? row.status : "not_started";
        return { milestone: text(row.milestone, 1000), owner: text(row.owner, 300), dueDate: text(row.dueDate, 40), status, dependency: text(row.dependency, 1000) };
      }).filter(item => item.milestone) : [],
      clientCommitments: stringList(source.clientCommitments),
      gandoCommitments: stringList(source.gandoCommitments),
      dependencies: stringList(source.dependencies),
      risks: stringList(source.risks),
      exitCriteria: stringList(source.exitCriteria),
    };
    return result;
  }
  if (code === "SD03") {
    const pilot = source.pilot && typeof source.pilot === "object" ? source.pilot as Record<string, unknown> : {};
    const result: SD03Content = {
      solutionSummary: text(source.solutionSummary),
      scopeIn: stringList(source.scopeIn),
      scopeOut: stringList(source.scopeOut),
      integrations: stringList(source.integrations),
      dataRequirements: stringList(source.dataRequirements),
      securityAndCompliance: stringList(source.securityAndCompliance),
      pilot: { perimeter: text(pilot.perimeter), duration: text(pilot.duration, 300), successMetrics: stringList(pilot.successMetrics) },
      deploymentPlan: stringList(source.deploymentPlan),
      technicalOwners: stringList(source.technicalOwners),
    };
    return result;
  }
  if (code === "SD04") {
    const result: SD04Content = {
      offerSummary: text(source.offerSummary),
      pricing: Array.isArray(source.pricing) ? source.pricing.slice(0, 60).map(item => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return { item: text(row.item, 500), model: text(row.model, 500), price: text(row.price, 300), notes: text(row.notes, 1000) };
      }).filter(item => item.item) : [],
      assumptions: stringList(source.assumptions),
      businessCase: Array.isArray(source.businessCase) ? source.businessCase.slice(0, 60).map(item => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return { metric: text(row.metric, 500), baseline: text(row.baseline, 300), target: text(row.target, 300), value: text(row.value, 500) };
      }).filter(item => item.metric) : [],
      commercialTerms: stringList(source.commercialTerms),
      procurementSteps: stringList(source.procurementSteps),
      validityDate: text(source.validityDate, 40),
    };
    return result;
  }
  if (code === "SD05") {
    const result: SD05Content = {
      contractSummary: text(source.contractSummary),
      legalItems: Array.isArray(source.legalItems) ? source.legalItems.slice(0, 80).map(item => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
        const status: SD05Content["legalItems"][number]["status"] = row.status === "approved" || row.status === "in_review" ? row.status : "open";
        return { topic: text(row.topic, 500), status, owner: text(row.owner, 300), notes: text(row.notes, 1000) };
      }).filter(item => item.topic) : [],
      signatories: Array.isArray(source.signatories) ? source.signatories.slice(0, 30).map(item => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return { name: text(row.name, 300), role: text(row.role, 300), organization: text(row.organization, 300) };
      }).filter(item => item.name) : [],
      signatureSteps: stringList(source.signatureSteps),
      finalConditions: stringList(source.finalConditions),
      goLiveDate: text(source.goLiveDate, 40),
      handoverPlan: stringList(source.handoverPlan),
    };
    return result;
  }
  return {};
}
