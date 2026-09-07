export type ProspectCallTiming = {
  timezone: string;
  timezoneSource: "company" | "location" | "phone" | "fallback";
  timezoneConfidence: "high" | "medium" | "low";
  localTimeLabel: string;
  isCallableNow: boolean;
  score: number;
  label: string;
  nextBestCallAt: string | null;
  nextBestLocalLabel: string | null;
};

type Properties = Record<string, string | null | undefined>;

const LOCATION_TIMEZONES: Array<{ needles: string[]; timezone: string }> = [
  { needles: ["guadeloupe", "pointe a pitre", "les abymes", "971"], timezone: "America/Guadeloupe" },
  { needles: ["martinique", "fort de france", "972"], timezone: "America/Martinique" },
  { needles: ["guyane", "french guiana", "cayenne", "973"], timezone: "America/Cayenne" },
  { needles: ["la reunion", "reunion", "saint denis reunion", "974"], timezone: "Indian/Reunion" },
  { needles: ["mayotte", "mamoudzou", "976"], timezone: "Indian/Mayotte" },
  { needles: ["nouvelle caledonie", "new caledonia", "noumea", "988"], timezone: "Pacific/Noumea" },
  { needles: ["polynesie francaise", "french polynesia", "tahiti", "papeete", "987"], timezone: "Pacific/Tahiti" },
  { needles: ["saint martin", "marigot"], timezone: "America/Marigot" },
  { needles: ["saint barthelemy", "st barthelemy", "gustavia"], timezone: "America/St_Barthelemy" },
  { needles: ["royaume uni", "united kingdom", "london"], timezone: "Europe/London" },
  { needles: ["portugal", "lisbon", "lisbonne"], timezone: "Europe/Lisbon" },
  { needles: ["espagne", "spain", "madrid"], timezone: "Europe/Madrid" },
  { needles: ["italie", "italy", "rome"], timezone: "Europe/Rome" },
  { needles: ["allemagne", "germany", "berlin"], timezone: "Europe/Berlin" },
  { needles: ["belgique", "belgium", "brussels", "bruxelles"], timezone: "Europe/Brussels" },
  { needles: ["pays bas", "netherlands", "amsterdam"], timezone: "Europe/Amsterdam" },
  { needles: ["suisse", "switzerland", "geneve", "zurich"], timezone: "Europe/Zurich" },
  { needles: ["maroc", "morocco", "casablanca", "marrakech"], timezone: "Africa/Casablanca" },
  { needles: ["afrique du sud", "south africa", "johannesburg", "cape town"], timezone: "Africa/Johannesburg" },
  { needles: ["dubai", "united arab emirates", "emirats arabes unis"], timezone: "Asia/Dubai" },
  { needles: ["new york", "miami", "florida"], timezone: "America/New_York" },
  { needles: ["chicago", "illinois"], timezone: "America/Chicago" },
  { needles: ["denver", "colorado"], timezone: "America/Denver" },
  { needles: ["los angeles", "california", "san francisco"], timezone: "America/Los_Angeles" },
  { needles: ["france", "paris", "lyon", "marseille", "lille", "bordeaux", "toulouse", "nantes", "nice"], timezone: "Europe/Paris" },
];

const PHONE_TIMEZONES: Array<{ prefix: string; timezone: string }> = [
  { prefix: "+590", timezone: "America/Guadeloupe" },
  { prefix: "+596", timezone: "America/Martinique" },
  { prefix: "+594", timezone: "America/Cayenne" },
  { prefix: "+262", timezone: "Indian/Reunion" },
  { prefix: "+687", timezone: "Pacific/Noumea" },
  { prefix: "+689", timezone: "Pacific/Tahiti" },
  { prefix: "+44", timezone: "Europe/London" },
  { prefix: "+351", timezone: "Europe/Lisbon" },
  { prefix: "+34", timezone: "Europe/Madrid" },
  { prefix: "+39", timezone: "Europe/Rome" },
  { prefix: "+49", timezone: "Europe/Berlin" },
  { prefix: "+32", timezone: "Europe/Brussels" },
  { prefix: "+41", timezone: "Europe/Zurich" },
  { prefix: "+212", timezone: "Africa/Casablanca" },
  { prefix: "+27", timezone: "Africa/Johannesburg" },
  { prefix: "+971", timezone: "Asia/Dubai" },
  { prefix: "+33", timezone: "Europe/Paris" },
];

