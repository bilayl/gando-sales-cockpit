export const HUBSPOT_INDUSTRY_OPTIONS = [
  { value: "AUTOMOTIVE", label: "Automobile / location de véhicules" },
  { value: "HOSPITALITY", label: "Hébergement / hôtellerie" },
  { value: "LEISURE_TRAVEL_TOURISM", label: "Loisirs / tourisme" },
  { value: "EVENTS_SERVICES", label: "Événementiel" },
  { value: "TRANSPORTATION_TRUCKING_RAILROAD", label: "Transport" },
  { value: "LOGISTICS_AND_SUPPLY_CHAIN", label: "Logistique" },
  { value: "REAL_ESTATE", label: "Immobilier" },
  { value: "RECREATIONAL_FACILITIES_AND_SERVICES", label: "Loisirs & services récréatifs" },
  { value: "CONSUMER_SERVICES", label: "Services aux particuliers" },
  { value: "BUSINESS_SUPPLIES_AND_EQUIPMENT", label: "Matériel / équipements professionnels" },
  { value: "RETAIL", label: "Commerce / retail" },
  { value: "INTERNET", label: "Internet / plateforme" },
  { value: "COMPUTER_SOFTWARE", label: "Logiciel" },
  { value: "FINANCIAL_SERVICES", label: "Services financiers" },
  { value: "INSURANCE", label: "Assurance" },
] as const;

const VALID_OPTIONS = new Set(HUBSPOT_INDUSTRY_OPTIONS.map(option => option.value));

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const INDUSTRY_ALIASES: Array<{ terms: string[]; value: string }> = [
  { terms: ["hebergement", "hebergements", "reseau d hebergements", "hotellerie", "hotel", "hotels", "camping", "campings"], value: "HOSPITALITY" },
  { terms: ["automobile", "auto", "location de vehicule", "location de vehicules", "location vehicule", "location vehicules", "loueur automobile", "loueur de voiture", "loueur de voitures"], value: "AUTOMOTIVE" },
  { terms: ["tourisme", "loisir", "loisirs", "voyage", "voyages", "location saisonniere"], value: "LEISURE_TRAVEL_TOURISM" },
  { terms: ["evenementiel", "evenement", "evenements"], value: "EVENTS_SERVICES" },
  { terms: ["transport", "transport routier"], value: "TRANSPORTATION_TRUCKING_RAILROAD" },
  { terms: ["logistique", "supply chain"], value: "LOGISTICS_AND_SUPPLY_CHAIN" },
  { terms: ["immobilier", "location immobiliere"], value: "REAL_ESTATE" },
  { terms: ["service aux particuliers", "services aux particuliers"], value: "CONSUMER_SERVICES" },
  { terms: ["materiel", "equipement", "equipements", "location de materiel", "location materiel"], value: "BUSINESS_SUPPLIES_AND_EQUIPMENT" },
];

export function normalizeHubSpotIndustry(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  if (VALID_OPTIONS.has(raw as (typeof HUBSPOT_INDUSTRY_OPTIONS)[number]["value"])) return raw;

  const normalized = normalizeText(raw);
  for (const alias of INDUSTRY_ALIASES) {
    if (alias.terms.some(term => normalized === term || normalized.includes(term))) return alias.value;
  }

  return null;
}
