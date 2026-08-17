import "server-only";

import { hubspotJson } from "@/lib/hubspot";
import { getBrevoMeetingScope, isBrevoMeeting, isGandoPresentationMeeting } from "@/lib/hubspot/brevo";
import { createTask } from "@/lib/hubspot/tasks";
import { getAllGoogleCalendarEvents, isGoogleConfigured, type GoogleCalendarEvent } from "@/lib/google";
import { applyGoogleOutcomes, GCAL_SYNC_SOURCE, saveGoogleOutcome, type GoogleMeetingStatus } from "@/lib/gcal-status";

export const MEETING_PROPERTIES = [
  "hs_meeting_title",
  "hs_meeting_start_time",
  "hs_meeting_end_time",
  "hs_meeting_location",
  "hs_meeting_location_type",
  "hs_meeting_outcome",
  "hs_meeting_body",
  "hs_meeting_source",
  "hs_internal_meeting_notes",
  "hs_activity_type",
  "hs_object_source_label",
  "hubspot_owner_id",
  "hs_timestamp",
  "hs_createdate",
  "hs_lastmodifieddate",
];

const CONTACT_PROPERTIES = [
  "firstname", "lastname", "email", "phone", "mobilephone", "company", "jobtitle",
  "hubspot_owner_id", "statut_prospection", "lifecyclestage", "hs_lead_status",
  "hs_linkedin_url", "notes_last_updated", "hs_last_sales_activity_timestamp",
  "notes_next_activity_date",
];

const COMPANY_PROPERTIES = [
  "name", "domain", "phone", "city", "industry", "hubspot_owner_id", "tier_compte",
  "notes_last_updated", "hs_last_sales_activity_timestamp", "notes_next_activity_date",
];

const DEAL_PROPERTIES = [
  "dealname", "dealstage", "pipeline", "amount", "closedate", "hubspot_owner_id",
  "hs_next_step", "notes_last_updated", "hs_last_sales_activity_timestamp",
  "notes_next_activity_date", "hs_is_closed_count", "hs_is_closed_won",
];

export type MeetingStatus =
  | "SCHEDULED"
  | "COMPLETED"
  | "RESCHEDULED"
  | "NO_SHOW"
  | "CANCELED"
  | "UNREVIEWED";

export type MeetingView =
  | "all"
  | "today"
  | "upcoming"
  | "completed"
  | "no_show"
  | "canceled"
  | "rescheduled"
  | "no_next_action"
  | "presentation";

type HubSpotObject = {
  id: string;
  properties: Record<string, string | null>;
  createdAt?: string;
  updatedAt?: string;
};

const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const GOOGLE_EVENT_PREFIX = "gcal-";

function googleEventToMeeting(event: GoogleCalendarEvent): HubSpotObject {
  const startValue = event.start?.dateTime || event.start?.date || null;
  const endValue = event.end?.dateTime || event.end?.date || null;
  const attendees = (event.attendees || [])
    .filter(attendee => attendee.email || attendee.displayName)
    .map(attendee => [attendee.displayName, attendee.email].filter(Boolean).join(" <")).join(", ");
  const attendeeEmails = (event.attendees || [])
    .map(attendee => attendee.email?.trim())
    .filter((email): email is string => Boolean(email))
    .join(", ");
  const attendeeNames = (event.attendees || [])
    .map(attendee => attendee.displayName?.trim() || attendee.email?.trim())
    .filter((name): name is string => Boolean(name))
    .join(", ");
  return {
    id: `${GOOGLE_EVENT_PREFIX}${event.id}`,
    properties: {
      hs_meeting_title: event.summary || "Rendez-vous Google",
      hs_meeting_start_time: startValue,
      hs_meeting_end_time: endValue,
      hs_timestamp: startValue,
      hs_meeting_location: event.location || null,
      hubspot_owner_id: null,
      hs_activity_type: "Google Calendar",
      hs_meeting_source: event.creator?.email ? `Google Calendar (${event.creator.email})` : "Google Calendar",
      hs_object_source_label: event.creator?.email || "Google Calendar",
      gcal_attendee_emails: attendeeEmails || null,
      gcal_attendee_names: attendeeNames || null,
      ...(attendees ? { hs_internal_meeting_notes: `Participants : ${attendees}` } : {}),
      is_google_calendar: "true",
    },
    createdAt: startValue || undefined,
  };
}

