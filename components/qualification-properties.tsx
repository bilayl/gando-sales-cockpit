"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase, Check, FileText, Globe, Loader2, MapPin, Pencil, PhoneCall, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";

type CRMProperties = Record<string, string | null | undefined>;
type Kind = "contact" | "company";
type FieldType = "text" | "number" | "select" | "multi" | "company-status";

type Props = {
  kind: Kind;
  properties: CRMProperties;
  fallbackProperties?: CRMProperties;
};

type FieldSpec = {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  type: FieldType;
  property: string;
  source?: "self" | "fallback";
  options?: Array<{ value: string; label: string }>;
};

const APPRECIATION_OPTIONS = [
  "Moins de cout loueur (client paie)",
  "Garantie",
  "Montant max de caution sécurisée",
  "Pas de blocage de fond pour le client final",
  "Paiement résa + caution Gando",
  "Cashback",
  "Durée de caution 60 jours",
  "Blocage de caution à distance",
  "Gain de temps pour ne pas devoir faire un plbs",
].map(value => ({ value, label: value }));

const OBJECTION_OPTIONS = [
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
].map(value => ({ value, label: value }));

const CONTACT_CALL_OPTIONS = [
  "Intéressé",
  "AssisterIntéressé mais",
  "A une date ultérieure",
  "A Rappeler",
  "pas intéressé",
  "Occupé",
  "NRP",
  "HORS CIBLE",
  "En attente décision",
  "Autres",
  "Numéro invalide",
  "Intéressé mais",
].map(value => ({ value, label: value === "AssisterIntéressé mais" ? "Assister" : value }));

const COMPANY_CALL_OPTIONS = [
  ["interesse", "Intéressé"], ["assister", "Assister"], ["interesse_mais", "Intéressé mais"],
  ["a_une_date_ulterieure", "À une date ultérieure"], ["a_rappeler", "À rappeler"],
  ["pas_interesse", "Pas intéressé"], ["occupe", "Occupé"], ["nrp", "NRP"],
  ["hors_cible", "Hors cible"], ["en_attente_decision", "En attente décision"],
  ["autres", "Autres"], ["numero_invalide", "Numéro invalide"],
].map(([value, label]) => ({ value, label }));

const CAMPAIGN_OPTIONS = [
  ["1st gros compte", "1st gros compte"], ["Pré-intégration Cityrent", "City rent"], ["Pré-intégration Teori", "Teori"],
  ["Fleetee", "Fleetee"], ["myrentacar/hitech", "myrentacar/hitech"], ["Bookcar", "Bookcar"],
  ["Aucun outil de gestio", "Aucun outil de gestion"], ["Autre", "Autre"], ["Rodeeo", "Rodeeo"],
].map(([value, label]) => ({ value, label }));

const SUITE_OPTIONS = ["INSCRIT", "Mail envoyer", "Whatsapp", "Linkedin", "Visio", "Caution créée", "Propal envoyée"]
  .map(value => ({ value, label: value }));

const CONTACT_PAYMENT_OPTIONS = [
  "Paiement d'acompte via Swikly", "TPE", "Paiement en ligne via plateforme", "Virement + espèces", "Chèques",
  "Paiement total via Swikly", "Paiement total via autre PSP", "Pas de paiement en ligne",
].map(value => ({ value, label: value }));

const COMPANY_PAYMENT_OPTIONS = [
  "Paiement d'acompte via Swikly", "Paiement 100% résa via Swikly", "Paiement 100% résa via autre PSP",
  "Pas de paiement en ligne/TPE", "Paiement en ligne via plateforme", "Paiement + Caution \"Smiles&Pay\"",
  "Paiement d'acompte via Payzen", "Virement + cash", "Chèques", "Paiement d'acompte avec un lien en ligne",
].map(value => ({ value, label: value }));

const CONTACT_PROSPECTION_OPTIONS = ["À prospecter", "En prospection", "Conversation", "RDV booké", "À recycler", "Non qualifié", "Perdu", "Gagné"]
  .map(value => ({ value, label: value }));

const COMPANY_STATUS_OPTIONS = [
  "À travailler", "À contacter", "Tentative", "Contact établi", "À relancer", "Ultérieur", "Opportunité", "Gagné", "Perdu",
].map(value => ({ value, label: value }));

function splitMulti(value?: string | null) {
  return (value || "").split(";").map(item => item.trim()).filter(Boolean);
}

function callStatusLabel(value?: string | null) {
  if (!value) return "—";
  const companyLabels = Object.fromEntries(COMPANY_CALL_OPTIONS.map(option => [option.value, option.label]));
  return splitMulti(value).map(item => companyLabels[item] || CONTACT_CALL_OPTIONS.find(option => option.value === item)?.label || item).join(" · ");
}

