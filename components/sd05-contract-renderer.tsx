import type { ReactNode } from "react";
import { CheckCircle2, Clock3, FileCheck2, ShieldCheck } from "lucide-react";
import { GandoMark } from "@/components/gando-mark";
import type { SD05Content } from "@/lib/sd-stage-content";

export type SD05SignatureSummary = {
  id: string;
  signerName: string;
  signerEmail: string;
  signerRole: string | null;
  signerOrganization: string | null;
  status: string;
  contractHash: string;
  signedPayloadHash: string | null;
  sentAt: string | null;
  firstViewedAt: string | null;
  signedAt: string | null;
  expiresAt: string | null;
  signatureMode?: "typed" | "drawn" | null;
  signatureName?: string | null;
  signatureDataUrl?: string | null;
  signatureDataHash?: string | null;
  initials?: Record<string, string> | null;
  documentPageCount?: number | null;
  initialsCompletedAt?: string | null;
};

type BlockKind = "major" | "article" | "h2" | "h3" | "h4" | "subsection" | "bullet" | "paragraph";
type RenderBlock = { text: string; kind: BlockKind };

function dateLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined }).format(date);
}

function statusLabel(status: string) {
  if (status === "signed") return "Signé";
  if (status === "viewed") return "Consulté";
  if (status === "sent") return "Envoyé";
  if (status === "expired") return "Expiré";
  if (status === "revoked") return "Révoqué";
  if (status === "failed") return "Échec d'envoi";
  return "À signer";
}

