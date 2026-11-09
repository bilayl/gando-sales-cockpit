export type CallTiming = {
  timezone: string | null;
  localTime: string | null;
  callNow: boolean;
  recommendedWindows: string[];
  confidence: "high" | "medium" | "low";
  reason: string;
};

export const CALL_TIMEZONE = "Europe/Paris";
export const CALL_WINDOW_START_HOUR = 9;
export const CALL_WINDOW_END_HOUR = 18;
export const CALL_WINDOW_LABEL = "09:00–12:00 et 14:00–18:00";
export const PROSPECT_CALL_WINDOW_LABEL = "09:00–19:00";
const CALL_WINDOWS_MINUTES = [
  { start: 9 * 60, end: 12 * 60 },
  { start: 14 * 60, end: 18 * 60 },
] as const;

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
  const postcode = String(properties.zip || properties.postal_code || properties.postcode || "").trim();
  const place = `${country} ${state} ${city}`;

  if (phone.startsWith("+689") || place.includes("polynesie") || place.includes("tahiti")) return { timezone: "Pacific/Tahiti", source: "location" as const };
  if (/^(?:\+590|00590|0(?:590|690|691))/.test(phone) || postcode.startsWith("971") || place.includes("guadeloupe") || place.includes("saint martin")) return { timezone: "America/Guadeloupe", source: "location" as const };
  if (/^(?:\+596|00596|0(?:596|696|697))/.test(phone) || postcode.startsWith("972") || place.includes("martinique")) return { timezone: "America/Martinique", source: "location" as const };
  if (/^(?:\+594|00594|0(?:594|694))/.test(phone) || postcode.startsWith("973") || place.includes("guyane") || place.includes("french guiana")) return { timezone: "America/Cayenne", source: "location" as const };
  if (/^(?:\+262|00262|0(?:262|692|693))/.test(phone) || postcode.startsWith("974") || postcode.startsWith("976") || place.includes("reunion") || place.includes("mayotte")) return { timezone: postcode.startsWith("976") || place.includes("mayotte") ? "Indian/Mayotte" : "Indian/Reunion", source: "location" as const };
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

// Only the time in France governs the SDR team schedule; the SDR computer
// timezone must never change the decision. The prospect's local hour is checked
// separately to avoid calling very early or very late.
export function isWithinFrenchCallWindow(date = new Date()) {
  const france = localParts(CALL_TIMEZONE, date);
  const minutes = france.hour * 60 + france.minute;
  return !["Sat", "Sun"].includes(france.weekday)
    && CALL_WINDOWS_MINUTES.some(window => minutes >= window.start && minutes < window.end);
}

export function getBestCallTimeForProperties(
  properties: Record<string, string | null | undefined>,
  date = new Date(),
): CallTiming {
  const resolved = resolveProspectTimezone(properties);
  const frenchTime = localParts(CALL_TIMEZONE, date);
  const frenchWeekday = !["Sat", "Sun"].includes(frenchTime.weekday);
  const prospectTime = resolved.timezone ? localParts(resolved.timezone, date) : null;
  const franceWindowOpen = isWithinFrenchCallWindow(date);
  // If the prospect timezone is known, protect their local rest time too.
  // Do not exclude unknown-timezone contacts from browsing or preparation.
  const prospectMinutes = prospectTime ? prospectTime.hour * 60 + prospectTime.minute : null;
  const prospectWindowOpen = !prospectTime || (
    !["Sat", "Sun"].includes(prospectTime.weekday)
    && prospectMinutes !== null && prospectMinutes >= 9 * 60 && prospectMinutes < 19 * 60
  );
  const callNow = franceWindowOpen && prospectWindowOpen;
  return {
    timezone: resolved.timezone,
    localTime: prospectTime?.display ?? null,
    callNow,
    recommendedWindows: ["09:00–12:00", "14:00–18:00"],
    confidence: resolved.source === "crm_timezone" ? "high" : resolved.timezone ? "medium" : "low",
    reason: callNow
      ? `Appel possible : créneau France ${CALL_WINDOW_LABEL}, horaire raisonnable chez le prospect.`
      : !franceWindowOpen
        ? frenchWeekday
          ? `Appels à préparer : créneaux France ${CALL_WINDOW_LABEL}. La fiche reste accessible.`
          : "Appels fermés le week-end en France. La fiche reste accessible."
        : `Trop tôt ou trop tard chez le prospect (appels entre ${PROSPECT_CALL_WINDOW_LABEL}, heure locale). La fiche reste accessible.`,
  };
}

// The session remains accessible 24/7. Only outbound dialing uses the local
// time of the prospect (not the SDR's location or another SDR's assignment).
// When CRM geography is missing, France is a conservative fallback, explicitly
// indicated in the UI so the SDR can verify the country before calling.
export function getSessionCallTimeForProperties(
  properties: Record<string, string | null | undefined>,
  date = new Date(),
): CallTiming {
  const resolved = resolveProspectTimezone(properties);
  const timezone = resolved.timezone || CALL_TIMEZONE;
  const local = localParts(timezone, date);
  const minutes = local.hour * 60 + local.minute;
  const weekday = !["Sat", "Sun"].includes(local.weekday);
  const callNow = weekday && minutes >= 9 * 60 && minutes < 19 * 60;
  const fallbackNotice = resolved.timezone ? "" : " Fuseau non renseigné : heure de Paris utilisée par défaut, localisation à confirmer.";
  return {
    timezone,
    localTime: local.display,
    callNow,
    recommendedWindows: [PROSPECT_CALL_WINDOW_LABEL],
    confidence: resolved.source === "crm_timezone" ? "high" : resolved.timezone ? "medium" : "low",
    reason: callNow
      ? `Appel possible entre ${PROSPECT_CALL_WINDOW_LABEL} chez le prospect.${fallbackNotice}`
      : `À appeler plus tard : ${local.display} chez le prospect (${timezone}). Appels prévus entre ${PROSPECT_CALL_WINDOW_LABEL} du lundi au vendredi. Fiche et session disponibles.${fallbackNotice}`,
  };
}
