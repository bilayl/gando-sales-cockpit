import { ExternalLink, FileText } from "lucide-react";
import type { SD04Content } from "@/lib/sd-stage-content";
import { SD04PartnerRevenueSimulator } from "@/components/sd04-partner-revenue-simulator";

type Props = {
  content: Partial<SD04Content>;
  companyName?: string;
  compact?: boolean;
  language?: "fr" | "en";
};

// The enterprise SD04 body deliberately reuses the exact visual vocabulary of
// the quick-deal public proposal. The enterprise page's header and banner stay
// outside this component and are never modified.
function ProposalList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return <ul className="space-y-3.5">{items.map((item, index) => <li key={`${index}-${item}`} className="flex gap-3 text-[16px] leading-7 text-[#465157]"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7166c7]" /><span>{item}</span></li>)}</ul>;
}

function PricingCards({ pricing, compact }: { pricing: SD04Content["pricing"]; compact: boolean }) {
  if (!pricing.length) return null;
  return <div className={compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"}>{pricing.map((row, index) => <div key={`${row.item}-${index}`} className="rounded-[16px] border border-[#dedcf0] bg-[#f8f7ff] p-4">
    <div className="text-[12px] font-bold uppercase tracking-[0.11em] text-[#7166c7]">{row.item}</div>
    <div className="mt-2 text-[27px] font-semibold tracking-[-0.035em] text-[#211f32]">{row.price || "À définir"}</div>
    {row.notes ? <div className="mt-2 text-[13px] leading-5 text-[#6c697c]">{row.notes}</div> : null}
  </div>)}</div>;
}

function isCollection(text: string) {
  return /encaissement/i.test(text);
}

function percentFromRow(row?: SD04Content["pricing"][number]): number | null {
  const match = row?.price.match(/(?:^|\s)\+?\s*(\d+(?:[.,]\d+)?)\s*%/);
  if (!match) return null;
  const rate = Number(match[1].replace(",", "."));
  return Number.isFinite(rate) && rate >= 0 ? rate : null;
}

