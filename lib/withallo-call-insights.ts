import "server-only";
import { withAlloRequest } from "@/lib/withallo";
import { shapeWithAlloCallDetail } from "@/lib/withallo-call-detail";

type Item = { id?: string; result?: string | null; direction?: string | null; summary?: unknown; transcript?: unknown; };
type SearchResult = { data?: Item[]; pagination?: { has_more?: boolean; total_count?: number } };
export type CallAnswerInsights = {
  answered: number;
  missedOrVoicemail: number;
  unknownOutcome: number;
  transcribed: number;
  summarized: number;
  actionedCalls: number;
  actionSuggestions: number;
  checkedCalls: number;
  partial: boolean;
  source: "Allo";
};

export async function getAlloCallInsights(input: {
  from: string; to: string; userId?: string | null; phone?: string | null;
  direction?: "INBOUND" | "OUTBOUND";
}): Promise<CallAnswerInsights> {
  const accumulator: CallAnswerInsights = {
    answered: 0, missedOrVoicemail: 0, unknownOutcome: 0,
    transcribed: 0, summarized: 0, actionedCalls: 0, actionSuggestions: 0,
    checkedCalls: 0, partial: false, source: "Allo",
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
      const outcome = String(entry.result || "").toUpperCase();
      if (outcome === "ANSWERED" || outcome === "TRANSFERRED") accumulator.answered++;
      else if (["VOICEMAIL", "MISSED", "NO_ANSWER", "BUSY", "CANCELED", "FAILED"].includes(outcome)) accumulator.missedOrVoicemail++;
      else accumulator.unknownOutcome++;
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
