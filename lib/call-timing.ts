export type CallTiming = {
  timezone: string | null;
  localTime: string | null;
  callNow: boolean;
  recommendedWindows: string[];
  confidence: "high" | "medium" | "low";
  reason: string;
};

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function resolveProspectTimezone(properties: Record<string, string | null | undefined>) {
  const explicit = String(properties.timezone || properties.time_zone || properties.hs_timezone || "").trim();
  if (explicit) {
    try {
      new Intl.DateTimeFormat("fr-FR", { timeZone: explicit }).format(new Date());
      return { timezone: explicit, source: "crm_timezone" as const };
    } catch {
      // Continue with deterministic location and phone fallbacks.
    }
  }

  const country = normalize(properties.country || properties.pays);
  const state = normalize(properties.state || properties.region);
  const city = normalize(properties.city);
  const phone = String(properties.phone || properties.mobilephone || "").replace(/[\s().-]/g, "");
  const place = `${country} ${state} ${city}`;

  if (phone.startsWith("+689") || place.includes("polynesie") || place.includes("tahiti")) return { timezone: "Pacific/Tahiti", source: "location" as const };
  if (phone.startsWith("+590") || place.includes("guadeloupe") || place.includes("saint martin")) return { timezone: "America/Guadeloupe", source: "location" as const };
  if (phone.startsWith("+596") || place.includes("martinique")) return { timezone: "America/Martinique", source: "location" as const };
  if (phone.startsWith("+594") || place.includes("guyane") || place.includes("french guiana")) return { timezone: "America/Cayenne", source: "location" as const };
  if (phone.startsWith("+262") || place.includes("reunion") || place.includes("mayotte")) return { timezone: place.includes("mayotte") ? "Indian/Mayotte" : "Indian/Reunion", source: "location" as const };
  if (phone.startsWith("+687") || place.includes("nouvelle caledonie") || place.includes("new caledonia")) return { timezone: "Pacific/Noumea", source: "location" as const };
  if (phone.startsWith("+33") || country === "france" || country === "fr") return { timezone: "Europe/Paris", source: "location" as const };

  return { timezone: null, source: "unknown" as const };
}

function localParts(timezone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || "";
  return {
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    display: `${get("hour")}:${get("minute")}`,
  };
}

export function getBestCallTimeForProperties(
  properties: Record<string, string | null | undefined>,
  date = new Date(),
): CallTiming {
  const resolved = resolveProspectTimezone(properties);
  const recommendedWindows = ["09:30-12:00", "14:00-17:00"];
  if (!resolved.timezone) {
    return {
      timezone: null,
      localTime: null,
      callNow: false,
      recommendedWindows,
      confidence: "low",
      reason: "Fuseau horaire inconnu : localisation à compléter avant l’appel.",
    };
  }

  const local = localParts(resolved.timezone, date);
  const minutes = local.hour * 60 + local.minute;
  const weekday = !["Sat", "Sun"].includes(local.weekday);
  const morning = minutes >= 9 * 60 + 30 && minutes < 12 * 60;
  const afternoon = minutes >= 14 * 60 && minutes < 17 * 60;
  const callNow = weekday && (morning || afternoon);

  return {
    timezone: resolved.timezone,
    localTime: local.display,
    callNow,
    recommendedWindows,
    confidence: resolved.source === "crm_timezone" ? "high" : "medium",
    reason: callNow
      ? "Bonne fenêtre d’appel en heure locale."
      : weekday
        ? "Hors de la fenêtre d’appel locale."
        : "Week-end dans le fuseau du prospect.",
  };
}