function blockKind(raw: string): BlockKind {
  const value = raw.trim();
  if (/^(?:H2:\s*|##\s+)/i.test(value)) return "h2";
  if (/^(?:H3:\s*|###\s+)/i.test(value)) return "h3";
  if (/^(?:H4:\s*|####\s+)/i.test(value)) return "h4";
  if (/^(PRÉAMBULE|PREAMBULE|ENTRÉE EN VIGUEUR|ENTREE EN VIGUEUR|PREUVE ET SIGNATURE ÉLECTRONIQUE|DROIT APPLICABLE ET JURIDICTION)$/i.test(value)) return "major";
  if (/^(ARTICLE\s+\d+|ANNEXE\s+\d+)/i.test(value)) return "article";
  if (/^\d+\.\d+\.?\s+/i.test(value)) return "subsection";
  if (/^(?:[-–•]\s+)/.test(value)) return "bullet";
  return "paragraph";
}

function displayText(raw: string) {
  return raw.trim().replace(/^(?:H2:|H3:|H4:)\s*/i, "").replace(/^#{2,4}\s+/, "").trim();
}

function weight(block: RenderBlock) {
  if (["major", "article", "h2"].includes(block.kind)) return 1.35 + Math.ceil(block.text.length / 520) * 0.25;
  if (["h3", "subsection"].includes(block.kind)) return 0.9 + Math.ceil(block.text.length / 600) * 0.3;
  if (block.kind === "h4") return 0.7 + Math.ceil(block.text.length / 650) * 0.22;
  return Math.max(0.7, Math.ceil(block.text.length / 520) * 0.85);
}

function paginate(body: string): RenderBlock[][] {
  const source = body.split(/\n{2,}/).map(item => item.trim()).filter(Boolean).map(raw => ({ kind: blockKind(raw), text: displayText(raw) }));
  if (!source.length) return [[]];
  const pages: RenderBlock[][] = [];
  let page: RenderBlock[] = [];
  let used = 0;
  for (const block of source) {
    const next = weight(block);
    if (page.length && used + next > 6.2) { pages.push(page); page = []; used = 0; }
    page.push(block); used += next;
  }
  if (page.length) pages.push(page);
  return pages;
}

function ContractBlock({ block, articleColor }: { block: RenderBlock; articleColor: string }) {
  if (block.kind === "major") return <h2 className="pt-1 text-[17px] font-black uppercase tracking-[0.02em]" style={{ color: articleColor }}>{block.text}</h2>;
  if (block.kind === "article" || block.kind === "h2") return <h2 className="pt-2 text-[16px] font-black uppercase tracking-[0.01em]" style={{ color: articleColor }}>{block.text}</h2>;
  if (block.kind === "h3") return <h3 className="pt-1 text-[14px] font-black leading-5 text-slate-950">{block.text}</h3>;
  if (block.kind === "h4") return <h4 className="pt-1 text-[12px] font-bold uppercase tracking-[0.035em] text-slate-700">{block.text}</h4>;
  if (block.kind === "subsection") return <h3 className="pt-1 text-[13px] font-black leading-5 text-slate-950">{block.text}</h3>;
  if (block.kind === "bullet") return <p className="whitespace-pre-line pl-5 text-[12px] leading-[1.65] text-slate-700">{block.text}</p>;
  return <p className="whitespace-pre-line text-[12px] leading-[1.7] text-slate-700">{block.text}</p>;
}

function ContractFooter({ content, pageNumber, totalPages, signatures, initialsByPage }: { content: SD05Content; pageNumber: number; totalPages: number; signatures: SD05SignatureSummary[]; initialsByPage?: Record<string, string> }) {
  const key = String(pageNumber);
  const values = [initialsByPage?.[key], ...signatures.map(item => item.initials?.[key]).filter(Boolean)].filter(Boolean) as string[];
  const initials = [...new Set(values.map(value => value.trim()).filter(Boolean))];
  return <footer className="mt-auto border-t border-slate-200 pt-3"><div className="relative min-h-[52px] text-center">
    <div className="flex items-center justify-center gap-1 text-[11px] font-black text-slate-700"><span className="text-[17px] leading-none">G</span><span>gando</span></div>
    {initials.length ? <div className="absolute right-0 top-0 flex items-center gap-1.5">{initials.map((item, index) => <div key={`${item}-${index}`} className="min-w-[50px] rounded-md border border-[#735DF3]/20 bg-white px-2 py-1 font-serif text-[14px] italic text-[#4f3ec2] shadow-sm">{item}</div>)}</div> : content.requireInitialsEachPage ? <div className="absolute right-0 top-0 rounded-md border border-dashed border-slate-300 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Paraphe</div> : null}
    <p className="mx-auto mt-2 max-w-[92%] text-[7px] leading-[1.35] text-slate-400">{content.footerConfidentialityText}</p>
    <div className="mt-1 text-[7px] font-semibold text-slate-300">Page {pageNumber} / {totalPages}</div>
  </div></footer>;
}

function PageShell({ content, pageNumber, totalPages, signatures, initialsByPage, children, compact }: { content: SD05Content; pageNumber: number; totalPages: number; signatures: SD05SignatureSummary[]; initialsByPage?: Record<string, string>; children: ReactNode; compact: boolean }) {
  const legal = content.contractTemplate === "legal_convention";
  const bandColor = legal ? "#323232" : "#735DF3";
  return <article className="relative mx-auto flex min-h-[1080px] w-full max-w-[820px] flex-col overflow-hidden rounded-[4px] border border-slate-200 bg-white text-slate-950 shadow-[0_16px_50px_rgba(15,23,42,0.08)] print:min-h-[1120px] print:break-after-page print:border-0 print:shadow-none">
    <div className="relative h-[40px] shrink-0" style={{ backgroundColor: bandColor }}><GandoMark tone={legal ? "dark" : "purple"} className="absolute left-1/2 top-[7px] z-10 h-[46px] w-[46px] -translate-x-1/2 rounded-full drop-shadow-[0_2px_2px_rgba(0,0,0,0.22)]" /></div>
    <div className={compact ? "flex flex-1 flex-col px-6 pb-5 pt-8 sm:px-8" : "flex flex-1 flex-col px-8 pb-6 pt-9 sm:px-12 lg:px-14"}>{children}<ContractFooter content={content} pageNumber={pageNumber} totalPages={totalPages} signatures={signatures} initialsByPage={initialsByPage} /></div>
  </article>;
}

function SignatureVisual({ evidence, fallbackName }: { evidence?: SD05SignatureSummary; fallbackName: string }) {
  if (!evidence || evidence.status !== "signed") return <div className="mt-5 h-[64px] rounded-lg border border-dashed border-slate-200" />;
  if (evidence.signatureMode === "drawn" && evidence.signatureDataUrl) return <div className="mt-4 flex h-[72px] items-center"><img src={evidence.signatureDataUrl} alt={`Signature de ${fallbackName}`} className="max-h-[68px] max-w-full object-contain" /></div>;
  return <div className="mt-4 flex h-[72px] items-center text-[30px] italic text-slate-900" style={{ fontFamily: "'Segoe Script','Snell Roundhand','Brush Script MT',cursive" }}>{evidence.signatureName || fallbackName}</div>;
}

export function SD05ContractRenderer({ content, companyName, contractHash, signatures = [], initialsByPage, compact = false }: { content: SD05Content; companyName?: string; contractHash?: string | null; signatures?: SD05SignatureSummary[]; initialsByPage?: Record<string, string>; compact?: boolean }) {
  const clientSigner = content.signatories.find(item => item.organization !== "GANDO SOLUTIONS") || content.signatories[0];
  const gandoSigner = content.signatories.find(item => item.organization === "GANDO SOLUTIONS") || content.signatories[1];
  const bodyPages = paginate(content.contractSummary);
  const totalPages = bodyPages.length + 2;
  const legal = content.contractTemplate === "legal_convention";
  const articleColor = legal ? "#735DF3" : "#5d49dc";

  return <div className="space-y-5 print:space-y-0">
    <PageShell content={content} pageNumber={1} totalPages={totalPages} signatures={signatures} initialsByPage={initialsByPage} compact={compact}>
      <section className={legal ? "pt-4 text-center" : "pt-2"}><div className={legal ? "mx-auto max-w-[680px]" : "max-w-[680px]"}><div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">SD05 · {legal ? "Convention juridique" : "Contrat Gando"}</div><h1 className={legal ? "mt-5 text-[33px] font-black tracking-[-0.035em]" : "mt-3 text-[31px] font-black tracking-[-0.04em]"}>{content.contractTitle || "Contrat Gando"}</h1><p className="mt-3 text-[11px] font-semibold text-[#735DF3]">{content.contractReference || "Référence à compléter"} · {content.contractVersion || "Version à compléter"}</p></div></section>

      <section className={legal ? "mt-12 space-y-10" : "mt-9 grid gap-8 sm:grid-cols-2"}>
        <div className={legal ? "text-left" : ""}><div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#735DF3]">Entre :</div><div className="mt-3 text-[12px] leading-6 text-slate-700"><strong className="text-[14px] text-slate-950">GANDO SOLUTIONS</strong><br />Société par actions simplifiée au capital de 1 000,00 euros<br />RCS Meaux 943 391 201<br />3 chemin de la porte verte, 77144 Montévrain<br />Représentée par {gandoSigner?.name || "Bilayl MATOU"}, {gandoSigner?.role || "Président"}<br />contact@gando.app</div>{legal ? <div className="mt-4 text-right text-[12px] font-semibold text-slate-600">Ci-après dénommée « Gando », d'une part,</div> : null}</div>
        <div className={legal ? "text-left" : "sm:text-right"}><div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#735DF3]">Et :</div><div className="mt-3 text-[12px] leading-6 text-slate-700"><strong className="text-[14px] text-slate-950">{companyName || clientSigner?.organization || "Société cliente"}</strong><br />{clientSigner?.name ? <>Représentée par {clientSigner.name}<br /></> : null}{clientSigner?.role ? <>{clientSigner.role}<br /></> : null}{clientSigner?.email || "Coordonnées du signataire à compléter"}</div>{legal ? <div className="mt-4 text-right text-[12px] font-semibold text-slate-600">Ci-après dénommée le « Partenaire », d'autre part,</div> : null}</div>
      </section>
      {legal ? <p className="mt-8 text-center text-[12px] text-slate-600">Ci-après conjointement désignées les « Parties » ou individuellement la « Partie ».</p> : null}

      {content.legalItems.length ? <section className="mt-10"><div className="mb-3 text-[12px] font-black uppercase tracking-[0.08em] text-slate-700">Conditions particulières</div><div className="overflow-hidden rounded-lg border border-slate-200">{content.legalItems.map((item, index) => <div key={`${item.topic}-${index}`} className="grid gap-1 border-b border-slate-200 px-4 py-3 text-[11px] last:border-b-0 sm:grid-cols-[210px_1fr]"><strong>{item.topic}</strong><span className="leading-5 text-slate-600">{item.notes || "À compléter"}</span></div>)}</div></section> : null}
      <section className="mt-8 rounded-lg bg-slate-50 p-4"><div className="grid gap-4 text-[11px] text-slate-600 sm:grid-cols-2"><div><span className="font-black text-slate-900">Date de mise en production</span><br />{dateLabel(content.goLiveDate || content.effectiveDate)}</div><div><span className="font-black text-slate-900">Durée initiale</span><br />{content.term || "À compléter"}</div><div><span className="font-black text-slate-900">Renouvellement</span><br />{content.renewal || "À compléter"}</div><div><span className="font-black text-slate-900">Préavis / résiliation</span><br />{content.terminationNotice || "À compléter"}</div></div></section>
    </PageShell>

    {bodyPages.map((blocks, index) => <PageShell key={index} content={content} pageNumber={index + 2} totalPages={totalPages} signatures={signatures} initialsByPage={initialsByPage} compact={compact}><div className="space-y-4 pt-1">{blocks.length ? blocks.map((block, blockIndex) => <ContractBlock key={`${index}-${blockIndex}`} block={block} articleColor={articleColor} />) : <p className="text-sm italic text-slate-500">Le texte contractuel doit être renseigné avant l'envoi en signature.</p>}</div></PageShell>)}

    <PageShell content={content} pageNumber={totalPages} totalPages={totalPages} signatures={signatures} initialsByPage={initialsByPage} compact={compact}>
      <section className="pt-2"><div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#735DF3]">Signature des Parties</div><h2 className="mt-2 text-[25px] font-black tracking-[-0.03em]">Fait et signé électroniquement</h2><p className="mt-3 max-w-2xl text-[12px] leading-6 text-slate-600">Chaque Partie reconnaît avoir reçu un exemplaire électronique du contrat. La version signée est figée et reliée au dossier de preuve par son empreinte cryptographique.</p></section>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">{content.signatories.map((signer, index) => { const evidence = signatures.find(item => item.signerEmail.toLowerCase() === signer.email.toLowerCase() && item.status === "signed") || signatures.find(item => item.signerEmail.toLowerCase() === signer.email.toLowerCase()); const signed = evidence?.status === "signed" || signer.signatureStatus === "signed"; return <div key={`${signer.email}-${index}`} className="min-h-[220px] rounded-xl border border-slate-200 p-5"><div className="flex items-start justify-between gap-3"><div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#735DF3]">Pour {signer.organization || (index === 0 ? "le Client" : "GANDO SOLUTIONS")}</div><span className={signed ? "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700" : "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600"}>{signed ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}{statusLabel(evidence?.status || signer.signatureStatus || "pending")}</span></div><div className="mt-5 text-[12px]"><div><strong>Nom</strong> {signer.name || "À compléter"}</div><div className="mt-1"><strong>Fonction</strong> {signer.role || "À compléter"}</div>{evidence?.signedAt ? <div className="mt-1"><strong>Le</strong> {dateLabel(evidence.signedAt)}</div> : null}</div><SignatureVisual evidence={evidence} fallbackName={signer.name || "Signature"} /></div>; })}</div>
      {contractHash ? <div className="mt-8 grid gap-3 rounded-xl bg-slate-950 p-5 text-white sm:grid-cols-3"><div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" /><div><div className="text-xs font-bold">Intégrité</div><div className="mt-1 text-[10px] leading-4 text-slate-300">Document figé par SHA-256.</div></div></div><div className="flex gap-2"><FileCheck2 className="mt-0.5 h-4 w-4 text-emerald-300" /><div><div className="text-xs font-bold">Traçabilité</div><div className="mt-1 text-[10px] leading-4 text-slate-300">Horodatages et audit conservés.</div></div></div><div className="min-w-0 text-[9px] leading-4 text-slate-400"><strong className="text-slate-200">Empreinte</strong><div className="break-all font-mono">{contractHash}</div></div></div> : null}
    </PageShell>
  </div>;
}
