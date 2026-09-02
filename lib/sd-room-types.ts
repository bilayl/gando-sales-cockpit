export const SD_CODES = ["SD01", "SD02", "SD03", "SD04", "SD05"] as const;

export type SDCode = (typeof SD_CODES)[number];
export type SDDocumentStatus = "draft" | "review" | "published" | "validated";
export type SDRoomStatus = "draft" | "published" | "archived";
export type SDRoomAccessMode = "email" | "allowlist";
export type SDRoomBrandTheme = "gando" | "gradient" | "dark" | "light";
export type SDRoomMode = "standard" | "enterprise";

export const SD_STAGE_META: Record<SDCode, { title: string; subtitle: string }> = {
  SD01: { title: "Synthèse", subtitle: "Compréhension commune · entreprise, contexte, enjeux, processus et solution fit" },
  SD02: { title: "Prochaines étapes", subtitle: "Décisions, points à trancher et plan d’action partagé" },
  SD03: { title: "Solution & intégration", subtitle: "Étape facultative · périmètre, pilote, données et déploiement" },
  SD04: { title: "Proposition commerciale", subtitle: "Offre en ligne, prix, conditions et accord client" },
  SD05: { title: "Contrat & signature", subtitle: "Contrat, fichier signé et suivi de signature" },
};

export type SD01Stakeholder = {
  name: string;
  role: string;
  organization: string;
  notes: string;
};

export type SD01PainPoint = {
  priority: number;
  title: string;
  details: string[];
};

export type SD01NextStep = {
  owner: string;
  action: string;
  dueDate: string | null;
  status: "not_started" | "in_progress" | "done";
};

export type SD01Evidence = {
  field: string;
  sourceId: string;
  quote: string;
};

export type SD01Metric = {
  lever: string;
  mechanism: string;
  value: string;
  confirmedBy?: string | null;
  confirmedEmail?: string | null;
  confirmedAt?: string | null;
};

export type SD01Content = {
  executiveSummary: string;
  companyProfile: { sector: string; description: string; context: string };
  gandoContext: string;
  stakeholders: SD01Stakeholder[];
  currentProcess: string[];
  productsAndOffers: string[];
  businessModel: string[];
  painPoints: SD01PainPoint[];
  solutionFit: Array<{ need: string; response: string }>;
  roi: {
    valueLevers: SD01Metric[];
    metricsRequired: string[];
  };
  urgency: string[];
  decisions: string[];
  openQuestions: string[];
  nextSteps: SD01NextStep[];
  evidence: SD01Evidence[];
};

export type SDRoomRecord = {
  id: string;
  hubspot_deal_id: string;
  company_hubspot_id: string | null;
  title: string;
  company_name: string;
  crm_link: string | null;
  prospect_logo_url: string | null;
  brand_banner_image_url: string | null;
  brand_theme: SDRoomBrandTheme;
  brand_title: string | null;
  brand_subtitle: string | null;
  meeting_booking_url: string | null;
  room_mode: SDRoomMode;
  share_token: string;
  access_mode: SDRoomAccessMode;
  allowed_emails: string[];
  status: SDRoomStatus;
  current_stage: SDCode;
  created_by_email: string | null;
  published_at: string | null;
  last_shared_at: string | null;
  first_contact_at: string | null;
  proposal_sent_at: string | null;
  proposal_agreed_at: string | null;
  contract_uploaded_at: string | null;
  contract_signed_at: string | null;
  contract_signed_by_email: string | null;
  created_at: string;
  updated_at: string;
};

export type SDDocumentRecord = {
  id: string;
  room_id: string;
  code: SDCode;
  title: string;
  status: SDDocumentStatus;
  content: Record<string, unknown> | SD01Content;
  published_content: Record<string, unknown> | SD01Content | null;
  source_mode: "manual" | "agent" | "mixed";
  version: number;
  published_version: number | null;
  model_name: string | null;
  prompt_version: string | null;
  updated_by_email: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SDSourceConversation = {
  id: string;
  room_id: string;
  source_type: "manual" | "onoff" | "hubspot";
  external_id: string | null;
  title: string;
  transcript_text: string;
  transcript_data: unknown;
  occurred_at: string | null;
  created_by_email: string | null;
  created_at: string;
};

export type LinkedConversation = {
  id: string;
  title: string;
  occurredAt: string | null;
  duration: number | null;
  status: string | null;
  transcriptText: string;
  imported: boolean;
};

export type SDRoomAnalytics = {
  opens: number;
  uniqueVisitors: number;
  activeSeconds: number;
  lastViewedAt: string | null;
  recentVisitors: Array<{ email: string; firstName: string; lastName: string; lastSeenAt: string; activeSeconds: number }>;
};

export type SDRoomComment = {
  id: string;
  room_id: string;
  document_code: SDCode;
  section_key: string | null;
  author_email: string;
  body: string;
  status: "open" | "resolved";
  created_at: string;
  resolved_at: string | null;
  resolved_by_email: string | null;
};

export function createEmptySD01(companyName = ""): SD01Content {
  return {
    executiveSummary: "",
    companyProfile: { sector: "", description: companyName ? `${companyName} — à compléter` : "", context: "" },
    gandoContext: "",
    stakeholders: [],
    currentProcess: [],
    productsAndOffers: [],
    businessModel: [],
    painPoints: [],
    solutionFit: [],
    roi: { valueLevers: [], metricsRequired: [] },
    urgency: [],
    decisions: [],
    openQuestions: [],
    nextSteps: [],
    evidence: [],
  };
}
