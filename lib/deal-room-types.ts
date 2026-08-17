// Types partagés de la Deal Room (client + serveur).
// Le serveur (lib/hubspot/deals.ts) construit ces objets, les vues client les consomment.

export type DealRoomHealth = "on_track" | "attention" | "at_risk";

export type DealRoomQuickView =
  | "all"
  | "hot"
  | "at_risk"
  | "closing_soon"
  | "highest_value"
  | "no_activity"
  | "meeting_this_week";

export interface DealScoreBreakdown {
  /** /25 */
  economic: number;
  /** /25 */
  strategic: number;
  /** /25 */
  momentum: number;
  /** /25 (risque inversé : plus c'est haut, moins il y a de risque) */
  health: number;
}

export interface DealRoomContact {
  id: string;
  name: string;
  jobtitle: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  lastActivityAt: string | null;
}

export interface DealRoomCompany {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  city: string | null;
}

export interface DealRoomDeal {
  id: string;
  name: string;
  amount: number | null;
  currency: string | null;
  closeDate: string | null;
  createdDate: string | null;
  stageId: string | null;
  stageLabel: string | null;
  stageProbability: number | null;
  pipelineId: string | null;
  pipelineLabel: string | null;
  ownerId: string | null;
  ownerName: string | null;
  hsNextStep: string | null;
  nextActivityDate: string | null;
  lastActivityAt: string | null;
  daysSinceLastActivity: number | null;
  closed: boolean;
  closedWon: boolean;
  company: DealRoomCompany | null;
  contacts: DealRoomContact[];
  championId: string | null;
  decisionMakerId: string | null;
  championIdentified: boolean;
  championName: string | null;
  decisionMakerIdentified: boolean;
  decisionMakerName: string | null;
  strategic: boolean;
  strategicReason: string;
  potentialArr: number | null;
  potentialVolume: number | null;
  blockers: string[];
  detectedBlockers: string[];
  meetingPlanned: boolean;
  nextMeetingAt: string | null;
  nextTaskDueAt: string | null;
  nextTaskSubject: string | null;
  openTasksCount: number;
  recentNoShowOrCancelled: boolean;
  score: number;
  priorityScore: number;
  priorityExplanation: string;
  health: DealRoomHealth;
  healthReason: string;
  breakdown: DealScoreBreakdown;
  scoreReasons: Array<{ text: string; tone: "good" | "warn" | "bad" | "neutral" }>;
  hubspotUrl: string | null;
}

export interface DealRoomKPIs {
  pipelineValue: number;
  activeDeals: number;
  atRisk: number;
  noNextAction: number;
  noMeeting: number;
  closingSoon: number;
  wonThisMonth: number;
  wonThisMonthValue: number;
  lostThisMonth: number;
  weightedForecast: number;
}

export interface DealRoomListResponse {
  generatedAt: string;
  kpis: DealRoomKPIs;
  results: DealRoomDeal[];
  total: number;
}

export type StakeholderRole =
  | "Champion"
  | "Decision Maker"
  | "Economic Buyer"
  | "Technical"
  | "Legal"
  | "Operational"
  | "Blocker";

export interface Stakeholder {
  id: string;
  name: string;
  jobtitle: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  influence: "strong" | "medium" | "low";
  roles: StakeholderRole[];
  lastActivityAt: string | null;
  hubspotUrl: string | null;
}

export interface NextStepItem {
  id: string;
  kind: "task" | "meeting" | "next_step";
  subject: string;
  detail: string | null;
  dueAt: string | null;
  ownerId: string | null;
  ownerName: string | null;
  status: string | null;
  type: string | null;
}

export interface DealMeeting {
  id: string;
  title: string;
  startAt: string | null;
  endAt: string | null;
  outcome: "SCHEDULED" | "COMPLETED" | "RESCHEDULED" | "NO_SHOW" | "CANCELED" | "UNREVIEWED";
  ownerId: string | null;
  ownerName: string | null;
  participants: string[];
  notes: string | null;
  decided: string | null;
  objections: string | null;
  commitments: string | null;
  nextAction: string | null;
  nextActionAt: string | null;
  hubspotUrl: string | null;
}

export interface DealMeetingsGroup {
  upcoming: DealMeeting[];
  completed: DealMeeting[];
  noShow: DealMeeting[];
  cancelled: DealMeeting[];
}

export type TimelineKind = "note" | "call" | "meeting" | "task" | "email";

export interface TimelineItem {
  id: string;
  kind: TimelineKind;
  title: string;
  at: string;
  body: string | null;
  actor: string | null;
  hubspotUrl: string | null;
}

export interface IntelligenceField {
  key: string;
  label: string;
  values: string[];
  empty: boolean;
}

export interface DealIntelligence {
  fields: IntelligenceField[];
  mustKnow: string[];
  recommendedAction: string;
  recommendedActionReason: string;
}

export type ClosingPlanStatus = "done" | "in_progress" | "not_started";

export interface ClosingPlanStep {
  key: string;
  label: string;
  status: ClosingPlanStatus;
  targetAt: string | null;
  gandoOwnerId: string | null;
  gandoOwnerName: string | null;
  clientOwner: string | null;
  notes: string | null;
  relatedTasks: Array<{ id: string; subject: string; status: string | null; dueAt: string | null }>;
}

export interface ClosingPlan {
  steps: ClosingPlanStep[];
  doneCount: number;
  inProgressCount: number;
  total: number;
  progressLabel: string;
}

export interface DealDocument {
  id: string;
  kind: string;
  title: string;
  at: string | null;
  url: string | null;
  source: string;
  snippet: string | null;
}

export type DealRoomDetail = DealRoomDeal & {
  overviewMissing: string[];
  stakeholders: Stakeholder[];
  nextSteps: NextStepItem[];
  meetings: DealMeetingsGroup;
  timeline: TimelineItem[];
  intelligence: DealIntelligence;
  closingPlan: ClosingPlan;
  documents: DealDocument[];
  stageOptions: Array<{ id: string; label: string; probability: number | null }>;
  contactsForAssociation: DealRoomContact[];
};

export type DealRoomAction =
  | "log_call"
  | "note"
  | "task"
  | "meeting"
  | "stage"
  | "next_step"
  | "blocker"
  | "contact"
  | "stakeholder_role"
  | "closing_plan";

export interface DealRoomActionInput {
  action: DealRoomAction;
  outcome?: string;
  notes?: string;
  duration?: number;
  contactId?: string;
  contactIds?: string[];
  followUp?: boolean;
  followUpAt?: string;
  subject?: string;
  dueAt?: string;
  taskType?: string;
  priority?: string;
  ownerId?: string;
  title?: string;
  startAt?: string;
  endAt?: string;
  stageId?: string;
  nextStep?: string;
  blocker?: string;
  role?: StakeholderRole;
  stepKey?: string;
  stepStatus?: ClosingPlanStatus;
}