function normalize(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

function isValidTimezone(value?: string | null) {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function resolveCompanyTimezone(properties: Properties) {
  const explicit = [
    properties.timezone,
    properties.time_zone,
    properties.hs_timezone,
    properties.company_timezone,
    properties.fuseau_horaire,
  ].find(isValidTimezone);

  if (explicit) {
    return {
      timezone: explicit,
      source: "company" as const,
      confidence: "high" as const,
    };
  }

  const location = normalize([
    properties.address,
    properties.address2,
    properties.zip,
    properties.postal_code,
    properties.city,
    properties.state,
    properties.country,
  ].filter(Boolean).join(" "));

  const locationMatch = LOCATION_TIMEZONES.find(item => item.needles.some(needle => location.includes(normalize(needle))));
  if (locationMatch) {
    return {
      timezone: locationMatch.timezone,
      source: "location" as const,
      confidence: "high" as const,
    };
  }

  const phone = String(properties.phone || properties.mobilephone || "").replace(/[\s().-]/g, "");
  const phoneMatch = PHONE_TIMEZONES.find(item => phone.startsWith(item.prefix));
  if (phoneMatch) {
    return {
      timezone: phoneMatch.timezone,
      source: "phone" as const,
      confidence: "medium" as const,
    };
  }

  return {
    timezone: "Europe/Paris",
    source: "fallback" as const,
    confidence: "low" as const,
  };
}

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || "";
  return {
    weekday: part("weekday"),
    hour: Number(part("hour")),
    minute: Number(part("minute")),
  };
}

function slotScore(date: Date, timezone: string) {
  const { weekday, hour, minute } = localParts(date, timezone);
  if (weekday === "Sat" || weekday === "Sun") return 0;
  const minutes = hour * 60 + minute;

  if (minutes >= 10 * 60 && minutes < 11 * 60 + 30) return 0.98;
  if (minutes >= 14 * 60 + 30 && minutes < 16 * 60 + 30) return 0.95;
  if (minutes >= 11 * 60 + 30 && minutes < 12 * 60) return 0.86;
  if (minutes >= 14 * 60 && minutes < 14 * 60 + 30) return 0.84;
  if (minutes >= 16 * 60 + 30 && minutes < 18 * 60) return 0.82;
  if (minutes >= 9 * 60 && minutes < 10 * 60) return 0.80;
  return 0;
}

function formatLocalTime(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatLocalSlot(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: timezone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function nextBestSlot(now: Date, timezone: string) {
  const stepMs = 15 * 60 * 1000;
  const maxSteps = 8 * 24 * 4;
  for (let step = 1; step <= maxSteps; step += 1) {
    const candidate = new Date(now.getTime() + step * stepMs);
    if (slotScore(candidate, timezone) >= 0.94) return candidate;
  }
  return null;
}

export function getProspectCallTiming(properties: Properties, nowValue: number | Date = Date.now()): ProspectCallTiming {
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue);
  const resolved = resolveCompanyTimezone(properties);
  const score = slotScore(now, resolved.timezone);
  const isCallableNow = score > 0;
  const next = isCallableNow ? null : nextBestSlot(now, resolved.timezone);

  return {
    timezone: resolved.timezone,
    timezoneSource: resolved.source,
    timezoneConfidence: resolved.confidence,
    localTimeLabel: formatLocalTime(now, resolved.timezone),
    isCallableNow,
    score,
    label: score >= 0.94
      ? "Excellent moment pour appeler"
      : score >= 0.82
        ? "Bon moment pour appeler"
        : score > 0
          ? "Créneau d’appel correct"
          : "À appeler plus tard",
    nextBestCallAt: next?.toISOString() || null,
    nextBestLocalLabel: next ? formatLocalSlot(next, resolved.timezone) : null,
  };
}
