import "server-only";
import { withAlloRequest } from "@/lib/withallo";
import { shapeWithAlloCallDetail } from "@/lib/withallo-call-detail";
import { classifyAlloAnswer, isNrP } from "@/lib/call-outcome";

type Item = {
  id?: string; result?: string | null; direction?: string | null;
  summary?: unknown; transcript?: unknown; tags?: unknown;
  call_tags?: unknown; label?: unknown; disposition?: unknown;
  user?: {id?:string}; user_id?: string; allo_number?: string;
};
type SearchResult = { data?: Item[]; pagination?: { has_more?: boolean; total_count?: number } };
export type AnswerGroup = { total: number; answered: number; unanswered: number; nrp: number };
export type CallAnswerInsights = {
  answered: number;
  nrp: number;
  missedOrVoicemail: number;
  unknownOutcome: number;
  transcribed: number;
  summarized: number;
  actionedCalls: number;
  actionSuggestions: number;
  checkedCalls: number;
  partial: boolean;
  source: "Allo";
  byUser: Record<string, AnswerGroup>;
  byPhone: Record<string, AnswerGroup>;
};

export async function getAlloCallInsights(input: {
  from: string; to: string; userId?: string | null; phone?: string | null;
  direction?: "INBOUND" | "OUTBOUND";
}): Promise<CallAnswerInsights> {
  const accumulator: CallAnswerInsights = {
    answered: 0, nrp: 0, missedOrVoicemail: 0, unknownOutcome: 0,
    transcribed: 0, summarized: 0, actionedCalls: 0, actionSuggestions: 0,
    checkedCalls: 0, partial: false, source: "Allo", byUser: {}, byPhone: {},
  };
  const seen = new Set<string>();
  // Hard cap to control API latency and rate limits; a partial report is labelled.
  for (let page = 1; page <= 4; page++) {
    const result = await withAlloRequest<SearchResult>("/v2/api/conversations/items/search", {
      method: "POST",
      body: JSON.stringify({
        type: "CALL", sort: "DATE_DESC", date: { from: input.from, to: input.to },
        ...(input.userId ? { user_id: input.userId } : {}),
        ...(input.phone ? { allo_number: input.phone } : {}),
        ...(input.direction ? { direction: input.direction } : {}),
        page, size: 100, extend: "transcript",
      }),
    });
    const items = Array.isArray(result.data) ? result.data : [];
    for (const entry of items) {
      if (!entry?.id || seen.has(entry.id)) continue;
      seen.add(entry.id);
      const detail = shapeWithAlloCallDetail(entry);
      const outcome = classifyAlloAnswer(entry);
      const nrp = [
        entry.tags, entry.call_tags, entry.label, entry.disposition, entry.result,
      ].some(isNrP);
      if (outcome === "answered") accumulator.answered++;
      else if (outcome === "unanswered") accumulator.missedOrVoicemail++;
      else accumulator.unknownOutcome++;
      if (nrp) accumulator.nrp++;
      for (const [key, id] of [
        ["user", entry.user?.id || entry.user_id || ""],
        ["phone", entry.allo_number || ""],
      ]) {
        if (!id) continue;
        const map = key === "user" ? accumulator.byUser : accumulator.byPhone;
        const group = map[id] || {total: 0, answered: 0, unanswered: 0, nrp: 0};
        group.total++;
        if (outcome === "answered") group.answered++;
        if (outcome === "unanswered") group.unanswered++;
        if (nrp) group.nrp++;
        map[id] = group;
      }
      if (detail.transcriptText || detail.transcript.length) accumulator.transcribed++;
      if (detail.summary) accumulator.summarized++;
      if (detail.actions.length) {
        accumulator.actionedCalls++;
        accumulator.actionSuggestions += detail.actions.length;
      }
      accumulator.checkedCalls++;
    }
    if (!result.pagination?.has_more) break;
    if (page === 4) accumulator.partial = true;
  }
  return accumulator;
}
