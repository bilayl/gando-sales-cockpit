import { Briefcase, FileText, Globe, MapPin, PhoneCall, SlidersHorizontal } from "lucide-react";

type CRMProperties = Record<string, string | null | undefined>;

type Props = {
  kind: "contact" | "company";
  properties: CRMProperties;
  fallbackProperties?: CRMProperties;
};

function display(value?: string | null) {
  return value && String(value).trim() ? String(value).trim() : "—";
}

function callStatusLabel(value?: string | null) {
  if (!value) return "—";
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, "_");
  const labels: Record<string, string> = {
    a_rappeler: "A Rappeler",
    a_une_date_ulterieure: "A une date ultérieure",
    pas_interesse: "Pas intéressé",
    interesse: "Intéressé",
    interesse_mais: "Intéressé mais",
    occupe: "Occupé",
    nrp: "NRP",
    hors_cible: "HORS CIBLE",
    en_attente_decision: "En attente décision",
    numero_invalide: "Numéro invalide",
    autres: "Autres",
  };
  return labels[normalized] || value;
}

function companyProspectionLabel(p: CRMProperties) {
  if ((p.lifecyclestage || "").toLowerCase() === "customer") return "Gagné";
  const labels: Record<string, string> = {
    NEW: "À travailler",
    OPEN: "À contacter",
    ATTEMPTED_TO_CONTACT: "Tentative",
    CONNECTED: "Contact établi",
    BAD_TIMING: p.statut_de_lappel === "a_une_date_ulterieure" ? "Ultérieur" : "À relancer",
    OPEN_DEAL: "Opportunité",
    UNQUALIFIED: "Perdu",
  };
  return labels[p.hs_lead_status || ""] || "—";
}

function PropertyRow({ label, value, icon: Icon }: { label: string; value?: string | null; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
        <Icon size={13} className="shrink-0 text-primary" />
        <span>{label}</span>
      </div>
      <div className="mt-1 whitespace-pre-wrap break-words text-sm font-medium text-foreground" title={value || ""}>{display(value)}</div>
    </div>
  );
}

export function QualificationProperties({ kind, properties: p, fallbackProperties = {} }: Props) {
  const f = fallbackProperties;
  const isCompany = kind === "company";

  const appreciation = isCompany ? f.ce_quil_apprecie_chez_gando : p.ce_quil_apprecie_chez_gando;
  const objections = isCompany ? f.objections__retours : p.objections__retours;
  const callStatus = p.statut_de_lappel || f.statut_de_lappel;
  const zip = p.zip || f.zip;
  const campaign = isCompany ? f.campagne_dacquisition : p.campagne_dacquisition;
  const fleet = isCompany ? (p.taille_flotte || f.taille_de_flo) : p.taille_de_flo;
  const countryCode = isCompany ? (p.hs_country_code || f.hs_country_region_code) : p.hs_country_region_code;
  const next = isCompany ? f.suite : p.suite;
  const payment = p.solution_paiement_reservation || f.solution_paiement_reservation;
  const prospection = isCompany ? companyProspectionLabel(p) : p.statut_prospection;

  return (
    <section>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <SlidersHorizontal size={14} className="text-primary" /> Qualification commerciale
      </div>
      {isCompany && Object.keys(f).length ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground">Les informations uniquement disponibles au niveau contact sont reprises depuis le contact associé de référence.</p>
      ) : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <PropertyRow icon={FileText} label="Ce qu’il apprécie chez Gando" value={appreciation} />
        <PropertyRow icon={FileText} label="Objections / Retours" value={objections} />
        <PropertyRow icon={PhoneCall} label="Statut de l’appel" value={callStatusLabel(callStatus)} />
        <PropertyRow icon={MapPin} label="Code postal" value={zip} />
        <PropertyRow icon={Briefcase} label="Campagne d’acquisition" value={campaign} />
        <PropertyRow icon={Briefcase} label="Taille de flotte" value={fleet} />
        <PropertyRow icon={Globe} label="Code pays/région" value={countryCode} />
        <PropertyRow icon={FileText} label="Suite" value={next} />
        <PropertyRow icon={Briefcase} label="Solution paiement réservation ?" value={payment} />
        <PropertyRow icon={SlidersHorizontal} label="Statut prospection" value={prospection} />
      </div>
    </section>
  );
}
