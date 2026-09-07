export type CompanyFilterKey =
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

const LOCATION_KEYS = new Set<CompanyFilterKey>(["zip", "city", "state", "country"]);

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

export function companyPropertyValues(
  properties: Record<string, string | null | undefined>,
  key: CompanyFilterKey,
  stage?: string,
) {
  switch (key) {
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

function matchesSelected(actual: string[], selected: string[], fuzzy = false) {
  const normalizedActual = actual.map(normalized).filter(Boolean);
  const normalizedSelected = selected.map(normalized).filter(Boolean);
  if (!normalizedActual.length || !normalizedSelected.length) return false;

  return normalizedSelected.some(wanted => normalizedActual.some(candidate => {
    if (candidate === wanted) return true;
    if (!fuzzy) return false;
    return candidate.includes(wanted) || wanted.includes(candidate);
  }));
}

export function companyMatchesFilters(
  properties: Record<string, string | null | undefined>,
  filters: CompanyFilters,
  stage?: string,
) {
  return COMPANY_FILTER_KEYS.every(key => {
    const selected = filters[key];
    if (!selected?.length) return true;
    const actual = companyPropertyValues(properties, key, stage).map(clean).filter(Boolean);
    return matchesSelected(actual, selected, LOCATION_KEYS.has(key));
  });
}

export function activeCompanyFilterCount(filters: CompanyFilters) {
  return COMPANY_FILTER_KEYS.filter(key => filters[key]?.length).length;
}

export function isCompanyLocationFilter(key: CompanyFilterKey) {
  return LOCATION_KEYS.has(key);
}