async function readGoogleCalendarMeetings() {
  const timeMin = new Date();
  timeMin.setFullYear(timeMin.getFullYear() - 2);
  const timeMax = new Date();
  timeMax.setFullYear(timeMax.getFullYear() + 2);
  const events = await getAllGoogleCalendarEvents({
    calendarId: GOOGLE_CALENDAR_ID,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
  });
  const meetings = events.map(googleEventToMeeting);
  await applyGoogleOutcomes(meetings);
  return meetings;
}

export async function readGoogleMeetingsForPeriod(start: Date, end: Date) {
  if (!isGoogleConfigured()) return [];
  try {
    const events = await getAllGoogleCalendarEvents({
      calendarId: GOOGLE_CALENDAR_ID,
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
    });
    const meetings = events.map(googleEventToMeeting);
    await applyGoogleOutcomes(meetings);
    return meetings;
  } catch {
    return [];
  }
}

export type EnrichedMeeting = HubSpotObject & {
  associations: {
    contact: HubSpotObject | null;
    contacts: HubSpotObject[];
    company: HubSpotObject | null;
    companies: HubSpotObject[];
    deal: HubSpotObject | null;
    deals: HubSpotObject[];
  };
  derived: {
    status: MeetingStatus;
    startAt: string | null;
    endAt: string | null;
    isToday: boolean;
    isUpcoming: boolean;
    isAnomaly: boolean;
    nextActionAt: string | null;
    nextActionLabel: string | null;
    lastActivityAt: string | null;
    rebooked: boolean;
    isBrevo: boolean;
    isGoogle: boolean;
    isGandoPresentation: boolean;
  };
};

export type MeetingActionInput = {
  action: "complete" | "no_show" | "cancel" | "next_action" | "reschedule";
  commercialOutcome?: string;
  notes?: string;
  qualified?: boolean;
  nextAction?: string;
  dueAt?: string;
  newStart?: string;
  durationMinutes?: number;
  source?: {
    id: string;
    properties: Record<string, string | null>;
    associations?: {
      contact?: HubSpotObject | null;
      contacts?: HubSpotObject[];
      company?: HubSpotObject | null;
      companies?: HubSpotObject[];
      deal?: HubSpotObject | null;
      deals?: HubSpotObject[];
    };
  };
};

const ASSOCIATION_TYPES = {
  meetingToContact: 200,
  meetingToCompany: 188,
  meetingToDeal: 212,
  taskToContact: 204,
  taskToCompany: 192,
  taskToDeal: 216,
} as const;

const COMMERCIAL_OUTCOMES = new Set([
  "QUALIFIED",
  "INTERESTED",
  "PROPOSAL",
  "SECOND_MEETING",
  "DECISION_MAKER",
  "NURTURE",
  "TOO_EARLY",
  "NOT_QUALIFIED",
  "LOST",
]);

const CONTACT_STATUS_BY_OUTCOME: Record<string, string> = {
  QUALIFIED: "Conversation",
  INTERESTED: "Conversation",
  PROPOSAL: "Conversation",
  SECOND_MEETING: "RDV booké",
  DECISION_MAKER: "Conversation",
  NURTURE: "À recycler",
  TOO_EARLY: "À recycler",
  NOT_QUALIFIED: "Non qualifié",
  LOST: "Perdu",
};

