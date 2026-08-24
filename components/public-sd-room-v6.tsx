"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, CheckCircle2, ChevronRight, Download, ExternalLink, FileSignature, FileText, Languages, Loader2, LockKeyhole, MessageSquare, ShieldCheck } from "lucide-react";
import { GandoMark } from "@/components/gando-mark";
import { SD01KeyPeoplePublic } from "@/components/sd01-key-people-public";
import { SDRoomBrandBanner } from "@/components/sd-room-brand-banner";
import { SD_CODES, SD_STAGE_META, type SD01Content, type SDCode, type SDDocumentRecord, type SDRoomBrandTheme } from "@/lib/sd-room-types";
import type { SD02Content, SD03Content, SD04Content, SD05Content } from "@/lib/sd-stage-content";

type PublicDocument = SDDocumentRecord & {
  validated_at?: string | null;
  validated_by_first_name?: string | null;
  validated_by_last_name?: string | null;
};

type PublicRoomData = {
  room: {
    id: string;
    title: string;
    companyName: string;
    companyLogoUrl: string | null;
    bannerImageUrl: string | null;
    theme: SDRoomBrandTheme;
    displayTitle: string;
    displaySubtitle: string;
    currentStage: SDCode;
    updatedAt: string;
  };
  documents: PublicDocument[];
  visitorEmail: string;
  visitorFirstName: string;
  visitorLastName: string;
};

const OPTIONAL_CODES: SDCode[] = ["SD03", "SD04"];
type RoomLanguage = "fr" | "en";
const tr = (language: RoomLanguage, fr: string, en: string) => language === "en" ? en : fr;

const cleanPdfViewerUrl = (url: string) => url ? `${url.split("#")[0]}#toolbar=0&navpanes=0&scrollbar=1&view=FitH` : "";

function stageTitle(code: SDCode, language: RoomLanguage = "fr") {
  if (language === "en") return ({ SD01: "Summary", SD02: "Action plan", SD03: "Solution & integration", SD04: "Commercial PDF", SD05: "Contract & signature" } as Record<SDCode, string>)[code];
  return code === "SD04" ? "PDF commercial" : SD_STAGE_META[code].title;
}

function formatDate(value?: string | null, language: RoomLanguage = "fr") {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
  } catch {
    return value || "";
  }
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#687277]">{children}</div>;
}

function Section({ title, children, kicker }: { title: string; children: React.ReactNode; kicker?: string }) {
  return <section className="rounded-[18px] border border-[#e0e4e6] bg-white px-5 py-6 shadow-[0_1px_2px_rgba(20,30,35,0.025)] sm:px-8 sm:py-8">
    {kicker ? <Eyebrow>{kicker}</Eyebrow> : null}
    <h2 className="mt-1 text-[21px] font-semibold tracking-[-0.025em] text-[#172126] sm:text-[23px]">{title}</h2>
    <div className="mt-5 text-[15px] leading-7 text-[#465157]">{children}</div>
  </section>;
}

