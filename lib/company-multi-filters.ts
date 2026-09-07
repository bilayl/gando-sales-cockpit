export type CompanyFilterKey =
  | "location"
  | "zip"
  | "city"
  | "state"
  | "country"
  | "industry"
  | "owner"
  | "stage"
  | "prospectionStatus"
  | "callStatus"
  | "fleetSize";

export type CompanyFilters = Partial<Record<CompanyFilterKey, string[]>>;

export const COMPANY_FILTER_LABELS: Record<CompanyFilterKey, string> = {
  location: "Localisation",
  zip: "Code postal",
  city: "Ville",
  state: "Région",
  country: "Pays",
  industry: "Secteur",
  owner: "Commercial",
  stage: "Statut",
  prospectionStatus: "Statut prospection",
  callStatus: "Statut d’appel",
  fleetSize: "Taille de flotte",
};

export const COMPANY_FILTER_KEYS = Object.keys(COMPANY_FILTER_LABELS) as CompanyFilterKey[];

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalized(value: unknown) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/\s+/g, " ")
    .trim();
}

function locationValues(properties: Record<string, string | null | undefined>) {
  return [
    properties.zip,
    properties.postal_code,
    properties.city,
    properties.state,
    properties.country,
  ];
}

export function companyPropertyValues(
  properties: Record<string, string | null | undefined>,
  key: CompanyFilterKey,
  stage?: string,
) {
  switch (key) {
    case "location": return locationValues(properties);
    case "zip": return [properties.zip, properties.postal_code];
    case "city": return [properties.city];
    case "state": return [properties.state];
    case "country": return [properties.country];
    case "industry": return [properties.industry];
    case "owner": return [properties.hubspot_owner_id];
    case "stage": return [stage];
    case "prospectionStatus": return [properties.statut_prospection, properties.prospecting_status];
    case "callStatus": return [properties.statut_de_lappel, properties.qualification_last_call_status];
    case "fleetSize": return [properties.taille_flotte, properties.taille_de_flo];
    default: return [];
  }
}

export function sanitizeCompanyFilters(input: unknown): CompanyFilters {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const result: CompanyFilters = {};

  for (const key of COMPANY_FILTER_KEYS) {
    const raw = source[key];
    if (!Array.isArray(raw)) continue;
    const values = [...new Set(raw.map(clean).filter(Boolean))].slice(0, 100);
    if (values.length) result[key] = values;
  }

  return result;
}

export function companyMatchesFilters(
  properties: Record<string, string | null | undefined>,
  filters: CompanyFilters,
  stage?: string,
) {
  return COMPANY_FILTER_KEYS.every(key => {
    const selected = filters[key];
    if (!selected?.length) return true;
    const actual = companyPropertyValues(properties, key, stage).map(normalized).filter(Boolean);
    if (!actual.length) return false;
    const wanted = selected.map(normalized);
    return wanted.some(value => actual.includes(value));
  });
}

export function activeCompanyFilterCount(filters: CompanyFilters) {
  return COMPANY_FILTER_KEYS.filter(key => filters[key]?.length).length;
}