function chunks<T>(values: T[], size = 100) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function dateValue(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parisDayKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function derivedStatus(meeting: HubSpotObject, now: Date): MeetingStatus {
  const raw = meeting.properties.hs_meeting_outcome?.toUpperCase();
  if (["SCHEDULED", "COMPLETED", "RESCHEDULED", "NO_SHOW", "CANCELED"].includes(raw || "")) {
    return raw as MeetingStatus;
  }
  const start = dateValue(meeting.properties.hs_meeting_start_time || meeting.properties.hs_timestamp);
  return start && start.getTime() >= now.getTime() ? "SCHEDULED" : "UNREVIEWED";
}

async function readAllBrevoMeetings() {
  const rows: HubSpotObject[] = [];
  let after: string | undefined;

  do {
    const body: Record<string, unknown> = {
      limit: 200,
      properties: MEETING_PROPERTIES,
      sorts: [{ propertyName: "hs_meeting_start_time", direction: "DESCENDING" }],
    };
    if (after) body.after = after;
    const data = await hubspotJson("/crm/objects/2026-03/meetings/search", {
      method: "POST",
      body: JSON.stringify(body),
    });
    rows.push(...((data.results || []) as HubSpotObject[]));
    after = data.paging?.next?.after ? String(data.paging.next.after) : undefined;
  } while (after && rows.length < 5_000);

  return rows.filter(row => row.properties?.hs_meeting_source !== GCAL_SYNC_SOURCE);
}

async function batchAssociations(ids: string[], toType: "contacts" | "companies" | "deals") {
  const result = new Map<string, string[]>();
  await Promise.all(chunks(unique(ids)).map(async inputIds => {
    try {
      const data = await hubspotJson(`/crm/associations/2026-03/meetings/${toType}/batch/read`, {
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
      // An association family may be unavailable for an old meeting. Keep the meeting visible.
    }
  }));
  return result;
}

async function batchRead(type: "contacts" | "companies" | "deals", ids: string[]) {
  const result = new Map<string, HubSpotObject>();
  const properties = type === "contacts"
    ? CONTACT_PROPERTIES
    : type === "companies" ? COMPANY_PROPERTIES : DEAL_PROPERTIES;

  await Promise.all(chunks(unique(ids)).map(async inputIds => {
    if (!inputIds.length) return;
    try {
      const data = await hubspotJson(`/crm/objects/2026-03/${type}/batch/read`, {
        method: "POST",
        body: JSON.stringify({ properties, inputs: inputIds.map(id => ({ id })) }),
      });
      for (const row of data.results || []) result.set(String(row.id), row as HubSpotObject);
    } catch {
      // Missing/archived associated records must not hide the meeting.
    }
  }));
  return result;
}

async function findContactsByEmails(emails: string[]) {
  const result = new Map<string, HubSpotObject>();
  const uniqueEmails = unique(emails.map(email => email.trim().toLowerCase()));

  await Promise.all(chunks(uniqueEmails, 10).map(async batch => {
    try {
      const data = await hubspotJson("/crm/objects/2026-03/contacts/search", {
        method: "POST",
        body: JSON.stringify({
          limit: batch.length * 2,
          properties: CONTACT_PROPERTIES,
          filterGroups: [{ filters: [{ propertyName: "email", operator: "IN", values: batch }] }],
        }),
      });
      for (const row of data.results || []) {
        const email = String(row.properties?.email || "").trim().toLowerCase();
        if (email) result.set(email, row as HubSpotObject);
      }
    } catch {
      // A search failure must not hide Google events.
    }
  }));

  return result;
}

async function readDealStageLabels() {
  try {
    const property = await hubspotJson("/crm/v3/properties/deals/dealstage");
    return new Map<string, string>((property.options || []).map((option: { value: string; label: string }) => [option.value, option.label]));
  } catch {
    return new Map<string, string>();
  }
}

function latestDate(values: Array<string | null | undefined>) {
  return values
    .map(dateValue)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() || null;
}

function earliestFutureDate(values: Array<string | null | undefined>, now: Date) {
  const dates = values.map(dateValue).filter((value): value is Date => value !== null);
  return dates
    .filter(value => value.getTime() > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime())[0]?.toISOString() || null;
}

function isActiveOpportunity(contact: HubSpotObject | null, deal: HubSpotObject | null) {
  const contactStatus = contact?.properties.statut_prospection?.toLowerCase() || "";
  const contactActive = Boolean(contact) && !["non qualifié", "perdu", "gagné"].includes(contactStatus);
  const dealActive = Boolean(deal) && deal?.properties.hs_is_closed_count !== "1";
  return contactActive || dealActive || (!contact && !deal);
}

async function enrichMeetings(meetings: HubSpotObject[]) {
  const now = new Date();
  const ids = meetings.map(meeting => String(meeting.id));
  const [contactLinks, companyLinks, dealLinks] = await Promise.all([
    batchAssociations(ids, "contacts"),
    batchAssociations(ids, "companies"),
    batchAssociations(ids, "deals"),
  ]);
  const [contacts, companies, deals, dealStageLabels] = await Promise.all([
    batchRead("contacts", unique([...contactLinks.values()].flat())),
    batchRead("companies", unique([...companyLinks.values()].flat())),
    batchRead("deals", unique([...dealLinks.values()].flat())),
    readDealStageLabels(),
  ]);
  const contactsByEmail = await findContactsByEmails(unique(meetings
    .filter(meeting => String(meeting.id).startsWith(GOOGLE_EVENT_PREFIX))
    .flatMap(meeting => (meeting.properties.gcal_attendee_emails || "")
      .split(",")
      .map(email => email.trim().toLowerCase())
      .filter(Boolean))));
  for (const deal of deals.values()) {
    const stage = deal.properties.dealstage;
    if (stage && dealStageLabels.has(stage)) deal.properties.__dealstage_label = dealStageLabels.get(stage) || stage;
  }

  const enriched: EnrichedMeeting[] = meetings.map(meeting => {
    const id = String(meeting.id);
    const isGoogleMeeting = id.startsWith(GOOGLE_EVENT_PREFIX);
    const meetingContacts = (isGoogleMeeting
      ? (meeting.properties.gcal_attendee_emails || "")
        .split(",")
        .map(email => contactsByEmail.get(email.trim().toLowerCase()))
        .filter(Boolean)
      : (contactLinks.get(id) || []).map(contactId => contacts.get(contactId)).filter(Boolean)
    ) as HubSpotObject[];
    const meetingCompanies = (companyLinks.get(id) || []).map(companyId => companies.get(companyId)).filter(Boolean) as HubSpotObject[];
    const meetingDeals = (dealLinks.get(id) || []).map(dealId => deals.get(dealId)).filter(Boolean) as HubSpotObject[];
    const contact = meetingContacts[0] || null;
    const company = meetingCompanies[0] || null;
    const deal = meetingDeals[0] || null;
    const status = derivedStatus(meeting, now);
    const start = dateValue(meeting.properties.hs_meeting_start_time || meeting.properties.hs_timestamp);
    const end = dateValue(meeting.properties.hs_meeting_end_time);
    const isGandoPresentation = isGandoPresentationMeeting(meeting);
    const isBrevo = isBrevoMeeting(meeting) || isGandoPresentation;
    const isGoogle = String(meeting.id).startsWith(GOOGLE_EVENT_PREFIX);
    const nextActionAt = earliestFutureDate([
      contact?.properties.notes_next_activity_date,
      company?.properties.notes_next_activity_date,
      deal?.properties.notes_next_activity_date,
    ], now);
    const nextActionLabel = deal?.properties.hs_next_step || null;
    const isAnomaly = status === "COMPLETED"
      && isActiveOpportunity(contact, deal)
      && !nextActionAt;

    return {
      ...meeting,
      associations: {
        contact,
        contacts: meetingContacts,
        company,
        companies: meetingCompanies,
        deal,
        deals: meetingDeals,
      },
      derived: {
        status,
        startAt: start?.toISOString() || null,
        endAt: end?.toISOString() || null,
        isToday: Boolean(start && parisDayKey(start) === parisDayKey(now)),
        isUpcoming: Boolean(start && start.getTime() >= now.getTime() && status === "SCHEDULED"),
        isAnomaly,
        nextActionAt,
        nextActionLabel,
        lastActivityAt: latestDate([
          contact?.properties.hs_last_sales_activity_timestamp,
          contact?.properties.notes_last_updated,
          company?.properties.hs_last_sales_activity_timestamp,
          company?.properties.notes_last_updated,
          deal?.properties.hs_last_sales_activity_timestamp,
          deal?.properties.notes_last_updated,
          meeting.updatedAt,
        ]),
        rebooked: false,
        isBrevo,
        isGoogle,
        isGandoPresentation,
      },
    } satisfies EnrichedMeeting;
  });

  for (const meeting of enriched) {
    if (meeting.derived.status !== "NO_SHOW" || !meeting.derived.startAt) continue;
    const contactIds = new Set(meeting.associations.contacts.map(contact => contact.id));
    const companyIds = new Set(meeting.associations.companies.map(company => company.id));
    const originalStart = new Date(meeting.derived.startAt).getTime();
    meeting.derived.rebooked = enriched.some(candidate => {
      if (!candidate.derived.startAt || new Date(candidate.derived.startAt).getTime() <= originalStart) return false;
      if (!["SCHEDULED", "COMPLETED"].includes(candidate.derived.status)) return false;
      return candidate.associations.contacts.some(contact => contactIds.has(contact.id))
        || candidate.associations.companies.some(company => companyIds.has(company.id));
    });
  }

  return enriched;
}

function matchesView(meeting: EnrichedMeeting, view: MeetingView) {
  switch (view) {
    case "all": return true;
    case "today": return meeting.derived.isToday;
    case "upcoming": return meeting.derived.isUpcoming;
    case "completed": return meeting.derived.status === "COMPLETED";
    case "no_show": return meeting.derived.status === "NO_SHOW";
    case "canceled": return meeting.derived.status === "CANCELED";
    case "rescheduled": return meeting.derived.status === "RESCHEDULED";
    case "no_next_action": return meeting.derived.isAnomaly;
    case "presentation": return meeting.derived.isGandoPresentation;
  }
}

function metrics(meetings: EnrichedMeeting[]) {
  const completed = meetings.filter(meeting => meeting.derived.status === "COMPLETED").length;
  const noShow = meetings.filter(meeting => meeting.derived.status === "NO_SHOW").length;
  const decided = completed + noShow;
  const completedWithDeal = meetings.filter(meeting => meeting.derived.status === "COMPLETED" && meeting.associations.deal).length;
  const completedWithProposal = meetings.filter(meeting => meeting.derived.status === "COMPLETED" && meeting.associations.deals.some(deal => /proposition|proposal|offre|devis/i.test(deal.properties.__dealstage_label || ""))).length;
  const completedWithWonDeal = meetings.filter(meeting => meeting.derived.status === "COMPLETED" && meeting.associations.deals.some(deal => deal.properties.hs_is_closed_won === "1" || deal.properties.hs_is_closed_won === "true")).length;
  const rebooked = meetings.filter(meeting => meeting.derived.status === "NO_SHOW" && meeting.derived.rebooked).length;
  const presentations = meetings.filter(meeting => meeting.derived.isGandoPresentation).length;

  return {
    booked: meetings.length,
    completed,
    upcoming: meetings.filter(meeting => meeting.derived.isUpcoming).length,
    noShow,
    canceled: meetings.filter(meeting => meeting.derived.status === "CANCELED").length,
    rescheduled: meetings.filter(meeting => meeting.derived.status === "RESCHEDULED").length,
    noNextAction: meetings.filter(meeting => meeting.derived.isAnomaly).length,
    rebooked,
    presentations,
    showRate: decided ? Math.round((completed / decided) * 100) : 0,
    noShowRate: decided ? Math.round((noShow / decided) * 100) : 0,
    opportunityRate: completed ? Math.round((completedWithDeal / completed) * 100) : 0,
    proposalRate: completed ? Math.round((completedWithProposal / completed) * 100) : 0,
    clientRate: completed ? Math.round((completedWithWonDeal / completed) * 100) : 0,
  };
}

export async function loadMeetings() {
  return enrichMeetings(await readAllBrevoMeetings());
}

export async function getMeetingsCockpit(filters: { view?: MeetingView; owner?: string; query?: string } = {}) {
  const view = filters.view || "all";
  const query = filters.query?.trim().toLowerCase();
  const sourceScope = await getBrevoMeetingScope();

  let googleConnected = false;
  let googleMeetings: HubSpotObject[] = [];
  if (isGoogleConfigured()) {
    try {
      googleMeetings = await readGoogleCalendarMeetings();
      googleConnected = true;
    } catch {
      googleConnected = false;
    }
  }

  const enriched = await enrichMeetings([...(await loadMeetings()), ...googleMeetings]);
  const ownerMeetings = enriched.filter(meeting => !filters.owner || meeting.properties.hubspot_owner_id === filters.owner);
  const filtered = ownerMeetings.filter(meeting => {
    if (!matchesView(meeting, view)) return false;
    if (!query) return true;
    const p = meeting.properties;
    const contact = meeting.associations.contact?.properties;
    const company = meeting.associations.company?.properties;
    const deal = meeting.associations.deal?.properties;
    return [
      p.hs_meeting_title,
      contact?.firstname,
      contact?.lastname,
      contact?.email,
      company?.name,
      company?.domain,
      deal?.dealname,
    ].filter(Boolean).join(" ").toLowerCase().includes(query);
  });

  filtered.sort((a, b) => {
    const meetingTime = (meeting: EnrichedMeeting) => dateValue(meeting.derived.startAt)?.getTime()
      ?? dateValue(meeting.properties.hs_createdate)?.getTime()
      ?? 0;
    const left = meetingTime(a);
    const right = meetingTime(b);
    return view === "today" || view === "upcoming" ? left - right : right - left;
  });

  return {
    results: filtered.slice(0, 2_000),
    total: filtered.length,
    metrics: metrics(ownerMeetings),
    sourceScope,
    googleConnected,
  };
}

export async function getTodayMeetingContext(owner?: string) {
  let googleMeetings: HubSpotObject[] = [];
  if (isGoogleConfigured()) {
    try {
      googleMeetings = await readGoogleCalendarMeetings();
    } catch {
      googleMeetings = [];
    }
  }
  const meetings = (await enrichMeetings([...(await readAllBrevoMeetings()), ...googleMeetings]))
    .filter(meeting => !owner || meeting.properties.hubspot_owner_id === owner);
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const todayMeetings = meetings.filter(meeting => meeting.derived.isToday);
  const today = todayMeetings.filter(meeting => meeting.derived.status === "SCHEDULED");
  const followUps = meetings.filter(meeting => {
    const start = dateValue(meeting.derived.startAt)?.getTime() || 0;
    return start >= thirtyDaysAgo && (
      meeting.derived.isAnomaly
      || meeting.derived.status === "NO_SHOW"
      || meeting.derived.status === "CANCELED"
      || meeting.derived.status === "UNREVIEWED"
    ) && !meeting.derived.nextActionAt;
  });
  const actions = [...today, ...followUps.filter(candidate => !today.some(meeting => meeting.id === candidate.id))];
  actions.sort((a, b) => {
    const priority = (meeting: EnrichedMeeting) => meeting.derived.isToday && meeting.derived.status === "SCHEDULED" ? 0 : meeting.derived.status === "NO_SHOW" ? 1 : meeting.derived.status === "CANCELED" ? 2 : 3;
    return priority(a) - priority(b) || (dateValue(a.derived.startAt)?.getTime() || 0) - (dateValue(b.derived.startAt)?.getTime() || 0);
  });

  return {
    actions: actions.slice(0, 12),
    meetingsToday: todayMeetings.length,
    scheduledContactIds: unique(meetings
      .filter(meeting => meeting.derived.isUpcoming)
      .flatMap(meeting => meeting.associations.contacts.map(contact => contact.id))),
    scheduledCompanyNames: unique(meetings
      .filter(meeting => meeting.derived.isUpcoming)
      .flatMap(meeting => meeting.associations.companies.map(company => company.properties.name?.trim().toLowerCase() || ""))),
  };
}

async function getMeeting(id: string) {
  const meeting = await hubspotJson(`/crm/objects/2026-03/meetings/${encodeURIComponent(id)}?properties=${MEETING_PROPERTIES.join(",")}`) as HubSpotObject;
  return (await enrichMeetings([meeting]))[0];
}

function requiredText(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} obligatoire`);
  return normalized;
}

function validFutureDate(value: string | undefined, label: string) {
  const date = dateValue(value);
  if (!date || date.getTime() <= Date.now()) throw new Error(`${label} doit être dans le futur`);
  return date;
}

function taskAssociations(meeting: EnrichedMeeting) {
  const associations: Array<{ id: string; associationTypeId: number }> = [];
  for (const contact of meeting.associations.contacts) associations.push({ id: contact.id, associationTypeId: ASSOCIATION_TYPES.taskToContact });
  for (const company of meeting.associations.companies) associations.push({ id: company.id, associationTypeId: ASSOCIATION_TYPES.taskToCompany });
  for (const deal of meeting.associations.deals) associations.push({ id: deal.id, associationTypeId: ASSOCIATION_TYPES.taskToDeal });
  return associations;
}

function meetingAssociations(meeting: EnrichedMeeting) {
  const associations: Array<{ to: { id: string }; types: Array<{ associationCategory: "HUBSPOT_DEFINED"; associationTypeId: number }> }> = [];
  for (const contact of meeting.associations.contacts) associations.push({ to: { id: contact.id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: ASSOCIATION_TYPES.meetingToContact }] });
  for (const company of meeting.associations.companies) associations.push({ to: { id: company.id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: ASSOCIATION_TYPES.meetingToCompany }] });
  for (const deal of meeting.associations.deals) associations.push({ to: { id: deal.id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: ASSOCIATION_TYPES.meetingToDeal }] });
  return associations;
}

async function updateObject(type: "contacts" | "deals", id: string, properties: Record<string, string>) {
  return hubspotJson(`/crm/objects/2026-03/${type}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
}

function defaultRescheduleCallDueAt() {
  return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
}

async function createNextAction(meeting: EnrichedMeeting, input: MeetingActionInput, warnings: string[], options: { callTask?: boolean } = {}) {
  const nextAction = options.callTask && !input.nextAction?.trim() ? "Appeler pour replacer le rendez-vous" : requiredText(input.nextAction, "Prochaine action");
  const dueAt = options.callTask && !input.dueAt ? defaultRescheduleCallDueAt() : validFutureDate(input.dueAt, "Date de prochaine action");
  const companyName = meeting.associations.company?.properties.name || "Compte sans société";
  const contact = meeting.associations.contact?.properties;
  const contactName = [contact?.firstname, contact?.lastname].filter(Boolean).join(" ");
  const taskType = options.callTask ? "CALL" : /appel|call/i.test(nextAction) ? "CALL" : /mail|email/i.test(nextAction) ? "EMAIL" : "TODO";

  await createTask({
    hs_task_subject: `${nextAction} — ${companyName}${contactName ? ` — ${contactName}` : ""}`,
    hs_task_body: `Action créée depuis le rendez-vous « ${meeting.properties.hs_meeting_title || "Sans titre"} » dans Gando Sales Cockpit.${options.callTask ? " Le rendez-vous n’a pas été honoré : l’appel vise à replacer un créneau." : ""}`,
    hs_timestamp: dueAt.toISOString(),
    hs_task_status: "NOT_STARTED",
    hs_task_priority: "HIGH",
    hs_task_type: taskType,
    ...(meeting.properties.hubspot_owner_id ? { hubspot_owner_id: meeting.properties.hubspot_owner_id } : {}),
  }, taskAssociations(meeting));

  for (const deal of meeting.associations.deals) {
    try {
      await updateObject("deals", deal.id, { hs_next_step: nextAction });
    } catch {
      warnings.push(`La prochaine étape du deal « ${deal.properties.dealname || deal.id} » n’a pas pu être mise à jour.`);
    }
  }
  return { nextAction, dueAt };
}

function appendInternalNote(existing: string | null | undefined, lines: string[]) {
  const stamp = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date());
  return [existing?.trim(), `[Gando — ${stamp}]`, ...lines].filter(Boolean).join("\n");
}

export async function processMeetingAction(id: string, input: MeetingActionInput) {
  let googleOnly = false;
  let meeting: EnrichedMeeting | null = null;
  try {
    meeting = await getMeeting(id);
  } catch {
    meeting = null;
  }
  if (!meeting && input.source) {
    googleOnly = true;
    const source = input.source;
    meeting = {
      id,
      properties: source.properties || {},
      associations: {
        contact: source.associations?.contact || null,
        contacts: source.associations?.contacts || [],
        company: source.associations?.company || null,
        companies: source.associations?.companies || [],
        deal: source.associations?.deal || null,
        deals: source.associations?.deals || [],
      },
      derived: {
        status: "SCHEDULED",
        startAt: source.properties?.hs_meeting_start_time || null,
        endAt: source.properties?.hs_meeting_end_time || null,
        isToday: false,
        isUpcoming: false,
        isAnomaly: false,
        nextActionAt: null,
        nextActionLabel: null,
        lastActivityAt: null,
        rebooked: false,
        isBrevo: false,
        isGoogle: true,
        isGandoPresentation: false,
      },
    };
  }
  if (!meeting) throw new Error("Rendez-vous introuvable");
  const warnings: string[] = [];

  if (input.action === "reschedule") {
    const start = validFutureDate(input.newStart, "Nouvelle date");
    const currentStart = dateValue(meeting.derived.startAt);
    const currentEnd = dateValue(meeting.derived.endAt);
    const inferredDuration = currentStart && currentEnd ? Math.max(15, Math.round((currentEnd.getTime() - currentStart.getTime()) / 60_000)) : 30;
    const duration = Math.min(240, Math.max(15, Number(input.durationMinutes || inferredDuration)));
    const end = new Date(start.getTime() + duration * 60_000);
    const source = meeting.properties;
    const created = await hubspotJson("/crm/objects/2026-03/meetings", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          hs_meeting_title: source.hs_meeting_title || "Rendez-vous replanifié",
          hs_meeting_start_time: start.toISOString(),
          hs_meeting_end_time: end.toISOString(),
          hs_timestamp: start.toISOString(),
          hs_meeting_outcome: "SCHEDULED",
          hs_meeting_source: googleOnly ? GCAL_SYNC_SOURCE : (source.hs_meeting_source || undefined),
          ...(source.hs_meeting_location ? { hs_meeting_location: source.hs_meeting_location } : {}),
          ...(source.hs_meeting_location_type ? { hs_meeting_location_type: source.hs_meeting_location_type } : {}),
          ...(source.hs_activity_type ? { hs_activity_type: source.hs_activity_type } : {}),
          ...(source.hs_meeting_body ? { hs_meeting_body: source.hs_meeting_body } : {}),
          ...(source.hubspot_owner_id ? { hubspot_owner_id: source.hubspot_owner_id } : {}),
        },
        associations: meetingAssociations(meeting),
      }),
    });
    try {
      await hubspotJson(`/crm/objects/2026-03/meetings/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: { hs_meeting_outcome: "RESCHEDULED" } }),
      });
    } catch {
      warnings.push("Le nouveau rendez-vous est créé, mais l’ancien n’a pas pu être marqué comme replanifié.");
    }
    if (googleOnly) {
      const syncWarnings = await saveGoogleOutcome({
        eventId: id.replace(GOOGLE_EVENT_PREFIX, ""),
        status: "RESCHEDULED",
        title: meeting.properties.hs_meeting_title,
        startAt: meeting.properties.hs_meeting_start_time,
        endAt: meeting.properties.hs_meeting_end_time,
        nextAction: `Replanifié le ${start.toISOString().slice(0, 10)}`,
        associations: [],
      });
      warnings.push(...syncWarnings);
    }
    return { meeting: created, warnings };
  }

  if (input.action === "next_action") {
    const action = await createNextAction(meeting, input, warnings);
    return { meeting, taskCreated: true, nextActionAt: action.dueAt.toISOString(), warnings };
  }

  const status = input.action === "complete" ? "COMPLETED" : input.action === "no_show" ? "NO_SHOW" : "CANCELED";
  const isNoShow = status === "NO_SHOW";
  const notes = isNoShow ? (input.notes || "").trim() : requiredText(input.notes, "Notes");
  const commercialOutcome = input.action === "complete" ? requiredText(input.commercialOutcome, "Résultat commercial") : null;
  if (commercialOutcome && !COMMERCIAL_OUTCOMES.has(commercialOutcome)) throw new Error("Résultat commercial invalide");
  const action = await createNextAction(meeting, input, warnings, { callTask: isNoShow });
  const noteLines = [
    `Statut : ${status}`,
    ...(commercialOutcome ? [`Résultat commercial : ${commercialOutcome}`] : []),
    `Notes : ${notes}`,
    `Prochaine action : ${action.nextAction}`,
    `Échéance : ${action.dueAt.toISOString()}`,
  ];

  if (googleOnly) {
    const syncWarnings = await saveGoogleOutcome({
      eventId: id.replace(GOOGLE_EVENT_PREFIX, ""),
      status: status as GoogleMeetingStatus,
      title: meeting.properties.hs_meeting_title,
      startAt: meeting.properties.hs_meeting_start_time,
      endAt: meeting.properties.hs_meeting_end_time,
      notes,
      commercialOutcome,
      nextAction: action.nextAction,
      dueAt: action.dueAt.toISOString(),
      associations: meetingAssociations(meeting),
    });
    warnings.push(...syncWarnings);
  } else {
    await hubspotJson(`/crm/objects/2026-03/meetings/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          hs_meeting_outcome: status,
          hs_internal_meeting_notes: appendInternalNote(meeting.properties.hs_internal_meeting_notes, noteLines),
        },
      }),
    });
  }

  if (commercialOutcome) {
    const contactProperties: Record<string, string> = { statut_prospection: CONTACT_STATUS_BY_OUTCOME[commercialOutcome] };
    if (input.qualified && !["NOT_QUALIFIED", "LOST"].includes(commercialOutcome)) contactProperties.lifecyclestage = "opportunity";
    for (const contact of meeting.associations.contacts) {
      try {
        await updateObject("contacts", contact.id, contactProperties);
      } catch {
        warnings.push(`Le statut du contact ${contact.id} n’a pas pu être mis à jour.`);
      }
    }
  }

  return { meetingId: id, status, taskCreated: true, nextActionAt: action.dueAt.toISOString(), warnings };
}
