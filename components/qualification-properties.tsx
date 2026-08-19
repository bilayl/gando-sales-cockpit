"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase, Check, FileText, Globe, Loader2, MapPin, Pencil, PhoneCall, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";

type CRMProperties = Record<string, string | null | undefined>;
type Kind = "contact" | "company";
type FieldType = "text" | "number" | "select" | "multi" | "company-status";
type Option = { value: string; label: string };

type Props = {
  kind: Kind;
  properties: CRMProperties;
  fallbackProperties?: CRMProperties;
};

type PropertyDefinition = {
  name: string;
  label?: string;
  type?: string;
  fieldType?: string;
  options?: Option[];
  missing?: boolean;
  error?: string;
};

type FieldSpec = {
  key: string;
  property: string;
  fallbackLabel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  fallbackProperty?: string;
};

function fieldSpecs(kind: Kind): FieldSpec[] {
  const company = kind === "company";
  const common: FieldSpec[] = [
    { key: "appreciation", property: "ce_quil_apprecie_chez_gando", fallbackLabel: "Ce qu’il apprécie chez Gando", icon: FileText },
    { key: "objections", property: "objections__retours", fallbackLabel: "Objections / Retours", icon: FileText },
    { key: "call", property: "statut_de_lappel", fallbackLabel: "Statut de l’appel", icon: PhoneCall },
    { key: "zip", property: "zip", fallbackLabel: "Code postal", icon: MapPin },
    { key: "campaign", property: "campagne_dacquisition", fallbackLabel: "Campagne d’acquisition", icon: Briefcase },
    { key: "fleet", property: company ? "taille_flotte" : "taille_de_flo", fallbackProperty: "taille_de_flo", fallbackLabel: "Taille de flotte", icon: Briefcase },
    { key: "country", property: company ? "hs_country_code" : "hs_country_region_code", fallbackProperty: "hs_country_region_code", fallbackLabel: "Code pays/région", icon: Globe },
    { key: "suite", property: "suite", fallbackLabel: "Suite", icon: FileText },
    { key: "payment", property: "solution_paiement_reservation", fallbackLabel: "Solution paiement réservation ?", icon: Briefcase },
  ];

  if (company) {
    return [
      { key: "company_name", property: "name", fallbackLabel: "Nom de l’entreprise", icon: Briefcase },
      { key: "prospection", property: "statut_prospection", fallbackLabel: "Statut prospection", icon: SlidersHorizontal },
      ...common,
    ];
  }

  return [
    ...common,
    { key: "prospection", property: "statut_prospection", fallbackLabel: "Statut prospection", icon: SlidersHorizontal },
  ];
}

function splitMulti(value?: string | null) {
  return (value || "").split(";").map(item => item.trim()).filter(Boolean);
}

function companyProspectionLabel(p: CRMProperties) {
  if (p.statut_prospection) return String(p.statut_prospection);
  if ((p.lifecyclestage || "").toLowerCase() === "customer") return "Gagné";
  if (p.hs_lead_status === "UNQUALIFIED") return "Perdu";
  if (p.hs_lead_status === "OPEN_DEAL") return "Opportunité";
  if (p.hs_lead_status === "BAD_TIMING") return p.statut_de_lappel === "a_une_date_ulterieure" ? "Ultérieur" : "À relancer";
  if (p.hs_lead_status === "CONNECTED") return "Contact établi";
  if (p.hs_lead_status === "ATTEMPTED_TO_CONTACT") return "Tentative";
  if (p.hs_lead_status === "OPEN") return "À contacter";
  return "À travailler";
}

function companyStatusProperties(value: string) {
  const map: Record<string, Record<string, string>> = {
    "À travailler": { statut_prospection: value, hs_lead_status: "NEW", lifecyclestage: "" },
    "À contacter": { statut_prospection: value, hs_lead_status: "OPEN", lifecyclestage: "" },
    "Tentative": { statut_prospection: value, hs_lead_status: "ATTEMPTED_TO_CONTACT", lifecyclestage: "" },
    "Contact établi": { statut_prospection: value, hs_lead_status: "CONNECTED", lifecyclestage: "" },
    "À relancer": { statut_prospection: value, hs_lead_status: "BAD_TIMING", statut_de_lappel: "a_rappeler", lifecyclestage: "" },
    "Ultérieur": { statut_prospection: value, hs_lead_status: "BAD_TIMING", statut_de_lappel: "a_une_date_ulterieure", lifecyclestage: "" },
    "Opportunité": { statut_prospection: value, hs_lead_status: "OPEN_DEAL", lifecyclestage: "opportunity" },
    "Gagné": { statut_prospection: value, hs_lead_status: "OPEN_DEAL", lifecyclestage: "customer" },
    "Perdu": { statut_prospection: value, hs_lead_status: "UNQUALIFIED", lifecyclestage: "" },
  };
  return map[value] || { statut_prospection: value };
}

function resolveType(kind: Kind, spec: FieldSpec, definition?: PropertyDefinition): FieldType {
  if (kind === "company" && spec.key === "prospection") return "company-status";
  if (definition?.fieldType === "checkbox") return "multi";
  if (["select", "radio"].includes(definition?.fieldType || "")) return "select";
  if (definition?.type === "number" || definition?.fieldType === "number") return "number";
  return "text";
}