function AccordionSection({ title, children, kicker }: { title: string; children: React.ReactNode; kicker?: string }) {
  return <details className="group overflow-hidden rounded-[18px] border border-[#e0e4e6] bg-white shadow-[0_1px_2px_rgba(20,30,35,0.025)]">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 transition hover:bg-[#fafbfb] sm:px-8 sm:py-6 [&::-webkit-details-marker]:hidden">
      <div className="min-w-0">
        {kicker ? <Eyebrow>{kicker}</Eyebrow> : null}
        <h2 className="mt-1 text-[21px] font-semibold tracking-[-0.025em] text-[#172126] sm:text-[23px]">{title}</h2>
      </div>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#e0e4e6] bg-[#f7f8f8] text-[#687277] transition-transform group-open:rotate-90">
        <ChevronRight className="h-4 w-4" />
      </span>
    </summary>
    <div className="border-t border-[#eceeef] px-5 py-5 text-[15px] leading-7 text-[#465157] sm:px-8 sm:py-6">{children}</div>
  </details>;
}

function BulletList({ items, empty = "À confirmer" }: { items?: string[]; empty?: string }) {
  if (!items?.length) return <p className="italic text-[#81898e]">{empty}</p>;
  return <ul className="space-y-3">{items.map((item, index) => <li key={`${index}-${item.slice(0, 24)}`} className="flex gap-3"><span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#7166c7]" /><span>{item}</span></li>)}</ul>;
}

function PairGrid({ leftTitle, left, rightTitle, right }: { leftTitle: string; left: React.ReactNode; rightTitle: string; right: React.ReactNode }) {
  return <div className="grid gap-6 lg:grid-cols-2">
    <div><h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6f797e]">{leftTitle}</h3>{left}</div>
    <div><h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6f797e]">{rightTitle}</h3>{right}</div>
  </div>;
}

function stageStatus(status: string, language: RoomLanguage) {
  if (status === "done") return { label: tr(language, "Terminé", "Done"), classes: "bg-[#edf7ef] text-[#376b43]" };
  if (status === "in_progress") return { label: tr(language, "En cours", "In progress"), classes: "bg-[#f3f0ff] text-[#5c50ae]" };
  return { label: tr(language, "À faire", "To do"), classes: "bg-[#f1f3f4] text-[#60696e]" };
}

function SD01Document({ content, language }: { content: SD01Content; language: RoomLanguage }) {
  return <div className="space-y-5 sm:space-y-6">
    <AccordionSection title={tr(language, "Synthèse exécutive", "Executive summary")} kicker={tr(language, "SD01 · Compréhension commune", "SD01 · Shared understanding")}><p className="text-[18px] font-medium leading-8 text-[#202a2f]">{content.executiveSummary || tr(language, "Synthèse en cours de validation.", "Summary pending approval.")}</p></AccordionSection>
    {content.stakeholders?.length ? <SD01KeyPeoplePublic stakeholders={content.stakeholders} language={language} /> : null}
    <AccordionSection title={tr(language, "Contexte", "Context")}><div className="grid gap-5 sm:grid-cols-[170px_1fr]"><div><Eyebrow>{tr(language, "Secteur", "Industry")}</Eyebrow><div className="mt-2 font-semibold text-[#202a2f]">{content.companyProfile?.sector || "À confirmer"}</div></div><div><Eyebrow>{tr(language, "Entreprise", "Company")}</Eyebrow><p className="mt-2">{content.companyProfile?.description || "À compléter"}</p></div></div>{content.companyProfile?.context ? <p className="mt-5 border-t border-[#eceeef] pt-5">{content.companyProfile.context}</p> : null}</AccordionSection>
    <Section title={tr(language, "Enjeux prioritaires", "Top priorities")}>{content.painPoints?.length ? <div className="space-y-5">{content.painPoints.map((pain, index) => <div key={index} className="border-b border-[#eceeef] pb-5 last:border-0 last:pb-0"><div className="font-semibold text-[#202a2f]">{pain.title}</div><div className="mt-2"><BulletList items={pain.details} /></div></div>)}</div> : <p className="italic text-[#81898e]">Enjeux à préciser.</p>}</Section>
    <AccordionSection title={tr(language, "Réponse envisagée", "Proposed response")}>{content.solutionFit?.length ? <div className="divide-y divide-[#eceeef]">{content.solutionFit.map((item, index) => <div key={index} className="grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-2"><div className="font-semibold text-[#202a2f]">{item.need}</div><div>{item.response}</div></div>)}</div> : <p className="italic text-[#81898e]">Réponse à préciser.</p>}</AccordionSection>
    <Section title={tr(language, "Décisions et prochaines étapes", "Decisions & next steps")}><PairGrid leftTitle={tr(language, "Décisions", "Decisions")} left={<BulletList items={content.decisions} />} rightTitle={tr(language, "Prochaines actions", "Next actions")} right={<BulletList items={(content.nextSteps || []).map(step => `${step.owner || tr(language, "À définir", "TBD")} — ${step.action}${step.dueDate ? ` · ${formatDate(step.dueDate, language)}` : ""}`)} />} /></Section>
  </div>;
}

function SD02Document({ content, language }: { content: SD02Content; language: RoomLanguage }) {
  const steps = content.milestones || [];
  return <div className="space-y-5 sm:space-y-6"><Section title={tr(language, "Plan d’action", "Action plan")} kicker={tr(language, "SD02 · Les étapes à franchir ensemble", "SD02 · Steps to complete together")}>
    {steps.length ? <div className="relative"><div className="absolute bottom-8 left-[15px] top-8 w-px bg-[#d9dde0] sm:left-[19px]" /><div className="space-y-4">{steps.map((item, index) => {
      const status = stageStatus(item.status, language);
      return <article key={`${item.milestone}-${index}`} className="relative grid grid-cols-[32px_1fr] gap-3 sm:grid-cols-[40px_1fr] sm:gap-4">
        <div className="relative z-10 mt-4 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[#6e62c3] font-mono text-[10px] font-semibold text-white shadow-sm sm:h-10 sm:w-10">{String(index + 1).padStart(2, "0")}</div>
        <div className="rounded-[14px] border border-[#e1e5e7] bg-white p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><h3 className="text-[17px] font-semibold leading-6 text-[#202a2f]">{item.milestone}</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.classes}`}>{status.label}</span></div><div className="mt-4 grid gap-3 border-t border-[#eceeef] pt-4 text-[13px] sm:grid-cols-2"><div><Eyebrow>{tr(language, "Responsable", "Owner")}</Eyebrow><div className="mt-1 font-medium text-[#4c565b]">{item.owner || tr(language, "À définir", "TBD")}</div></div><div><Eyebrow>{tr(language, "Échéance", "Due date")}</Eyebrow><div className="mt-1 font-medium text-[#4c565b]">{formatDate(item.dueDate, language) || tr(language, "À définir", "TBD")}</div></div></div>{item.dependency ? <div className="mt-3 rounded-lg bg-[#f6f7f8] px-3 py-2 text-[12px] text-[#687277]"><strong>{tr(language, "Dépendance :", "Dependency:")}</strong> {item.dependency}</div> : null}</div>
      </article>;
    })}</div></div> : <p className="italic text-[#81898e]">{tr(language, "Aucune étape définie.", "No step defined yet.")}</p>}
  </Section></div>;
}

function SD03Document({ content, language }: { content: SD03Content; language: RoomLanguage }) {
  return <div className="space-y-5 sm:space-y-6">
    <Section title={tr(language, "Solution retenue", "Selected solution")} kicker={tr(language, "SD03 · Solution & intégration", "SD03 · Solution & integration")}><p className="text-[18px] font-medium leading-8 text-[#202a2f]">{content.solutionSummary || "Solution à finaliser."}</p></Section>
    <Section title={tr(language, "Périmètre", "Scope")}><PairGrid leftTitle={tr(language, "Inclus", "Included")} left={<BulletList items={content.scopeIn} />} rightTitle={tr(language, "Hors périmètre", "Out of scope")} right={<BulletList items={content.scopeOut} />} /></Section>
    <Section title={tr(language, "Intégration", "Integration")}><PairGrid leftTitle={tr(language, "Intégrations", "Integrations")} left={<BulletList items={content.integrations} />} rightTitle={tr(language, "Données nécessaires", "Required data")} right={<BulletList items={content.dataRequirements} />} /></Section>
    <Section title={tr(language, "Pilote", "Pilot")}><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-[#f6f7f8] p-4"><Eyebrow>{tr(language, "Périmètre", "Scope")}</Eyebrow><div className="mt-2 font-semibold text-[#202a2f]">{content.pilot?.perimeter || "À définir"}</div></div><div className="rounded-xl bg-[#f6f7f8] p-4"><Eyebrow>{tr(language, "Durée", "Duration")}</Eyebrow><div className="mt-2 font-semibold text-[#202a2f]">{content.pilot?.duration || "À définir"}</div></div></div><div className="mt-5"><Eyebrow>{tr(language, "Critères de succès", "Success criteria")}</Eyebrow><div className="mt-3"><BulletList items={content.pilot?.successMetrics} /></div></div></Section>
    <Section title={tr(language, "Déploiement", "Rollout")}><PairGrid leftTitle={tr(language, "Sécurité & conformité", "Security & compliance")} left={<BulletList items={content.securityAndCompliance} />} rightTitle={tr(language, "Plan de déploiement", "Rollout plan")} right={<BulletList items={content.deploymentPlan} />} /></Section>
  </div>;
}

function SD04Document({ content, language }: { content: SD04Content; language: RoomLanguage }) {
  const pdfUrl = /^https?:\/\//i.test(content.deckSubtitle || "") ? content.deckSubtitle : "";
  const fileName = content.deckTitle || "Offre commerciale.pdf";
  return <div className="space-y-5 sm:space-y-6"><Section title={tr(language, "Document commercial", "Commercial document")} kicker={tr(language, "SD04 · PDF commercial", "SD04 · Commercial PDF")}>
    {pdfUrl ? <div className="overflow-hidden rounded-[16px] border border-[#d9dee1] bg-[#eef0f2] shadow-sm">
      <div className="flex flex-col gap-3 border-b border-white/10 bg-[#20282d] px-4 py-3 text-white sm:flex-row sm:items-center">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10"><FileText className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{fileName}</div><div className="mt-0.5 text-[11px] text-white/55">{tr(language, "Document PDF partagé par Gando", "PDF shared by Gando")}</div></div>
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-3 text-[12px] font-semibold text-[#20282d]"><ExternalLink className="h-3.5 w-3.5" /> {tr(language, "Ouvrir en plein écran", "Open full screen")}</a>
      </div>
      <div className="p-2 sm:p-4"><iframe src={cleanPdfViewerUrl(pdfUrl)} title={fileName} className="hidden h-[780px] w-full rounded-lg border border-[#d9dee1] bg-white md:block" /><div className="grid min-h-40 place-items-center rounded-lg bg-white p-6 text-center md:hidden"><div><FileText className="mx-auto h-8 w-8 text-[#7166c7]" /><p className="mt-3 text-sm text-[#687277]">{tr(language, "Ouvrez le PDF en plein écran pour une lecture confortable.", "Open the PDF full screen for comfortable reading.")}</p></div></div></div>
    </div> : <p className="italic text-[#81898e]">{tr(language, "Aucun PDF n’a encore été publié.", "No PDF has been published yet.")}</p>}
  </Section></div>;
}

function SD05Document({ content, token, visitorEmail, language, documentStatus }: { content: SD05Content; token: string; visitorEmail: string; language: RoomLanguage; documentStatus: string }) {
  const validated = documentStatus === "validated";
  const signed = content.contractStatus === "signed" || validated;
  const ready = content.contractStatus === "ready_to_sign";
  return <div className="space-y-5 sm:space-y-6"><Section title={content.contractTitle || tr(language, "Contrat", "Contract")} kicker={tr(language, "SD05 · Contrat & signature", "SD05 · Contract & signature")}>
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3"><span className={`inline-flex rounded-full px-3 py-1.5 text-[12px] font-semibold ${signed ? "bg-[#edf7ef] text-[#376b43]" : ready ? "bg-[#f3f0ff] text-[#5c50ae]" : "bg-[#f1f3f4] text-[#60696e]"}`}>{validated ? tr(language, "Contrat validé", "Contract approved") : signed ? tr(language, "Contrat signé", "Contract signed") : ready ? tr(language, "Prêt à signer", "Ready to sign") : tr(language, "Brouillon", "Draft")}</span>{content.signatureDeadline && !validated ? <span className="text-sm text-[#687277]">{tr(language, "Signature attendue avant le", "Signature expected before")} {formatDate(content.signatureDeadline, language)}</span> : null}</div>
      <p className="max-w-2xl text-[15px] leading-7 text-[#687277]">{tr(language, "Le contrat n’est pas affiché dans la Room. Il s’ouvre dans un espace sécurisé séparé pour la consultation et la signature.", "The contract is not displayed inside the Room. It opens in a separate secure space for review and signature.")}</p>
      <div className="flex flex-wrap gap-2">
        {content.contractUrl ? <a href={content.contractUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-[#202a2f] px-5 text-[13px] font-semibold text-white"><FileSignature className="h-4 w-4" />{validated ? tr(language, "Ouvrir le contrat signé", "Open signed contract") : tr(language, "Ouvrir et signer le contrat", "Open and sign contract")}<ExternalLink className="h-4 w-4" /></a> : !validated ? <span className="text-sm italic text-[#81898e]">{tr(language, "Le lien de signature sera ajouté ici.", "The signature link will appear here.")}</span> : null}
        {validated ? <a href={`/api/public/deal-room/${encodeURIComponent(token)}/sd05-pdf?email=${encodeURIComponent(visitorEmail)}`} className="inline-flex h-11 w-fit items-center gap-2 rounded-xl border border-[#ccd2d5] bg-white px-5 text-[13px] font-semibold text-[#202a2f]"><Download className="h-4 w-4" />{tr(language, "Télécharger le contrat PDF", "Download contract PDF")}</a> : null}
      </div>
    </div>
  </Section></div>;
}

function DocumentBody({ document, token, visitorEmail, language }: { document: PublicDocument; token: string; visitorEmail: string; language: RoomLanguage }) {
  if (document.code === "SD01") return <SD01Document content={document.content as SD01Content} language={language} />;
  if (document.code === "SD02") return <SD02Document content={document.content as unknown as SD02Content} language={language} />;
  if (document.code === "SD03") return <SD03Document content={document.content as unknown as SD03Content} language={language} />;
  if (document.code === "SD04") return <SD04Document content={document.content as unknown as SD04Content} language={language} />;
  return <SD05Document content={document.content as unknown as SD05Content} token={token} visitorEmail={visitorEmail} language={language} documentStatus={document.status} />;
}

const inputStyle: React.CSSProperties = {
  color: "#111111",
  WebkitTextFillColor: "#111111",
  backgroundColor: "#ffffff",
  colorScheme: "light",
};

function AccessGate({ firstName, lastName, email, setFirstName, setLastName, setEmail, loading, error, onSubmit, language, setLanguage }: { firstName: string; lastName: string; email: string; setFirstName: (value: string) => void; setLastName: (value: string) => void; setEmail: (value: string) => void; loading: boolean; error: string; onSubmit: (event: React.FormEvent) => void; language: RoomLanguage; setLanguage: (language: RoomLanguage) => void }) {
  const inputClass = "mt-2 h-11 w-full rounded-xl border border-[#cbd2d6] bg-white px-3.5 text-[15px] !text-black outline-none placeholder:!text-[#6b7378] focus:border-[#7b6fd0] focus:ring-2 focus:ring-[#7568cf]/10";
  return <main className="min-h-screen bg-[#f5f6f7] px-5 py-8 text-[#111111] sm:px-8 sm:py-12" style={{ colorScheme: "light" }}><div className="mx-auto max-w-[760px]">
    <header className="flex items-center justify-between"><div className="flex items-center gap-2.5"><GandoMark className="h-8 w-8" /><span className="text-sm font-semibold text-black">Gando</span></div><div className="flex items-center gap-3"><div className="inline-flex rounded-lg border border-[#d9dde0] bg-white p-0.5 text-[11px] font-semibold"><button type="button" onClick={() => setLanguage("fr")} className={`rounded-md px-2 py-1 ${language === "fr" ? "bg-[#202a2f] text-white" : "text-[#4e585d]"}`}>FR</button><button type="button" onClick={() => setLanguage("en")} className={`rounded-md px-2 py-1 ${language === "en" ? "bg-[#202a2f] text-white" : "text-[#4e585d]"}`}>EN</button></div><span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#343b3f]">{tr(language, "Deal Room privée", "Private Deal Room")}</span></div></header>
    <form onSubmit={onSubmit} className="mt-10 rounded-[22px] border border-[#d8dde0] bg-white p-6 text-black shadow-[0_18px_55px_rgba(30,40,45,0.06)] sm:p-8" style={{ colorScheme: "light" }}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#30383d]">{tr(language, "Accéder à la Room", "Access the Room")}</div>
      <h1 className="mt-2 text-[34px] font-semibold tracking-[-0.04em] text-black">{tr(language, "Identifiez-vous", "Identify yourself")}</h1>
      <p className="mt-3 text-[15px] leading-7 text-[#262d31]">{tr(language, "Ces informations permettent d’attribuer les commentaires et validations.", "This information is used to attribute comments and approvals.")}</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2"><label><span className="text-[12px] font-semibold text-black">{tr(language, "Prénom", "First name")}</span><input value={firstName} onChange={event => setFirstName(event.target.value)} required autoComplete="given-name" placeholder="Prénom" className={inputClass} style={inputStyle} /></label><label><span className="text-[12px] font-semibold text-black">{tr(language, "Nom", "Last name")}</span><input value={lastName} onChange={event => setLastName(event.target.value)} required autoComplete="family-name" placeholder="Nom" className={inputClass} style={inputStyle} /></label></div>
      <label className="mt-4 block"><span className="text-[12px] font-semibold text-black">{tr(language, "Email professionnel", "Work email")}</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" placeholder="prenom@entreprise.com" className={inputClass} style={inputStyle} /></label>
      {error ? <p className="mt-4 rounded-xl bg-[#fff3f1] px-3.5 py-3 text-[13px] text-[#9a4137]">{error}</p> : null}
      <button type="submit" disabled={loading} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#202a2f] px-4 text-[14px] font-semibold text-white transition hover:bg-[#303b40] disabled:opacity-55">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {tr(language, "Entrer dans la Room", "Enter the Room")} <ChevronRight className="h-4 w-4" /></button>
      <div className="mt-4 flex items-center justify-center gap-2 text-[12px] text-[#40494e]"><ShieldCheck className="h-4 w-4 text-[#6558c8]" /> {tr(language, "Accès identifié et confidentiel", "Identified and confidential access")}</div>
    </form>
  </div></main>;
}

export function PublicSDRoomV6({ token }: { token: string }) {
  const [language, setLanguage] = useState<RoomLanguage>("fr");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [data, setData] = useState<PublicRoomData | null>(null);
  const [activeStage, setActiveStage] = useState<SDCode>("SD01");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [comment, setComment] = useState("");
  const [commentState, setCommentState] = useState<"idle" | "sending" | "sent">("idle");
  const [validating, setValidating] = useState(false);
  const openedRef = useRef(false);

  useEffect(() => {
    const requestedLanguage: RoomLanguage = new URLSearchParams(window.location.search).get("lang") === "en" ? "en" : "fr";
    setLanguage(requestedLanguage);
    const sid = sessionStorage.getItem(`gando-room-session:${token}`) || crypto.randomUUID();
    sessionStorage.setItem(`gando-room-session:${token}`, sid);
    setSessionId(sid);
    setFirstName(sessionStorage.getItem(`gando-room-first:${token}`) || "");
    setLastName(sessionStorage.getItem(`gando-room-last:${token}`) || "");
    setEmail(sessionStorage.getItem(`gando-room-email:${token}`) || "");
  }, [token]);

  const changeLanguage = useCallback((next: RoomLanguage) => { setLanguage(next); const url = new URL(window.location.href); if (next === "en") url.searchParams.set("lang", "en"); else url.searchParams.delete("lang"); window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`); }, []);

  const visitorEmail = data?.visitorEmail || "";
  const track = useCallback((eventType: string, documentCode: SDCode | null, activeSeconds = 0) => {
    if (!visitorEmail || !sessionId) return;
    void fetch(`/api/public/deal-room/${encodeURIComponent(token)}/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: visitorEmail, sessionId, eventType, documentCode, activeSeconds, metadata: { firstName, lastName } }), keepalive: true });
  }, [firstName, lastName, sessionId, token, visitorEmail]);

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/public/deal-room/${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Accès impossible");
      setData(payload);
      const available = (payload.documents as PublicDocument[]).map(item => item.code);
      setActiveStage(available.includes(payload.room.currentStage) ? payload.room.currentStage : available[0] || "SD01");
      sessionStorage.setItem(`gando-room-first:${token}`, firstName.trim());
      sessionStorage.setItem(`gando-room-last:${token}`, lastName.trim());
      sessionStorage.setItem(`gando-room-email:${token}`, payload.visitorEmail || email.trim());
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : "Accès impossible");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (!data || !sessionId || openedRef.current) return; openedRef.current = true; track("room_opened", activeStage); }, [activeStage, data, sessionId, track]);
  useEffect(() => { if (data && sessionId) track("stage_viewed", activeStage); }, [activeStage, data, sessionId, track]);
  useEffect(() => { if (!data || !sessionId) return; const interval = window.setInterval(() => { if (document.visibilityState === "visible") track("heartbeat", activeStage, 30); }, 30000); return () => window.clearInterval(interval); }, [activeStage, data, sessionId, track]);

  const currentDocument = data?.documents.find(document => document.code === activeStage) || data?.documents[0];
  const stages = useMemo(() => SD_CODES.map(code => ({ code, document: data?.documents.find(document => document.code === code) })), [data]);

  const sendComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!comment.trim() || !data || !currentDocument) return;
    setCommentState("sending");
    try {
      const response = await fetch(`/api/public/deal-room/${encodeURIComponent(token)}/comments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: data.visitorEmail, firstName, lastName, documentCode: currentDocument.code, sectionKey: currentDocument.code.toLowerCase(), body: comment.trim() }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Remarque non enregistrée");
      setComment("");
      setCommentState("sent");
      window.setTimeout(() => setCommentState("idle"), 2500);
    } catch {
      setCommentState("idle");
    }
  };

  const validateStage = async () => {
    if (!data || !currentDocument || currentDocument.status !== "published") return;
    setValidating(true);
    try {
      const response = await fetch(`/api/public/deal-room/${encodeURIComponent(token)}/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: data.visitorEmail, firstName, lastName, documentCode: currentDocument.code }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Validation impossible");
      setData(current => current ? { ...current, documents: current.documents.map(document => document.code === currentDocument.code ? payload.document : document) } : current);
    } finally {
      setValidating(false);
    }
  };

  if (!data) return <AccessGate firstName={firstName} lastName={lastName} email={email} setFirstName={setFirstName} setLastName={setLastName} setEmail={setEmail} loading={loading} error={error} onSubmit={unlock} language={language} setLanguage={changeLanguage} />;
  if (!currentDocument) return <main className="grid min-h-screen place-items-center bg-[#f5f6f7] px-5 text-center"><div><h1 className="text-2xl font-semibold text-[#202a2f]">Room en préparation</h1><p className="mt-2 text-[#6f787d]">Aucune étape n’est encore publiée.</p></div></main>;

  const validatedBy = [currentDocument.validated_by_first_name, currentDocument.validated_by_last_name].filter(Boolean).join(" ");

  return <main className="min-h-screen bg-[#f5f6f7] text-[#1c2529]">
    <header className="sticky top-0 z-50 border-b border-[#e4e7e9] bg-white/95 backdrop-blur-md"><div className="mx-auto flex h-16 max-w-[1180px] items-center gap-4 px-5 sm:px-7"><div className="flex min-w-0 items-center gap-2.5"><GandoMark className="h-8 w-8 shrink-0" /><span className="hidden text-sm font-semibold sm:inline">Gando</span><span className="text-[#b5bbc0]">/</span><span className="truncate text-sm font-medium text-[#4c565b]">{data.room.companyName}</span></div><div className="ml-auto flex items-center gap-2"><Languages className="h-3.5 w-3.5 text-[#737c81]" /><div className="inline-flex rounded-lg border border-[#dfe3e5] bg-[#f7f8f8] p-0.5 text-[11px] font-semibold"><button type="button" onClick={() => changeLanguage("fr")} className={`rounded-md px-2 py-1 ${language === "fr" ? "bg-white text-[#202a2f] shadow-sm" : "text-[#737c81]"}`}>FR</button><button type="button" onClick={() => changeLanguage("en")} className={`rounded-md px-2 py-1 ${language === "en" ? "bg-white text-[#202a2f] shadow-sm" : "text-[#737c81]"}`}>EN</button></div><div className="hidden items-center gap-2 text-[12px] text-[#737c81] sm:flex"><LockKeyhole className="h-3.5 w-3.5" /> {tr(language, "Room privée", "Private Room")}</div></div><div className="h-7 w-px bg-[#e2e5e7]" /><div className="text-right text-[11px] leading-4 text-[#737c81]"><div className="font-semibold text-[#384247]">{firstName} {lastName}</div><div className="hidden sm:block">{data.visitorEmail}</div></div></div></header>

    <SDRoomBrandBanner companyName={data.room.companyName} logoUrl={data.room.companyLogoUrl} bannerUrl={data.room.bannerImageUrl} theme={data.room.theme} title={data.room.displayTitle || `${data.room.companyName} × Gando`} subtitle={language === "en" ? "Collaboration space" : (data.room.displaySubtitle || "Espace de collaboration")} className="border-b border-[#e1e4e6]" />

    <div className="mx-auto grid max-w-[1180px] gap-8 px-5 py-9 sm:px-7 lg:grid-cols-[245px_minmax(0,790px)] lg:justify-between lg:py-12">
      <aside className="lg:sticky lg:top-24 lg:self-start"><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#687277]">{tr(language, "Parcours", "Journey")}</div><nav className="mt-4 space-y-1.5">{stages.map(({ code, document }) => {
        const active = code === currentDocument.code;
        const enabled = Boolean(document);
        const optional = OPTIONAL_CODES.includes(code);
        return <button key={code} type="button" disabled={!enabled} onClick={() => enabled && setActiveStage(code)} className={`group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${active ? "bg-white shadow-sm ring-1 ring-[#e0e4e6]" : enabled ? "hover:bg-white" : "cursor-default opacity-45"}`}><span className={`mt-0.5 font-mono text-[11px] font-semibold ${active ? "text-[#584ead]" : "text-[#7f888d]"}`}>{code.slice(2)}</span><span className="min-w-0 flex-1"><span className={`block text-[13px] font-semibold leading-5 ${active ? "text-[#202a2f]" : "text-[#505b60]"}`}>{stageTitle(code, language)}</span><span className="mt-0.5 block text-[11px] text-[#747e83]">{optional ? tr(language, "Facultatif · ", "Optional · ") : tr(language, "Obligatoire · ", "Required · ")}{document?.status === "validated" ? tr(language, "Validé", "Approved") : document?.status === "published" ? tr(language, "À valider", "To approve") : tr(language, "À venir", "Upcoming")}</span></span>{document?.status === "validated" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4f835e]" /> : active ? <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#6558c8]" /> : null}</button>;
      })}</nav></aside>

      <article className="min-w-0"><div className="mb-7 flex items-center justify-between gap-4 border-b border-[#dfe3e5] pb-5"><div><Eyebrow>{currentDocument.code}{OPTIONAL_CODES.includes(currentDocument.code) ? tr(language, " · Facultatif", " · Optional") : tr(language, " · Obligatoire", " · Required")}</Eyebrow><h2 className="mt-1 text-[30px] font-semibold tracking-[-0.035em] text-[#182227]">{stageTitle(currentDocument.code, language)}</h2></div><span className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${currentDocument.status === "validated" ? "bg-[#edf7ef] text-[#366844]" : "bg-white text-[#666f74] ring-1 ring-[#dfe3e5]"}`}>{currentDocument.status === "validated" ? tr(language, "Validé", "Approved") : tr(language, "À valider", "To approve")}</span></div>
        <DocumentBody document={currentDocument} token={token} visitorEmail={data.visitorEmail} language={language} />

        <section className="mt-7 rounded-[18px] border border-[#dfe3e5] bg-white p-5 sm:p-7">{currentDocument.status === "validated" ? <div className="flex gap-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e8f2ea] text-[#3d7049]"><Check className="h-5 w-5" /></div><div><div className="font-semibold text-[#24302c]">{tr(language, "Cette étape est validée", "This step is approved")}</div><p className="mt-1 text-[14px] leading-6 text-[#687277]">{validatedBy ? `Validée par ${validatedBy}` : "Validation enregistrée"}{currentDocument.validated_at ? ` · ${formatDate(currentDocument.validated_at)}` : ""}.</p></div></div> : <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><Eyebrow>{tr(language, "Validation", "Approval")}</Eyebrow><h3 className="mt-1 text-[21px] font-semibold tracking-[-0.02em] text-[#202a2f]">{tr(language, "Confirmez-vous le contenu de cette étape ?", "Do you approve the content of this step?")}</h3><p className="mt-2 text-[14px] leading-6 text-[#6b757a]">{tr(language, "La validation enregistre votre accord sur cette version.", "Approval records your agreement with this version.")}</p></div><button type="button" onClick={() => void validateStage()} disabled={validating || currentDocument.status !== "published"} className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#202a2f] px-5 text-[13px] font-semibold text-white disabled:opacity-45">{validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {tr(language, "Valider", "Approve")} {currentDocument.code}</button></div>}</section>

        <section className="mt-5 rounded-[18px] border border-[#e1e4e6] bg-[#eef0f2] p-5 sm:p-7"><div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-[#6558c8]" /><h3 className="text-[15px] font-semibold text-[#263136]">{tr(language, "Ajouter une remarque", "Add a comment")}</h3></div><p className="mt-2 text-[13px] leading-6 text-[#747d82]">{tr(language, "Question, correction ou point à confirmer : votre message sera rattaché à", "Question, correction or point to confirm: your message will be attached to")} {currentDocument.code}.</p><form onSubmit={sendComment} className="mt-4"><textarea value={comment} onChange={event => setComment(event.target.value)} rows={4} placeholder={tr(language, "Écrivez votre remarque…", "Write your comment…")} className="w-full resize-y rounded-xl border border-[#d5dade] bg-white px-3.5 py-3 text-[15px] leading-6 text-[#11181c] outline-none placeholder:text-[#737c81] focus:border-[#776bd0] focus:ring-2 focus:ring-[#776bd0]/10" /><div className="mt-3 flex items-center justify-between"><span className="text-[11px] text-[#687277]">Attribué à {firstName} {lastName}</span><button type="submit" disabled={!comment.trim() || commentState === "sending"} className="flex h-9 items-center gap-2 rounded-lg border border-[#cfd4d7] bg-white px-3.5 text-[12px] font-semibold text-[#3f494e] disabled:opacity-50">{commentState === "sending" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : commentState === "sent" ? <Check className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}{commentState === "sent" ? "Envoyé" : "Envoyer"}</button></div></form></section>
      </article>
    </div>
    <footer className="border-t border-[#dfe3e5] bg-white px-5 py-7 text-center text-[11px] text-[#848c90]">{tr(language, "Document confidentiel", "Confidential document")} · {data.room.companyName} × Gando</footer>
  </main>;
}