function companyProspectionLabel(p: CRMProperties) {
  if ((p.lifecyclestage || "").toLowerCase() === "customer") return "Gagné";
  const labels: Record<string, string> = {
    NEW: "À travailler",
    OPEN: "À contacter",
    ATTEMPTED_TO_CONTACT: "Tentative",
    CONNECTED: "Contact établi",
    BAD_TIMING: p.statut_de_lappel === "a_une_date_ulterieure" ? "Ultérieur" : "À relancer",
    IN_PROGRESS: "En cours",
    OPEN_DEAL: "Opportunité",
    UNQUALIFIED: "Perdu",
  };
  return labels[p.hs_lead_status || ""] || "—";
}

function companyStatusProperties(value: string) {
  const map: Record<string, Record<string, string>> = {
    "À travailler": { hs_lead_status: "NEW", lifecyclestage: "" },
    "À contacter": { hs_lead_status: "OPEN", lifecyclestage: "" },
    "Tentative": { hs_lead_status: "ATTEMPTED_TO_CONTACT", lifecyclestage: "" },
    "Contact établi": { hs_lead_status: "CONNECTED", lifecyclestage: "" },
    "À relancer": { hs_lead_status: "BAD_TIMING", statut_de_lappel: "a_rappeler", lifecyclestage: "" },
    "Ultérieur": { hs_lead_status: "BAD_TIMING", statut_de_lappel: "a_une_date_ulterieure", lifecyclestage: "" },
    "Opportunité": { hs_lead_status: "OPEN_DEAL", lifecyclestage: "opportunity" },
    "Gagné": { hs_lead_status: "OPEN_DEAL", lifecyclestage: "customer" },
    "Perdu": { hs_lead_status: "UNQUALIFIED", lifecyclestage: "" },
  };
  return map[value] || {};
}

function fieldSpecs(kind: Kind): FieldSpec[] {
  const isCompany = kind === "company";
  return [
    { key: "appreciation", label: "Ce qu’il apprécie chez Gando", icon: FileText, type: "multi", property: "ce_quil_apprecie_chez_gando", source: isCompany ? "fallback" : "self", options: APPRECIATION_OPTIONS },
    { key: "objections", label: "Objections / Retours", icon: FileText, type: "multi", property: "objections__retours", source: isCompany ? "fallback" : "self", options: OBJECTION_OPTIONS },
    { key: "call", label: "Statut de l’appel", icon: PhoneCall, type: isCompany ? "select" : "multi", property: "statut_de_lappel", options: isCompany ? COMPANY_CALL_OPTIONS : CONTACT_CALL_OPTIONS },
    { key: "zip", label: "Code postal", icon: MapPin, type: "text", property: "zip" },
    { key: "campaign", label: "Campagne d’acquisition", icon: Briefcase, type: "select", property: "campagne_dacquisition", source: isCompany ? "fallback" : "self", options: CAMPAIGN_OPTIONS },
    { key: "fleet", label: "Taille de flotte", icon: Briefcase, type: "number", property: isCompany ? "taille_flotte" : "taille_de_flo" },
    { key: "country", label: "Code pays/région", icon: Globe, type: "text", property: isCompany ? "hs_country_code" : "hs_country_region_code" },
    { key: "suite", label: "Suite", icon: FileText, type: "select", property: "suite", source: isCompany ? "fallback" : "self", options: SUITE_OPTIONS },
    { key: "payment", label: "Solution paiement réservation ?", icon: Briefcase, type: "select", property: "solution_paiement_reservation", options: isCompany ? COMPANY_PAYMENT_OPTIONS : CONTACT_PAYMENT_OPTIONS },
    { key: "prospection", label: "Statut prospection", icon: SlidersHorizontal, type: isCompany ? "company-status" : "select", property: isCompany ? "hs_lead_status" : "statut_prospection", options: isCompany ? COMPANY_STATUS_OPTIONS : CONTACT_PROSPECTION_OPTIONS },
  ];
}

function valueFor(spec: FieldSpec, kind: Kind, self: CRMProperties, fallback: CRMProperties) {
  if (spec.type === "company-status") return companyProspectionLabel(self);
  const source = spec.source === "fallback" ? fallback : self;
  return source[spec.property] || "";
}

function displayValue(spec: FieldSpec, value: string) {
  if (!value) return "—";
  if (spec.key === "call") return callStatusLabel(value);
  if (spec.type === "multi") {
    const labels = new Map((spec.options || []).map(option => [option.value, option.label]));
    return splitMulti(value).map(item => labels.get(item) || item).join(" · ");
  }
  return spec.options?.find(option => option.value === value)?.label || value;
}