export function SD04ProposalVisual({ content, compact = false, language = "fr" }: Props) {
  const tr = (fr: string, en: string) => language === "en" ? en : fr;
  const legacyPdf = /^https?:\/\/\S+$/i.test(content.deckSubtitle || "") ? content.deckSubtitle || "" : "";
  const mode = content.presentationMode || (legacyPdf || content.proposalFileUrl ? "file" : "visual");
  const fileUrl = /^https?:\/\/\S+$/i.test(content.proposalFileUrl || "") ? content.proposalFileUrl || "" : legacyPdf;
  const title = content.proposalFileName || content.deckTitle || tr("Proposition commerciale", "Commercial proposal");
  const pdfFile = /\.pdf(?:[?#]|$)/i.test(fileUrl) || Boolean(legacyPdf);

  if (mode === "file") {
    return <section className="rounded-[20px] border border-[#e0e4e6] bg-white p-6 sm:p-8">
      <div className="rounded-xl border border-[#dedcf0] bg-[#f8f7ff] p-5">
        <div className="text-xs font-bold uppercase tracking-wider text-[#7166c7]">{tr("Document commercial joint à la proposition", "Commercial document attached to the proposal")}</div>
        <p className="mt-2 text-sm text-[#53536d]">{tr("Consultez le fichier de l’offre avant de donner votre accord.", "Read the offer before approving it.")}</p>
        {fileUrl ? <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#211f32] px-4 py-2.5 text-sm font-semibold text-white"><FileText className="h-4 w-4" />{tr("Ouvrir", "Open")} {title}<ExternalLink className="h-4 w-4" /></a> : <p className="mt-4 text-sm text-[#687277]">{tr("Document non disponible.", "Document unavailable.")}</p>}
      </div>
      {fileUrl && pdfFile ? <iframe src={`${fileUrl.split("#")[0]}#toolbar=0&navpanes=0&view=FitH`} title={title} className={compact ? "mt-5 h-[480px] w-full rounded-xl border border-[#e1e4e6] bg-white" : "mt-5 hidden h-[680px] w-full rounded-xl border border-[#e1e4e6] bg-white md:block"} /> : null}
    </section>;
  }

  const pricing = (content.pricing || []).filter(row => Boolean(row.item?.trim()));
  const primaryPricing = pricing.filter(row => !isCollection(row.item));
  const terms = (content.commercialTerms || []).filter(Boolean);
  const mainTerms = terms.filter(item => !isCollection(item));
  const collectionRows = pricing.filter(row => isCollection(row.item));
  const collectionTerms = Array.from(new Set(terms.filter(item => isCollection(item)))).filter(
    item => !collectionRows.some(row => item.includes(row.price) && row.price.trim()),
  );
  const revenueExample = content.partnerRevenueExample;
  // The public API intentionally excludes gandoEconomics. Read the agreed renter
  // rate exclusively from the published, customer-visible pricing rows.
  const quotedCustomerRate = percentFromRow(pricing.find(row => /^(tarif total client|prix locataire|frais (?:totaux? )?(?:pour le )?locataire)$/i.test(row.item.trim())));
  const gandoRate = percentFromRow(pricing.find(row => /^(tarif gando|frais de sécurisation gando)$/i.test(row.item.trim())));
  const quotedPartnerRate = percentFromRow(pricing.find(row => /^(marge partenaire|marge loueur)$/i.test(row.item.trim())));
  const clientRate = quotedCustomerRate ?? (gandoRate !== null
    ? gandoRate + (quotedPartnerRate ?? revenueExample?.partnerMarginRate ?? 0)
    : null);
  // Keep the interactive revenue example visible even if an older enterprise
  // proposal stored the legacy optional flag as disabled.
  const partnerReady = Boolean(revenueExample && Number.isFinite(revenueExample.partnerMarginRate));
  const solution = (content.solution || []).filter(Boolean);
  const proofPoints = (content.proofPoints || []).filter(Boolean);
  const problem = (content.problem || []).filter(Boolean);
  const rollout = (content.rolloutPlan || []).filter(Boolean);
  const businessCase = (content.businessCase || []).filter(item => item.metric?.trim());

  return <section className="rounded-[20px] border border-[#e0e4e6] bg-white p-6 sm:p-8">
    {(content.deckTitle?.trim() || (!legacyPdf && content.deckSubtitle?.trim()) || content.executiveMessage?.trim()) ? <div className="mb-7 border-b border-[#eceeef] pb-6">
      {content.deckTitle?.trim() ? <h3 className="text-[22px] font-semibold tracking-[-0.035em] text-[#211f32]">{content.deckTitle}</h3> : null}
      {!legacyPdf && content.deckSubtitle?.trim() ? <p className="mt-2 text-[14px] leading-6 text-[#6c697c]">{content.deckSubtitle}</p> : null}
      {content.executiveMessage?.trim() ? <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-[#59646a]">{content.executiveMessage}</p> : null}
    </div> : null}

    {primaryPricing.length ? <div>
      <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#687277]">{tr("Tarification", "Pricing")}</div>
      <p className="mt-2 max-w-2xl text-[15px] leading-7 text-[#687277]">{tr("Les éléments clés sont présentés immédiatement, comme dans une propal commerciale : tarif, marge éventuelle et conditions principales.", "Key commercial terms at a glance: rates, partner margin and core conditions.")}</p>
      <div className="mt-5"><PricingCards pricing={primaryPricing} compact={compact} /></div>
    </div> : null}

    {(collectionRows.length > 0 || collectionTerms.length > 0) ? <div className="mt-4 rounded-[24px] bg-[#f6f6f7] px-5 py-4 text-[14px] leading-7 text-[#65707d] sm:px-6 sm:py-5 sm:text-[15px]">
      <p><strong className="font-semibold text-[#222b34]">{tr("Frais d’encaissement", "Collection fees")} :</strong>{" "}
        {collectionRows.map((row, index) => <span key={`${row.item}-${index}`}>{index > 0 ? " · " : ""}<strong className="font-semibold text-[#222b34]">{row.price}</strong>{row.notes ? <> · {row.notes}</> : null}</span>)}
        {collectionTerms.map((item, index) => <span key={index}>{collectionRows.length || index > 0 ? " · " : ""}{item}</span>)}
      </p>
    </div> : null}

    {partnerReady && revenueExample ? <SD04PartnerRevenueSimulator
      averageDeposit={revenueExample.averageDeposit}
      monthlyActivations={revenueExample.monthlyActivations}
      partnerMarginRate={revenueExample.partnerMarginRate}
      customerRatePercent={clientRate}
      compact={compact}
      language={language}
    /> : null}

    {solution.length ? <div className={primaryPricing.length || partnerReady ? "mt-7 border-t border-[#eceeef] pt-6" : ""}>
      <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#687277]">{tr("Ce que comprend l’offre", "What's included")}</div>
      <div className="mt-4"><ProposalList items={solution} /></div>
    </div> : null}

    {mainTerms.length ? <div className="mt-7 border-t border-[#eceeef] pt-6">
      <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#687277]">{tr("Conditions commerciales", "Commercial terms")}</div>
      <div className="mt-4"><ProposalList items={mainTerms} /></div>
    </div> : null}

    {proofPoints.length ? <div className="mt-7 border-t border-[#eceeef] pt-6">
      <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#687277]">{tr("Pourquoi Gando", "Why Gando")}</div>
      <div className="mt-4"><ProposalList items={proofPoints} /></div>
    </div> : null}

    {problem.length ? <div className="mt-7 border-t border-[#eceeef] pt-6">
      <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#687277]">{tr("Les enjeux", "Challenges")}</div>
      <div className="mt-4"><ProposalList items={problem} /></div>
    </div> : null}

    {businessCase.length ? <div className="mt-7 border-t border-[#eceeef] pt-6">
      <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#687277]">{tr("Impact attendu", "Expected impact")}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{businessCase.map((row,index) => <div key={index} className="rounded-[16px] border border-[#dedcf0] bg-[#f8f7ff] p-4"><div className="text-[12px] font-bold uppercase tracking-[0.11em] text-[#7166c7]">{row.metric}</div><div className="mt-2 text-[22px] font-semibold tracking-tight text-[#211f32]">{row.value || row.target || "—"}</div>{row.baseline ? <p className="mt-2 text-[13px] text-[#6c697c]">{tr("Situation initiale", "Baseline")} : {row.baseline}</p> : null}</div>)}</div>
    </div> : null}

    {rollout.length ? <div className="mt-7 border-t border-[#eceeef] pt-6">
      <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#687277]">{tr("Déploiement", "Rollout")}</div>
      <div className="mt-4"><ProposalList items={rollout} /></div>
    </div> : null}

  </section>;
}
