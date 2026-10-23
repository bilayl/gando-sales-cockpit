import { ArrowRight, Check, ExternalLink, FileText, TrendingUp } from "lucide-react";
import type { SD04Content } from "@/lib/sd-stage-content";

type Props = {
  content: Partial<SD04Content>;
  companyName?: string;
  compact?: boolean;
  language?: "fr" | "en";
};

const euro = (amount: number) => new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", maximumFractionDigits: 2,
}).format(amount);

function readRate(row?: { price: string }): number | null {
  if (!row) return null;
  const found = row.price.match(/(-?\d+(?:[.,]\d+)?)\s*%/);
  if (!found) return null;
  const rate = Number(found[1].replace(",", "."));
  return Number.isFinite(rate) && rate >= 0 ? rate : null;
}

function isCollection(item: string) {
  return /encaissement/i.test(item);
}

function isMainPricing(item: string) {
  return /^(tarif gando|frais de sécurisation gando|marge partenaire|marge loueur|tarif total client|prix locataire)$/i.test(item.trim());
}

function ProposalBullets({ items }: { items?: string[] }) {
  const visible = (items || []).filter(item => item?.trim());
  if (!visible.length) return null;
  return <div className="grid gap-3 sm:grid-cols-2">{visible.map((item, index) => <div key={index} className="flex gap-3 rounded-xl border border-[#e5e3ee] bg-white px-4 py-3.5 text-[14px] leading-6 text-[#465057]"><span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-[#f0edff] text-[#6256b2]"><Check className="size-3.5" /></span><span>{item}</span></div>)}</div>;
}

/**
 * Shared renderer for the enterprise SD04 editor, internal preview and public
 * deal room. Only presentation-facing fields are rendered; never financial
 * Gando economics, internal approval, source data or unpublished versions.
 */
export function SD04ProposalVisual({ content, companyName = "Votre entreprise", compact = false, language = "fr" }: Props) {
  const t = (fr: string, en: string) => language === "en" ? en : fr;
  const legacyPdf = /^https:\/\/[^\s]+$/i.test(content.deckSubtitle || "") ? content.deckSubtitle : "";
  const mode = content.presentationMode || (legacyPdf ? "file" : "visual");
  const fileUrl = /^https:\/\/[^\s]+$/i.test(content.proposalFileUrl || "") ? content.proposalFileUrl : legacyPdf;
  const pdfFile = /\.pdf(?:[?#]|$)/i.test(fileUrl || "") || Boolean(legacyPdf);
  const title = content.deckTitle || t("Proposition commerciale", "Commercial proposal");

  if (mode === "file") {
    return <div className="overflow-hidden rounded-[20px] border border-[#e1dff1] bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e8e7ee] bg-[#f8f7ff] px-5 py-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#ebe8ff] text-[#6659b5]"><FileText className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#766ac2]">SD04 · {t("Document commercial", "Commercial document")}</div>
          <h3 className="truncate text-[16px] font-semibold text-[#202a2f]">{content.proposalFileName || title}</h3>
        </div>
        {fileUrl ? <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#29253a] px-4 text-[13px] font-semibold text-white"><ExternalLink className="size-4" />{t("Ouvrir le document", "Open document")}</a> : null}
      </div>
      {fileUrl ? pdfFile ? <iframe title={title} src={`${fileUrl.split("#")[0]}#toolbar=0&navpanes=0&view=FitH`} className={compact ? "h-[530px] w-full bg-white" : "h-[720px] w-full bg-white"} /> : <div className="p-6 text-sm text-[#687277]">{t("Ouvrez le document commercial avec le bouton ci-dessus.", "Open the commercial document using the button above.")}</div> : <div className="p-6 text-sm text-[#778086]">{t("Ajoutez un PDF pour afficher la proposition.", "Add a PDF to display the proposal.")}</div>}
    </div>;
  }

  const pricing = (content.pricing || []).filter(item => item.item?.trim());
  const totalRate = readRate(pricing.find(row => /^(tarif total client|prix locataire)$/i.test(row.item.trim())));
  const gandoRate = readRate(pricing.find(row => /^(tarif gando|frais de sécurisation gando)$/i.test(row.item.trim())));
  const partnerRate = readRate(pricing.find(row => /^(marge partenaire|marge loueur)$/i.test(row.item.trim())));
  const renterRate = gandoRate !== null && partnerRate !== null ? gandoRate + partnerRate : totalRate;
  const showPrice = renterRate !== null;
  const collectionLines = [
    ...pricing.filter(row => isCollection(row.item)).map(row => `${row.item} : ${row.price}${row.notes ? ` · ${row.notes}` : ""}`),
    ...(content.commercialTerms || []).filter(item => isCollection(item)),
  ];
  const otherRates = pricing.filter(row => !isMainPricing(row.item) && !isCollection(row.item));
  const publicTerms = (content.commercialTerms || []).filter(item => !isCollection(item));
  const businessCase = (content.businessCase || []).filter(item => item.metric?.trim());
  const partner = content.partnerRevenueExample;
  const effectivePartnerRate = partnerRate ?? partner?.partnerMarginRate ?? 0;
  const showPartner = Boolean(partner?.enabled && partner.averageDeposit > 0 && partner.monthlyActivations > 0 && effectivePartnerRate > 0);
  const perDeposit = showPartner && partner ? partner.averageDeposit * effectivePartnerRate / 100 : 0;
  const monthly = showPartner && partner ? perDeposit * partner.monthlyActivations : 0;
  const heading = "text-[11px] font-bold uppercase tracking-[0.15em] text-[#776ac2]";

  return <article className="overflow-hidden rounded-[22px] border border-[#dfdce9] bg-white shadow-[0_12px_35px_rgba(32,24,60,0.055)]">
    <div className={compact ? "relative overflow-hidden bg-[#f6f5fb] px-6 py-8" : "relative overflow-hidden bg-[#f6f5fb] px-7 py-10 sm:px-10 sm:py-12"}>
      <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full border-[38px] border-[#ded8fb]/70" />
      <div className="pointer-events-none absolute bottom-[-90px] right-24 size-48 rounded-full bg-[#e7e2fa]/70 blur-3xl" />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-[#dfdaf2] bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-[#6457ad]">Gando × {companyName}</span><span className="text-[11px] font-semibold text-[#827aab]">SD04</span></div>
        <h2 className={compact ? "mt-6 max-w-2xl text-[28px] font-semibold leading-tight tracking-[-0.045em] text-[#232132]" : "mt-7 max-w-3xl text-[34px] font-semibold leading-[1.12] tracking-[-0.045em] text-[#232132] sm:text-[40px]"}>{title}</h2>
        {content.deckSubtitle ? <p className="mt-4 max-w-2xl text-[16px] leading-7 text-[#6d6780]">{content.deckSubtitle}</p> : null}
        {content.executiveMessage ? <div className="mt-6 max-w-3xl border-l-[3px] border-[#7f70e8] pl-4 text-[16px] font-medium leading-8 text-[#3c3850]">{content.executiveMessage}</div> : null}
      </div>
    </div>
    <div className={compact ? "space-y-8 p-6" : "space-y-10 px-6 py-9 sm:px-10 sm:py-11"}>
      {showPrice ? <section className="space-y-4">
        <div className={heading}>{t("L'offre commerciale en un coup d'œil", "Your offer at a glance")}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative overflow-hidden rounded-[18px] border border-[#d9d2ff] bg-[#f2efff] p-5 sm:p-6">
            <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#6659ad]">{t("Prix pour le locataire", "Price for the renter")}</div>
            <div className="mt-3 text-[36px] font-semibold tracking-[-0.05em] text-[#312675]">{renterRate?.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} % <span className="text-[14px] font-medium tracking-normal">HT</span></div>
            <p className="mt-2 text-[13px] leading-6 text-[#635c85]">{t("Prix total facturé au locataire pour sécuriser sa caution, sans blocage de fonds.", "Total amount charged to the renter to secure the deposit, without frozen funds.")}</p>
            {gandoRate !== null && partnerRate !== null ? <p className="mt-3 border-t border-[#dfd9f4] pt-3 text-[12px] text-[#6e668d]">{t("Dont", "Including")} {gandoRate.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} % {t("pour Gando et", "for Gando and")} {partnerRate.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} % {t("de marge loueur", "partner margin")}</p> : null}
          </div>
          {partnerRate !== null ? <div className="rounded-[18px] border border-[#e4e0f0] bg-white p-5 sm:p-6">
            <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#6659ad]">{t("Marge du loueur", "Partner margin")}</div>
            <div className="mt-3 text-[36px] font-semibold tracking-[-0.05em] text-[#302940]">+ {partnerRate.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} % <span className="text-[14px] font-medium tracking-normal">HT</span></div>
            <p className="mt-2 text-[13px] leading-6 text-[#716d7f]">{t("Revenu additionnel conservé par le loueur sur chaque caution Gando activée.", "Additional revenue retained by the rental company per Gando deposit.")}</p>
          </div> : null}
        </div>
        {partner && partner.averageDeposit > 0 ? <div className="rounded-xl border border-[#e9e6f0] bg-[#fbfafc] px-4 py-3 text-[13px] leading-6 text-[#605a6c]">{t("Exemple pour une caution de", "Example for a deposit of")} <strong className="text-[#2d2938]">{euro(partner.averageDeposit)}</strong> : {t("prix locataire", "renter price")} <strong className="text-[#3a2c82]">{euro(partner.averageDeposit * (renterRate || 0) / 100)} HT</strong>{partnerRate !== null ? <> · {t("marge du loueur", "partner margin")} <strong className="text-[#31294b]">{euro(partner.averageDeposit * partnerRate / 100)} HT</strong></> : null}. {t("Simulation indicative, hors TVA applicable.", "Illustrative estimate, excluding applicable VAT.")}</div> : null}
      </section> : null}
      {(content.problem || []).filter(Boolean).length ? <section><div className={heading}>{t("01 · Les enjeux", "01 · Challenges")}</div><div className="mt-3 grid gap-3 sm:grid-cols-2">{(content.problem || []).filter(Boolean).map((item, index) => <div key={index} className="rounded-xl border border-[#e8e7ed] bg-[#fafafb] px-4 py-4 text-[14px] leading-6 text-[#515963]">{item}</div>)}</div></section> : null}
      {(content.solution || []).filter(Boolean).length ? <section><div className={heading}>{t("02 · La solution Gando", "02 · The Gando solution")}</div><h3 className="mt-1 text-xl font-semibold tracking-tight text-[#272632]">{t("Une caution sans blocage de fonds", "A deposit without blocked funds")}</h3><div className="mt-4"><ProposalBullets items={content.solution} /></div></section> : null}
      {otherRates.length ? <section><div className={heading}>{t("Tarifs complémentaires", "Additional charges")}</div><div className="mt-3 grid gap-3 sm:grid-cols-2">{otherRates.map((row, index) => <div key={index} className="rounded-xl border border-[#e4e1ef] bg-[#faf9fe] p-4"><div className="text-[12px] font-semibold text-[#6e659f]">{row.item}</div><div className="mt-2 text-[18px] font-semibold text-[#28233d]">{row.price}</div>{row.notes ? <p className="mt-1 text-[12px] leading-5 text-[#747081]">{row.notes}</p> : null}</div>)}</div></section> : null}
      {showPartner && partner ? <section><div className={heading}>{t("Impact pour le partenaire", "Partner impact")}</div><div className="mt-4 grid gap-3 sm:grid-cols-3">{[[t("Par caution", "Per deposit"), euro(perDeposit)], [t("Potentiel par mois", "Monthly potential"), euro(monthly)], [t("Projection annuelle", "Annual projection"), euro(monthly * 12)]].map(([label, value], index) => <div key={index} className="rounded-xl border border-[#e4e0f3] bg-[#faf9ff] p-4"><div className="text-[11px] font-semibold text-[#726d87]">{label}</div><div className="mt-2 text-xl font-semibold text-[#30294c]">{value} <span className="text-xs">HT</span></div></div>)}</div><p className="mt-2 text-xs text-[#7c7889]">{t("Projection indicative calculée avec", "Illustrative projection based on")} {partner.monthlyActivations} {t("cautions par mois et une caution moyenne de", "deposits/month and an average deposit of")} {euro(partner.averageDeposit)}.</p></section> : null}
      {businessCase.length ? <section><div className={heading}>{t("Impact attendu", "Expected impact")}</div><div className="mt-4 grid gap-3 sm:grid-cols-2">{businessCase.map((row, index) => <div key={index} className="rounded-xl border border-[#e8e7ee] p-4"><div className="text-[12px] font-semibold text-[#7166b2]">{row.metric}</div><div className="mt-2 text-[20px] font-semibold text-[#292738]">{row.value || row.target || "—"}</div>{row.baseline ? <p className="mt-1 text-xs text-[#727985]">{t("Situation initiale", "Baseline")} : {row.baseline}</p> : null}</div>)}</div></section> : null}
      {(content.proofPoints || []).filter(Boolean).length ? <section><div className={heading}>{t("Pourquoi Gando ?", "Why Gando?")}</div><div className="mt-4"><ProposalBullets items={content.proofPoints} /></div></section> : null}
      {publicTerms.filter(Boolean).length ? <section><div className={heading}>{t("Conditions de collaboration", "Terms of collaboration")}</div><div className="mt-4 space-y-2">{publicTerms.filter(Boolean).map((item, index) => <div key={index} className="flex gap-3 border-b border-[#eeedf1] py-2 text-[14px] leading-6 text-[#4e535b]"><span className="text-[#8272da]">•</span>{item}</div>)}</div></section> : null}
      {collectionLines.length ? <section className="rounded-xl border border-[#eceaf0] bg-[#fbfafc] px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#888390]">{t("Informations complémentaires · Encaissement", "Additional terms · Collection")}</div><div className="mt-1 space-y-1 text-[11px] leading-5 text-[#777383]">{collectionLines.map((line, index) => <p key={index}>{line}</p>)}</div></section> : null}
      {(content.rolloutPlan || []).filter(Boolean).length ? <section><div className={heading}>{t("Déploiement", "Rollout")}</div><div className="mt-4"><ProposalBullets items={content.rolloutPlan} /></div></section> : null}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#e9e6f2] bg-[#faf9ff] px-6 py-6 sm:px-10">
      <div><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#756bb1]"><TrendingUp className="size-4" />{t("Votre prochaine étape", "Next step")}</div><p className="mt-2 text-[15px] font-semibold text-[#28233b]">{content.callToAction || t("Valider ensemble cette proposition", "Review and approve this proposal together")}</p></div>
      <span className="grid size-10 place-items-center rounded-full bg-[#e6e1fa] text-[#6f61c4]"><ArrowRight className="size-5" /></span>
    </div>
  </article>;
}
