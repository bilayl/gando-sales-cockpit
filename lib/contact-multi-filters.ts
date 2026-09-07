export type ContactFilterKey =
  | "zip"
  | "city"
  | "state"
  | "country"
  | "owner"
  | "prospectionStatus"
  | "company"
  | "priority"
  | "callStatus"
  | "fleetSize";

export type ContactFilters = Partial<Record<ContactFilterKey, string[]>>;

export const CONTACT_FILTER_LABELS: Record<ContactFilterKey, string> = {
  zip: "Code postal",
  city: "Ville",
  state: "Région",
  country: "Pays",
  owner: "Commercial",
  prospectionStatus: "Statut prospection",
  company: "Entreprise",
  priority: "Priorité",
  callStatus: "Statut d’appel",
  fleetSize: "Taille de flotte",
};

const FILTER_KEYS = Object.keys(CONTACT_FILTER_LABELS) as ContactFilterKey[];

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalized(value: unknown) {
  return clean(value).toLocaleLowerCase("fr-FR");
}

function propertyValues(properties: Record<string, string | null | undefined>, key: ContactFilterKey) {
  switch (key) {
    case "zip":
      return [properties.zip];
    case "city":
      return [properties.city];
    case "state":
      return [properties.state];
    case "country":
      return [properties.country];
    case "owner":
      return [properties.hubspot_owner_id];
    case "prospectionStatus":
      return [properties.statut_prospection];
    case "company":
      return [properties.company, properties.hs_parent_company_name];
    case "priority":
      return [properties.db_call_bucket];
    case "callStatus":
      return [properties.statut_de_lappel];
    case "fleetSize":
      return [properties.taille_de_flo, properties.taille_flotte];
    default:
      return [];
  }
}

export function sanitizeContactFilters(input: unknown): ContactFilters {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const result: ContactFilters = {};

  for (const key of FILTER_KEYS) {
    const raw = source[key];
    if (!Array.isArray(raw)) continue;
    const values = [...new Set(raw.map(clean).filter(Boolean))].slice(0, 100);
    if (values.length) result[key] = values;
  }

  return result;
}

export function contactMatchesFilters(
  properties: Record<string, string | null | undefined>,
  filters: ContactFilters,
) {
  return FILTER_KEYS.every(key => {
    const selected = filters[key];
    if (!selected?.length) return true;
    const actual = propertyValues(properties, key).map(normalized).filter(Boolean);
    if (!actual.length) return false;
    const wanted = selected.map(normalized);
    return wanted.some(value => actual.includes(value));
  });
}

export function activeContactFilterCount(filters: ContactFilters) {
  return FILTER_KEYS.filter(key => filters[key]?.length).length;
}

export function contactFilterSummary(filters: ContactFilters) {
  return FILTER_KEYS
    .filter(key => filters[key]?.length)
    .map(key => {
      const values = filters[key] || [];
      const preview = values.slice(0, 2).join(", ");
      const extra = values.length > 2 ? ` +${values.length - 2}` : "";
      return `${CONTACT_FILTER_LABELS[key]}: ${preview}${extra}`;
    });
}
