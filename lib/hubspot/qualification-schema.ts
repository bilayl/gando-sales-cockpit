import { hubspotJson } from "@/lib/hubspot";

type PropertySchema = {
  name: string;
  label: string;
  type: "enumeration";
  fieldType: "checkbox" | "select";
  options: Array<{ value: string; label: string }>;
};

const qualificationOptions = {
  appreciation: [
    "Moins de cout loueur (client paie)",
    "Garantie",
    "Montant max de caution sécurisée",
    "Pas de blocage de fond pour le client final",
    "Paiement résa + caution Gando",
    "Cashback",
    "Durée de caution 60 jours",
    "Blocage de caution à distance",
    "Gain de temps pour ne pas devoir faire un plbs",
  ],
  objections: [
    "Frais de sécu trop important pour le client",
    "Le parcours formulaire client est trop long avec risque de churn",
    "Envoi de caution avant le début du contrat",
    "Besoin d'intégration outil de gestion",
    "Montant max de caution insuffisant",
    "Frais d'encaissement trop important",
    "Garantie pas assez immédiate et couverte que TPE",
    "Besoin de paiement résa/ d'accompte",
    "Besoin que le client puisse payer au delà de la caution (rachat de franchise)",
    "Durée de caution trop faible",
    "Activation de la caution complexe",
    "Besoin de savoir combien ca coute au client avant",
    "Le concept \"Produit\" n'est pas adapté pour les locations successives",
    "Besoin de notification quand la caution change de statut",
    "Envoyer le lien de la caution par SMS",
    "Avoir plusieurs membres dans un même compte Gando",
    "Client assez agés pas à l'aise avec en ligne",
    "Simuler le montant des frais d'encaissement",
    "La gestion de l'encaissement est trop chronophage pour lui",
    "Besoin de changer le contrat de location de durée",
    "Besoin de gestion multicomptes",
    "Besoin d'encaisser plusieurs fois",
    "Pas adapté aux petits montants de réservation",
    "N'a pas l'habitude",
    "Ne pas bloquer les fonds n'est pas rassurant",
  ],
  campaigns: [
    ["1st gros compte", "1st gros compte"],
    ["Pré-intégration Cityrent", "City rent"],
    ["Pré-intégration Teori", "Teori"],
    ["Fleetee", "Fleetee"],
    ["myrentacar/hitech", "myrentacar/hitech"],
    ["Bookcar", "Bookcar"],
    ["Aucun outil de gestio", "Aucun outil de gestion"],
    ["Autre", "Autre"],
    ["Rodeeo", "Rodeeo"],
  ] as Array<[string, string]>,
  suite: ["INSCRIT", "Mail envoyer", "Whatsapp", "Linkedin", "Visio", "Caution créée", "Propal envoyée"],
  prospection: ["À travailler", "À contacter", "Tentative", "Contact établi", "À relancer", "Ultérieur", "Opportunité", "Gagné", "Pas intéressé", "Hors cible"],
};

function options(values: string[]) {
  return values.map(value => ({ value, label: value }));
}

export const COMPANY_QUALIFICATION_SCHEMAS: PropertySchema[] = [
  {
    name: "ce_quil_apprecie_chez_gando",
    label: "Ce qu'il apprécie chez Gando",
    type: "enumeration",
    fieldType: "checkbox",
    options: options(qualificationOptions.appreciation),
  },
  {
    name: "objections__retours",
    label: "Objections / Retours",
    type: "enumeration",
    fieldType: "checkbox",
    options: options(qualificationOptions.objections),
  },
  {
    name: "campagne_dacquisition",
    label: "Campagne d'acquisition",
    type: "enumeration",
    fieldType: "select",
    options: qualificationOptions.campaigns.map(([value, label]) => ({ value, label })),
  },
  {
    name: "suite",
    label: "Suite",
    type: "enumeration",
    fieldType: "select",
    options: options(qualificationOptions.suite),
  },
  {
    name: "statut_prospection",
    label: "Statut prospection",
    type: "enumeration",
    fieldType: "select",
    options: options(qualificationOptions.prospection),
  },
];

export type QualificationSchemaResult = {
  available: string[];
  created: string[];
  unavailable: Array<{ name: string; error: string }>;
};

async function reconcileProspectionOptions(schema: PropertySchema, existing: any) {
  if (schema.name !== "statut_prospection") return;

  const currentOptions = Array.isArray(existing?.options) ? existing.options : [];
  const desiredValues = new Set(schema.options.map(option => option.value));
  const mergedOptions = schema.options.map((option, index) => ({
    value: option.value,
    label: option.label,
    displayOrder: index + 1,
    hidden: false,
  }));

  // Keep any portal-specific values that are not managed by the Cockpit. The old
  // "Perdu" option remains hidden temporarily so existing records can be migrated
  // without breaking HubSpot's enum history.
  for (const option of currentOptions) {
    if (!option?.value || desiredValues.has(option.value)) continue;
    mergedOptions.push({
      value: String(option.value),
      label: String(option.label || option.value),
      displayOrder: mergedOptions.length + 1,
      hidden: option.value === "Perdu" ? true : Boolean(option.hidden),
    });
  }

  const normalize = (values: any[]) => values.map(option => ({
    value: String(option.value || ""),
    label: String(option.label || option.value || ""),
    hidden: Boolean(option.hidden),
  }));

  if (JSON.stringify(normalize(currentOptions)) === JSON.stringify(normalize(mergedOptions))) return;

  await hubspotJson(`/crm/properties/2026-03/companies/${encodeURIComponent(schema.name)}`, {
    method: "PATCH",
    body: JSON.stringify({ options: mergedOptions }),
  });
}

export async function ensureCompanyQualificationProperties(): Promise<QualificationSchemaResult> {
  const available: string[] = [];
  const created: string[] = [];
  const unavailable: Array<{ name: string; error: string }> = [];

  for (const schema of COMPANY_QUALIFICATION_SCHEMAS) {
    try {
      const existing = await hubspotJson(`/crm/properties/2026-03/companies/${encodeURIComponent(schema.name)}`);
      await reconcileProspectionOptions(schema, existing);
      available.push(schema.name);
      continue;
    } catch (error) {
      const e = error as Error & { status?: number };
      if (e.status !== 404) {
        unavailable.push({ name: schema.name, error: e.message || "Impossible de vérifier ou mettre à jour la propriété" });
        continue;
      }
    }

    try {
      await hubspotJson(`/crm/properties/2026-03/companies`, {
        method: "POST",
        body: JSON.stringify({
          groupName: "companyinformation",
          name: schema.name,
          label: schema.label,
          description: "Qualification commerciale Gando synchronisée avec le Sales Cockpit.",
          type: schema.type,
          fieldType: schema.fieldType,
          formField: false,
          hidden: false,
          options: schema.options.map((option, index) => ({
            value: option.value,
            label: option.label,
            displayOrder: index + 1,
            hidden: false,
          })),
        }),
      });
      available.push(schema.name);
      created.push(schema.name);
    } catch (error) {
      const e = error as Error & { status?: number };
      // Another request may have created the property concurrently.
      if (e.status === 409) {
        available.push(schema.name);
      } else {
        unavailable.push({ name: schema.name, error: e.message || "Impossible de créer la propriété" });
      }
    }
  }

  return { available, created, unavailable };
}
