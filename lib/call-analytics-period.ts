import type { CallAnalyticsRange } from "@/lib/call-analytics-types";
const PARIS_TZ = "Europe/Paris";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class InvalidAnalyticsPeriod extends Error {}
function day(iso: string) { return new Date(iso + "T12:00:00Z"); }
export function shiftDay(date: string, difference: number) {
  const d = day(date);
  d.setUTCDate(d.getUTCDate() + difference);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string) {
  return Math.round((day(b).getTime() - day(a).getTime()) / 86400000);
}
function parisToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: PARIS_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return map.year + "-" + map.month + "-" + map.day;
}
function validateDate(value: string) {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function getCallAnalyticsRange(mode: string, customFrom?: string | null, customTo?: string | null): CallAnalyticsRange {
  const today = parisToday();
  const weekday = (day(today).getUTCDay() + 6) % 7;
  let from = today;
  let to = today;
  if (mode === "today") {
    from = today;
  } else if (mode === "yesterday") {
    from = to = shiftDay(today, -1);
  } else if (mode === "week") {
    from = shiftDay(today, -weekday);
  } else if (mode === "last_week") {
    to = shiftDay(today, -weekday - 1);
    from = shiftDay(to, -6);
  } else if (mode === "last7") {
    from = shiftDay(today, -6);
  } else if (mode === "last30") {
    from = shiftDay(today, -29);
  } else if (mode === "month") {
    from = today.slice(0, 7) + "-01";
  } else if (mode === "custom") {
    if (!customFrom || !customTo || !validateDate(customFrom) || !validateDate(customTo)) throw new InvalidAnalyticsPeriod("Choisissez deux dates valides.");
    from = customFrom;
    to = customTo;
  } else {
    throw new InvalidAnalyticsPeriod("Période inconnue.");
  }
  const length = daysBetween(from, to) + 1;
  if (length < 1 || length > 90 || to > today) throw new InvalidAnalyticsPeriod("La période doit être passée, comprise entre 1 et 90 jours.");
  return { from, to, previousFrom: shiftDay(from, -length), previousTo: shiftDay(from, -1) };
}
export function parisMidnightEpoch(ymd: string): number {
  // Convert local midnight in Europe/Paris to UTC, including winter/summer DST.
  const midnightUtc = new Date(ymd + "T00:00:00Z").getTime();
  const name = new Intl.DateTimeFormat("en-US", { timeZone: PARIS_TZ, timeZoneName: "shortOffset" })
    .formatToParts(new Date(midnightUtc)).find(p => p.type === "timeZoneName")?.value || "GMT+0";
  const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const offset = match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] || 0)) : 0;
  return midnightUtc - offset * 60000;
}
export function epochBounds(from: string, to: string) {
  return { from: parisMidnightEpoch(from), toExclusive: parisMidnightEpoch(shiftDay(to, 1)) };
}
