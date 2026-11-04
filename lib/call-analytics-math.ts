import type { CallMetric, CallMetrics, CallMetricKey, CallStatsRow } from "@/lib/call-analytics-types";

export function metric(value: number, previous: number | null, providedChange?: number | null): CallMetric {
  const clean = Number.isFinite(value) ? value : 0;
  const old = previous != null && Number.isFinite(previous) ? previous : null;
  const change = providedChange != null && Number.isFinite(providedChange) ? providedChange
    : old != null && old !== 0 ? (clean - old) / Math.abs(old) : null;
  return { value: clean, previous: old, change };
}
export const emptyMetrics = (): CallMetrics => ({
  calls: metric(0, 0),
  talkSeconds: metric(0, 0),
  longCalls: metric(0, 0),
  answerRate: metric(0, 0),
});
export function fromAlloMetric(value: unknown): CallMetric {
  const o = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const current = Number(o.value ?? 0);
  const prev = o.previous == null ? null : Number(o.previous);
  const delta = o.change == null ? null : Number(o.change);
  return metric(current, prev, delta);
}
export function row(id: string, name: string, subtitle: string | null, data: CallMetrics): CallStatsRow {
  return { id, name, subtitle, metrics: data };
}
export const metricKeys: CallMetricKey[] = ["calls", "talkSeconds", "longCalls", "answerRate"];
type CallRecord = {
  ownerKey: string; ownerName: string; ownerSubtitle: string | null;
  phoneKey: string; phoneName: string;
  direction: string;
  answered: boolean; talkSeconds: number; durationSeconds: number;
};
function aggregate(records: CallRecord[]): [number, number, number, number] {
  const answered = records.filter(r => r.answered);
  const talk = records.reduce((sum, r) => sum + r.talkSeconds, 0);
  const long = records.filter(r => r.talkSeconds >= 60).length;
  return [records.length, talk, long, records.length ? answered.length / records.length : 0];
}
export function metricsFromRecords(current: CallRecord[], previous: CallRecord[]): CallMetrics {
  const a = aggregate(current), b = aggregate(previous);
  return { calls: metric(a[0],b[0]), talkSeconds:metric(a[1],b[1]), longCalls:metric(a[2],b[2]), answerRate:metric(a[3],b[3]) };
}
export function recordsBreakdown(current: CallRecord[], previous: CallRecord[], by: "user"|"phone"): CallStatsRow[] {
  const key = (r: CallRecord) => by === "user" ? r.ownerKey : r.phoneKey;
  const groups = new Set([...current.map(key), ...previous.map(key)]);
  return [...groups].map(id => {
    const items = current.filter(r => key(r) === id);
    const prev = previous.filter(r => key(r) === id);
    const member = items[0] || prev[0];
    return row(id, by === "user" ? member.ownerName : member.phoneName, by === "user" ? member.ownerSubtitle : null, metricsFromRecords(items,prev));
  }).sort((a,b) => b.metrics.calls.value - a.metrics.calls.value || a.name.localeCompare(b.name,"fr"));
}
export type { CallRecord };
