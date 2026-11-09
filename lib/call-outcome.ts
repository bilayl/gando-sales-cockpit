/**
 * SDR reporting: a technically connected call is NOT proof that a person
 * answered. Explicit business outcomes (NRP, voicemail, no answer...) take
 * priority over an ANSWERED/TRANSFERRED telephony result.
 *
 * Keep this helper framework-independent so it is easy to regression test.
 */
export type AnswerOutcome = "answered" | "unanswered" | "unknown";
type Dict = Record<string, unknown>;
const record = (value: unknown): Dict =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Dict : {};

function normalized(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[_./-]/g, " ").replace(/\s+/g, " ").trim();
}
function fields(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(item => fields(item));
  const obj = record(value);
  const results: string[] = [];
  for (const name of ["name", "label", "value", "key", "title", "result", "status", "outcome", "disposition"]) {
    if (typeof obj[name] === "string") results.push(obj[name] as string);
  }
  return results;
}
const NEGATIVE = /(?:^| )(?:nrp|non repond(?:u|ue|us|ues)?|ne repond pas|pas de reponse|sans reponse|aucune reponse|no answer|not answered|unanswered|no response|missed|missed call|not reached|unreachable|non joignable|injoignable|busy|occupe|occupee|voicemail|voice mail|left voicemail|answering machine|repondeur|messagerie|failed|failure|echec|canceled|cancelled|annule|annulee|wrong number|mauvais numero)(?: |$)/;
const POSITIVE = /^(answered|connected|meeting booked|meeting scheduled|human answered|person answered|repondu|repondue|decroche|decrochee|conversation|conversation etablie)$/;

export function isNrP(value: unknown): boolean {
  return fields(value).some(item => /(?:^| )nrp(?: |$)/.test(normalized(item)));
}

export function classifyAlloAnswer(call: unknown): AnswerOutcome {
  const obj = record(call);
  const tagLabels = [
    ...fields(obj.tags), ...fields(obj.call_tags), ...fields(obj.labels),
    ...fields(obj.tag), ...fields(obj.call_outcome),
    ...fields(obj.callOutcome), ...fields(obj.disposition),
    ...fields(obj.answer_status), ...fields(obj.answerStatus),
    ...fields(obj.outcome), ...fields(obj.ai_outcome),
  ];
  // Never let an ANSWERED/TRANSFERRED network result override an NRP tag.
  const explicitLabels = [...tagLabels, ...fields(obj.result), ...fields(obj.status)];
  if (explicitLabels.some(value => NEGATIVE.test(" " + normalized(value) + " "))) return "unanswered";
  const technical = normalized(String(obj.result || obj.status || ""));
  if (POSITIVE.test(technical) || technical === "transferred") return "answered";
  if (tagLabels.some(value => POSITIVE.test(normalized(value)))) return "answered";
  return "unknown";
}

const HUBSPOT_CONNECTED = new Set([
  "f240bbac-87c9-4f6e-bf70-924b57d47db7", // Connected
  "2e7360c1-6b71-40e9-ab2b-30ae98a4678c", // Meeting booked
]);
const HUBSPOT_NEGATIVE = new Set([
  "73a0d17f-1163-4015-bdd5-ec830791da20", // No answer
  "9d9162e7-6cf3-4944-bf63-4dff82258764", // Busy
  "17b47fee-58de-441e-a44c-c6300d46f273", // Wrong number
  "b2cf5968-551e-4856-9783-52b3da59a7d0", // Left voicemail
]);

export function classifyHubSpotAnswer(properties: Record<string, string | null | undefined>): AnswerOutcome {
  const status = normalized(properties.hs_call_status || "");
  // HubSpot stores outcomes as UUIDs. Do NOT normalize hyphens away,
  // otherwise a true Connected or No Answer disposition never matches.
  const disposition = (properties.hs_call_disposition || "").trim().toLowerCase();
  const title = normalized(properties.hs_call_title || "");
  const body = normalized(properties.hs_call_body || "");
  const labels = [properties.allo_tags, properties.hs_call_disposition].flatMap(fields);

  // Notes/titles which explicitly START with the SDR's NRP notation are a
  // strong business outcome. Do not interpret every mention in a long note.
  const markedNrP = /^(?:nrp|non repondu|ne repond pas)(?: |$)/.test(title)
    || /^(?:nrp|non repondu|ne repond pas)(?: |$)/.test(body)
    || labels.some(isNrP);
  const noAnswerLabel = labels.some(value => NEGATIVE.test(" " + normalized(value) + " "));
  if (markedNrP || noAnswerLabel || HUBSPOT_NEGATIVE.has(disposition)) return "unanswered";

  if (["missed", "no answer", "busy", "failed", "canceled"].includes(status)) return "unanswered";
  if (normalized(properties.hs_call_has_voicemail || "") === "true") return "unanswered";
  if (["missed", "no", "false"].includes(normalized(properties.hs_inbound_call_answer_status || ""))) return "unanswered";

  // Queued/ringing/in-progress are not customer conversations, even if an
  // outcome was accidentally set to Connected.
  if (status !== "completed") return "unknown";
  if (HUBSPOT_CONNECTED.has(disposition)) return "answered";
  if (["answered", "yes", "true"].includes(normalized(properties.hs_inbound_call_answer_status || ""))) return "answered";
  return "unknown";
}
