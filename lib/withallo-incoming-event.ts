import { normalizeWithAlloDialNumber } from "@/lib/withallo-phone";

type Dict = Record<string, unknown>;
function dict(value: unknown): Dict | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Dict : null;
}

const PRIORITY_KEYS = [
  "from_number", "fromNumber", "caller_number", "callerNumber",
  "caller_phone", "callerPhone", "caller_phone_number", "callerPhoneNumber",
  "caller_id", "callerId", "remote_number", "remoteNumber",
  "external_number", "externalNumber",
  "contact_number", "contactNumber", "phone_number", "phoneNumber",
  "from", "caller", "phone", "number",
] as const;

const NESTED_KEYS = [
  "call", "caller", "from", "contact", "person", "remote",
  "external", "data", "payload", "details", "event",
  "incoming", "incoming_call", "party", "phone",
] as const;

export function incomingEventFields(value: unknown): string[] {
  const record = dict(value);
  return record ? Object.keys(record).slice(0, 18) : [];
}

export function extractIncomingAlloPhone(payload: unknown): string | null {
  if (typeof payload === "string") return normalizeWithAlloDialNumber(payload);
  const queue: unknown[] = [payload];
  const seen = new Set<object>();
  // Follow only fields that may identify the caller; never use to_number
  // or to, which refer to Gando's own line on an incoming call.
  while (queue.length && seen.size < 18) {
    const item = queue.shift();
    const node = dict(item);
    if (!node || seen.has(node)) continue;
    seen.add(node);

    for (const key of PRIORITY_KEYS) {
      const value = node[key];
      if (typeof value === "string") {
        const normalized = normalizeWithAlloDialNumber(value);
        if (normalized) return normalized;
      }
    }
    for (const key of NESTED_KEYS) {
      const value = node[key];
      if (dict(value)) queue.push(value);
    }
  }
  return null;
}
