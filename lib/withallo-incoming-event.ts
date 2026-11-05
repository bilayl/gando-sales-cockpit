import { normalizeWithAlloDialNumber } from "@/lib/withallo-phone";

type Dict = Record<string, unknown>;
function dict(value: unknown): Dict | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Dict : null;
}

const CALLER_KEYS = [
  "from_number", "fromNumber", "caller_number", "callerNumber",
  "caller_phone", "callerPhone", "caller_phone_number", "callerPhoneNumber",
  "caller_id", "callerId", "remote_number", "remoteNumber",
  "external_number", "externalNumber", "from", "caller",
] as const;

const FALLBACK_KEYS = [
  "contact_number", "contactNumber", "phone_number", "phoneNumber",
  "phone", "number",
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
  const nodes: Dict[] = [];
  // Follow only fields that may identify the caller; never use to_number
  // or to, which refer to Gando's own line on an incoming call.
  while (queue.length && seen.size < 18) {
    const item = queue.shift();
    const node = dict(item);
    if (!node || seen.has(node)) continue;
    seen.add(node);
    nodes.push(node);
    for (const key of NESTED_KEYS) {
      const value = node[key];
      if (dict(value)) queue.push(value);
    }
  }
  // Resolve explicit caller/from fields at every nesting level before
  // generic numbers, which can describe the called Gando line.
  for (const keys of [CALLER_KEYS, FALLBACK_KEYS]) {
    for (const node of nodes) {
      for (const key of keys) {
        const value = node[key];
        if (typeof value !== "string") continue;
        const normalized = normalizeWithAlloDialNumber(value);
        if (normalized) return normalized;
      }
    }
  }
  return null;
}

/**
 * Allo's outbound events identify the recipient via "to", not "from"
 * (which is often the Gando/Allo company line). Resolve only known
 * dialed-number fields and validate the complete E.164 number.
 */
export function extractOutgoingAlloPhone(payload: unknown): string | null {
  if (typeof payload === "string") return normalizeWithAlloDialNumber(payload);
  const queue: unknown[] = [payload];
  const seen = new Set<object>();
  const nodes: Dict[] = [];
  const nestedKeys = [
    "call", "to", "callee", "recipient", "contact", "person",
    "data", "payload", "details", "dialer", "event", "target",
  ];
  while (queue.length && seen.size < 18) {
    const item = queue.shift();
    const node = dict(item);
    if (!node || seen.has(node)) continue;
    seen.add(node);
    nodes.push(node);
    for (const key of nestedKeys) {
      const next = node[key];
      if (dict(next)) queue.push(next);
    }
  }
  const prioritized = [
    "to_number", "toNumber", "callee_number", "calleeNumber",
    "dialed_number", "dialedNumber", "recipient_number", "recipientNumber",
    "contact_number", "contactNumber", "to", "callee", "recipient",
  ];
  const fallback = ["phone_number", "phoneNumber", "number", "phone"];
  for (const keys of [prioritized, fallback]) {
    for (const node of nodes) {
      for (const key of keys) {
        const value = node[key];
        if (typeof value !== "string") continue;
        const normalized = normalizeWithAlloDialNumber(value);
        if (normalized) return normalized;
      }
    }
  }
  return null;
}

/**
 * Optional forward compatibility for a dialpad number update event if the
 * embedded provider emits it. The published Allo docs currently guarantee
 * call lifecycle events, not live keypad-change notifications.
 */
export function extractAlloDialpadPhone(payload: unknown): string | null {
  if (typeof payload === "string") return normalizeWithAlloDialNumber(payload);
  const root = dict(payload);
  if (!root) return null;
  const objects = [root, dict(root.data), dict(root.payload), dict(root.dialer), dict(root.input)];
  for (const item of objects) {
    if (!item) continue;
    for (const key of ["phone_number", "phoneNumber", "dialed_number", "dialedNumber", "input_number", "inputNumber", "number", "value"]) {
      const v = item[key];
      if (typeof v !== "string") continue;
      const phone = normalizeWithAlloDialNumber(v);
      if (phone) return phone;
    }
  }
  return null;
}
