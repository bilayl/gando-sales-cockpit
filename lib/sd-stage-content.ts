import type { SDCode } from "@/lib/sd-room-types";

export type MutualActionItem = {
  milestone: string;
  workstream: "business" | "technical" | "legal" | "procurement" | "other";
  organization: "client" | "gando" | "joint";
  owner: string;
  dueDate: string;
  status: "not_started" | "in_progress" | "done";
  dependency: string;
};

export type SD02Content = {
  objective: string;
  successDefinition: string;
  decisionDate: string;
  targetGoLiveDate: string;
  nextMeetingDate: string;
  decisionProcess: string[];
  milestones: MutualActionItem[];
  clientCommitments: string[];
  gandoCommitments: string[];
  dependencies: string[];
  risks: string[];
  blockers: string[];
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
  deckTitle: string;
  deckSubtitle: string;
  executiveMessage: string;
  problem: string[];
  solution: string[];
  differentiators: string[];
  proofPoints: string[];
  rolloutPlan: string[];
  callToAction: string;
  offerSummary: string;
  pricing: Array<{ item: string; model: string; price: string; notes: string }>;
  assumptions: string[];
  businessCase: Array<{ metric: string; baseline: string; target: string; value: string }>;
  commercialTerms: string[];
  procurementSteps: string[];
  validityDate: string;
};

export type SD05Content = {
  contractTitle: string;
  contractReference: string;
  contractVersion: string;
  contractUrl: string;
  contractStatus: "draft" | "internal_review" | "client_review" | "ready_to_sign" | "signed";
  contractSummary: string;
  effectiveDate: string;
  term: string;
  renewal: string;
  terminationNotice: string;
  signatureDeadline: string;
  legalItems: Array<{ topic: string; status: "open" | "in_review" | "approved"; owner: string; notes: string }>;
  signatories: Array<{ name: string; role: string; organization: string; email: string; signatureStatus: "pending" | "sent" | "signed" }>;
  signatureSteps: string[];
  finalConditions: string[];
  goLiveDate: string;
  handoverPlan: string[];
};

export type SDStageContent = SD02Content | SD03Content | SD04Content | SD05Content;
type EmptyStage = Record<string, unknown>;

export function createEmptySD02(): SD02Content {
  return {
    objective: "",
    successDefinition: "",
    decisionDate: "",
    targetGoLiveDate: "",
    nextMeetingDate: "",
    decisionProcess: [],
    milestones: [],
    clientCommitments: [],
    gandoCommitments: [],
    dependencies: [],
    risks: [],
    blockers: [],
    exitCriteria: [],
  };
}

export function createEmptySD03(): SD03Content {
  return { solutionSummary: "", scopeIn: [], scopeOut: [], integrations: [], dataRequirements: [], securityAndCompliance: [], pilot: { perimeter: "", duration: "", successMetrics: [] }, deploymentPlan: [], technicalOwners: [] };
}

export function createEmptySD04(): SD04Content {
  return {
    deckTitle: "",
    deckSubtitle: "",
    executiveMessage: "",
    problem: [],
    solution: [],
    differentiators: [],
    proofPoints: [],
    rolloutPlan: [],
    callToAction: "",
    offerSummary: "",
    pricing: [],
    assumptions: [],
    businessCase: [],
    commercialTerms: [],
    procurementSteps: [],
    validityDate: "",
  };
}

export function createEmptySD05(): SD05Content {
  return {
    contractTitle: "",
    contractReference: "",
    contractVersion: "",
    contractUrl: "",
    contractStatus: "draft",
    contractSummary: "",
    effectiveDate: "",
    term: "",
    renewal: "",
    terminationNotice: "",
    signatureDeadline: "",
    legalItems: [],
    signatories: [],
    signatureSteps: [],
    finalConditions: [],
    goLiveDate: "",
    handoverPlan: [],
  };
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
      decisionDate: text(source.decisionDate, 40),
      targetGoLiveDate: text(source.targetGoLiveDate, 40),
      nextMeetingDate: text(source.nextMeetingDate, 40),
      decisionProcess: stringList(source.decisionProcess),
      milestones: Array.isArray(source.milestones) ? source.milestones.slice(0, 80).map(item => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
        const status: MutualActionItem["status"] = row.status === "done" || row.status === "in_progress" ? row.status : "not_started";
        const workstream: MutualActionItem["workstream"] = row.workstream === "technical" || row.workstream === "legal" || row.workstream === "procurement" || row.workstream === "other" ? row.workstream : "business";
        const organization: MutualActionItem["organization"] = row.organization === "client" || row.organization === "gando" ? row.organization : "joint";
        return { milestone: text(row.milestone, 1000), workstream, organization, owner: text(row.owner, 300), dueDate: text(row.dueDate, 40), status, dependency: text(row.dependency, 1000) };
      }).filter(item => item.milestone) : [],
      clientCommitments: stringList(source.clientCommitments),
      gandoCommitments: stringList(source.gandoCommitments),
      dependencies: stringList(source.dependencies),
      risks: stringList(source.risks),
      blockers: stringList(source.blockers),
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
    const executiveMessage = text(source.executiveMessage || source.offerSummary);
    const result: SD04Content = {
      deckTitle: text(source.deckTitle, 500),
      deckSubtitle: text(source.deckSubtitle, 1000),
      executiveMessage,
      problem: stringList(source.problem ?? source.assumptions),
      solution: stringList(source.solution),
      differentiators: stringList(source.differentiators),
      proofPoints: stringList(source.proofPoints),
      rolloutPlan: stringList(source.rolloutPlan),
      callToAction: text(source.callToAction),
      offerSummary: text(source.offerSummary || executiveMessage),
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
    const contractStatus: SD05Content["contractStatus"] = source.contractStatus === "internal_review" || source.contractStatus === "client_review" || source.contractStatus === "ready_to_sign" || source.contractStatus === "signed" ? source.contractStatus : "draft";
    const result: SD05Content = {
      contractTitle: text(source.contractTitle, 500),
      contractReference: text(source.contractReference, 300),
      contractVersion: text(source.contractVersion, 100),
      contractUrl: text(source.contractUrl, 2000),
      contractStatus,
      contractSummary: text(source.contractSummary),
      effectiveDate: text(source.effectiveDate, 40),
      term: text(source.term, 500),
      renewal: text(source.renewal, 500),
      terminationNotice: text(source.terminationNotice, 500),
      signatureDeadline: text(source.signatureDeadline, 40),
      legalItems: Array.isArray(source.legalItems) ? source.legalItems.slice(0, 80).map(item => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
        const status: SD05Content["legalItems"][number]["status"] = row.status === "approved" || row.status === "in_review" ? row.status : "open";
        return { topic: text(row.topic, 500), status, owner: text(row.owner, 300), notes: text(row.notes, 1000) };
      }).filter(item => item.topic) : [],
      signatories: Array.isArray(source.signatories) ? source.signatories.slice(0, 30).map(item => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
        const signatureStatus: SD05Content["signatories"][number]["signatureStatus"] = row.signatureStatus === "sent" || row.signatureStatus === "signed" ? row.signatureStatus : "pending";
        return { name: text(row.name, 300), role: text(row.role, 300), organization: text(row.organization, 300), email: text(row.email, 500), signatureStatus };
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