function valueFor(spec: FieldSpec, kind: Kind, self: CRMProperties, fallback: CRMProperties) {
  if (kind === "company" && spec.key === "prospection") return companyProspectionLabel(self);
  const direct = self[spec.property];
  if (direct !== undefined && direct !== null && String(direct).trim() !== "") return String(direct);
  if (kind === "company") return String(fallback[spec.fallbackProperty || spec.property] || "");
  return "";
}

function displayValue(value: string, options: Option[]) {
  if (!value) return "—";
  const labels = new Map(options.map(option => [option.value, option.label]));
  return splitMulti(value).map(item => labels.get(item) || item).join(" · ");
}

function EditablePropertyCard({
  spec,
  definition,
  type,
  value,
  disabled,
  onSave,
}: {
  spec: FieldSpec;
  definition?: PropertyDefinition;
  type: FieldType;
  value: string;
  disabled?: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const options = definition?.options || [];
  const multiValues = useMemo(() => new Set(splitMulti(draft)), [draft]);
  const Icon = spec.icon;
  const label = definition?.label || spec.fallbackLabel;

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

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
          <span className="truncate">{label}</span>
        </div>
        {!editing ? (
          <button
            type="button"
            disabled={disabled || definition?.missing}
            onClick={() => setEditing(true)}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
            title={definition?.missing ? definition.error || "Propriété HubSpot indisponible" : `Modifier ${label}`}
          >
            <Pencil size={13} />
          </button>
        ) : null}
      </div>

      {!editing ? (
        <div className="mt-1 whitespace-pre-wrap break-words text-sm font-medium text-foreground">{displayValue(value, options)}</div>
      ) : (
        <div className="mt-2 space-y-2">
          {type === "multi" ? (
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-border bg-background p-2">
              {options.map(option => {
                const checked = multiValues.has(option.value);
                return (
                  <button key={option.value} type="button" onClick={() => toggleMulti(option.value)} className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted">
                    <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${checked ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                      {checked ? <Check size={11} /> : null}
                    </span>
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          ) : type === "select" || type === "company-status" ? (
            <select value={draft} onChange={event => setDraft(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary/55 focus:ring-2 focus:ring-ring/15">
              <option value="">—</option>
              {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          ) : (
            <input autoFocus type={type === "number" ? "number" : "text"} value={draft} onChange={event => setDraft(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary/55 focus:ring-2 focus:ring-ring/15" />
          )}

          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><X size={14} /></button>
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
  const [definitions, setDefinitions] = useState<Record<string, PropertyDefinition>>({});
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [metadataError, setMetadataError] = useState("");

  useEffect(() => setSelf(properties), [properties]);
  useEffect(() => setFallback(fallbackProperties), [fallbackProperties]);

  useEffect(() => {
    let cancelled = false;
    setMetadataLoading(true);
    setMetadataError("");
    fetch(`/api/hubspot/qualification-properties?kind=${kind}`, { cache: "no-store" })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Impossible de charger les propriétés HubSpot");
        if (!cancelled) {
          setDefinitions(Object.fromEntries((data.properties || []).map((property: PropertyDefinition) => [property.name, property])));
        }
      })
      .catch(error => { if (!cancelled) setMetadataError(error instanceof Error ? error.message : "Propriétés HubSpot indisponibles"); })
      .finally(() => { if (!cancelled) setMetadataLoading(false); });
    return () => { cancelled = true; };
  }, [kind]);

  const specs = useMemo(() => fieldSpecs(kind), [kind]);
  const selfId = self.__hubspot_id || self.hs_object_id || "";

  async function saveField(spec: FieldSpec, value: string) {
    if (!selfId) throw new Error("Identifiant HubSpot introuvable.");
    const patchProperties = kind === "company" && spec.key === "prospection"
      ? companyStatusProperties(value)
      : { [spec.property]: value };
    const endpoint = kind === "company" ? `/api/companies/${selfId}` : `/api/contacts/${selfId}`;
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ properties: patchProperties }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "HubSpot a rejeté la modification");
    setSelf(current => ({ ...current, ...patchProperties, ...(data.properties ?? {}) }));
    toast.success(`${definitions[spec.property]?.label || spec.fallbackLabel} mis à jour dans HubSpot.`);
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          <SlidersHorizontal size={14} className="text-primary" /> Qualification commerciale
        </div>
        {metadataLoading ? <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Loader2 size={11} className="animate-spin" /> HubSpot</span> : null}
      </div>
      {kind === "company" ? <p className="mt-1.5 text-[11px] text-muted-foreground">HubSpot est la source de vérité. Le nom et le statut sont modifiables directement ici et synchronisés avec la fiche Entreprise.</p> : null}
      {metadataError ? <p className="mt-2 rounded-md border border-amber-400/25 bg-amber-400/10 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-300">{metadataError}</p> : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {specs.map(spec => {
          const definition = definitions[spec.property];
          return (
            <EditablePropertyCard
              key={spec.key}
              spec={spec}
              definition={definition}
              type={resolveType(kind, spec, definition)}
              value={String(valueFor(spec, kind, self, fallback) || "")}
              disabled={!selfId || metadataLoading || Boolean(metadataError)}
              onSave={value => saveField(spec, value)}
            />
          );
        })}
      </div>
    </section>
  );
}