function EditablePropertyCard({
  spec,
  value,
  disabled,
  onSave,
}: {
  spec: FieldSpec;
  value: string;
  disabled?: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const multiValues = useMemo(() => new Set(splitMulti(draft)), [draft]);
  const Icon = spec.icon;

  async function save() {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d’enregistrer dans HubSpot");
    } finally {
      setSaving(false);
    }
  }

  function toggleMulti(option: string) {
    const next = new Set(multiValues);
    if (next.has(option)) next.delete(option); else next.add(option);
    setDraft(Array.from(next).join(";"));
  }

  return (
    <div className="group rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/30">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-muted-foreground">
          <Icon size={13} className="shrink-0 text-primary" />
          <span className="truncate">{spec.label}</span>
        </div>
        {!editing ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setEditing(true)}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
            title={disabled ? "Aucun contact associé pour modifier cette propriété" : `Modifier ${spec.label}`}
          >
            <Pencil size={13} />
          </button>
        ) : null}
      </div>

      {!editing ? (
        <div className="mt-1 whitespace-pre-wrap break-words text-sm font-medium text-foreground">{displayValue(spec, value)}</div>
      ) : (
        <div className="mt-2 space-y-2">
          {spec.type === "multi" ? (
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-border bg-background p-2">
              {(spec.options || []).map(option => {
                const checked = multiValues.has(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleMulti(option.value)}
                    className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                  >
                    <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${checked ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                      {checked ? <Check size={11} /> : null}
                    </span>
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          ) : spec.type === "select" || spec.type === "company-status" ? (
            <select
              value={draft}
              onChange={event => setDraft(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary/55 focus:ring-2 focus:ring-ring/15"
            >
              <option value="">—</option>
              {(spec.options || []).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          ) : (
            <input
              autoFocus
              type={spec.type === "number" ? "number" : "text"}
              value={draft}
              onChange={event => setDraft(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary/55 focus:ring-2 focus:ring-ring/15"
            />
          )}

          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
              <X size={14} />
            </button>
            <button type="button" onClick={save} disabled={saving} className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function QualificationProperties({ kind, properties, fallbackProperties = {} }: Props) {
  const [self, setSelf] = useState<CRMProperties>(properties);
  const [fallback, setFallback] = useState<CRMProperties>(fallbackProperties);

  useEffect(() => setSelf(properties), [properties]);
  useEffect(() => setFallback(fallbackProperties), [fallbackProperties]);

  const specs = useMemo(() => fieldSpecs(kind), [kind]);
  const selfId = self.__hubspot_id || self.hs_object_id || "";
  const fallbackId = fallback.__hubspot_id || fallback.hs_object_id || "";

  async function saveField(spec: FieldSpec, value: string) {
    const useFallback = spec.source === "fallback";
    const targetKind: Kind = useFallback ? "contact" : kind;
    const targetId = useFallback ? fallbackId : selfId;
    if (!targetId) throw new Error(useFallback ? "Aucun contact associé disponible pour enregistrer cette propriété." : "Identifiant HubSpot introuvable.");

    let patchProperties: Record<string, string>;
    if (spec.type === "company-status" && kind === "company") {
      patchProperties = companyStatusProperties(value);
    } else {
      patchProperties = { [spec.property]: value };
    }

    const endpoint = targetKind === "company" ? `/api/companies/${targetId}` : `/api/contacts/${targetId}`;
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ properties: patchProperties }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "HubSpot a rejeté la modification");

    if (useFallback) {
      setFallback(current => ({ ...current, ...patchProperties }));
    } else {
      setSelf(current => ({ ...current, ...patchProperties }));
    }
    toast.success(`${spec.label} mis à jour dans HubSpot.`);
  }

  return (
    <section>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <SlidersHorizontal size={14} className="text-primary" /> Qualification commerciale
      </div>
      {kind === "company" ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground">Les propriétés Company sont enregistrées sur l’entreprise. Les propriétés uniquement disponibles sur Contact sont enregistrées sur le contact associé de référence.</p>
      ) : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {specs.map(spec => {
          const useFallback = spec.source === "fallback";
          return (
            <EditablePropertyCard
              key={spec.key}
              spec={spec}
              value={String(valueFor(spec, kind, self, fallback) || "")}
              disabled={useFallback && !fallbackId}
              onSave={value => saveField(spec, value)}
            />
          );
        })}
      </div>
    </section>
  );
}
