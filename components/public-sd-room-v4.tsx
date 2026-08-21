"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, CheckCircle2, ChevronRight, Loader2, LockKeyhole, MessageSquare, ShieldCheck } from "lucide-react";
import { GandoMark } from "@/components/gando-mark";
import { SDRoomBrandBanner } from "@/components/sd-room-brand-banner";
import { SD_CODES, SD_STAGE_META, type SD01Content, type SDCode, type SDDocumentRecord, type SDRoomBrandTheme } from "@/lib/sd-room-types";
import type { SD02Content, SD03Content, SD04Content, SD05Content } from "@/lib/sd-stage-content";

type PublicDocument = SDDocumentRecord & {
  validated_at?: string | null;
  validated_by_email?: string | null;
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
const REQUIRED_CODES: SDCode[] = ["SD01", "SD02", "SD05"];

function formatDate(value?: string | null) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
  } catch {
    return "";
  }
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#727a80]">{children}</div>;
}
function EditorialSection({ title, children, kicker }: { title: string; children: React.ReactNode; kicker?: string }) {
  return <section className="rounded-[18px] border border-[#e3e6e8] bg-white px-5 py-6 shadow-[0_1px_2px_rgba(20,30,35,0.025)] sm:px-8 sm:py-8">{kicker ? <Eyebrow>{kicker}</Eyebrow> : null}<h2 className="mt-1 text-[21px] font-semibold leading-tight tracking-[-0.025em] text-[#1c2529] sm:text-[23px]">{title}</h2><div className="mt-5 text-[16px] leading-[1.75] text-[#4d585d]">{children}</div></section>;
}
function Lead({ code, children }: { code: SDCode; children: React.ReactNode }) {
  return <section className="rounded-[18px] border border-[#e1e4e7] bg-white px-5 py-6 sm:px-8"><Eyebrow>{code} · {SD_STAGE_META[code].title}</Eyebrow><p className="mt-4 max-w-[760px] text-[20px] font-medium leading-[1.55] tracking-[-0.02em] text-[#202a2f] sm:text-[23px]">{children}</p></section>;
}
function BulletList({ items, empty = "À confirmer ensemble" }: { items?: string[]; empty?: string }) {
  if (!items?.length) return <p className="italic text-[#8a9296]">{empty}</p>;
  return <ul className="space-y-3">{items.map((item, index) => <li key={`${index}-${item.slice(0, 20)}`} className="flex gap-3"><span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#7166c7]" /><span>{item}</span></li>)}</ul>;
}
function NumberedList({ items }: { items?: string[] }) {
  if (!items?.length) return <p className="italic text-[#8a9296]">À confirmer ensemble</p>;
  return <ol className="space-y-4">{items.map((item, index) => <li key={`${index}-${item.slice(0, 20)}`} className="grid grid-cols-[30px_1fr] gap-3"><span className="pt-0.5 font-mono text-[12px] font-semibold text-[#675bbd]">{String(index + 1).padStart(2, "0")}</span><span>{item}</span></li>)}</ol>;
}
function PairGrid({ leftTitle, left, rightTitle, right }: { leftTitle: string; left: React.ReactNode; rightTitle: string; right: React.ReactNode }) {
  return <div className="grid gap-6 lg:grid-cols-2"><div><h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#727b80]">{leftTitle}</h3>{left}</div><div><h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#727b80]">{rightTitle}</h3>{right}</div></div>;
}
function actionStatus(status: string) {
  if (status === "done") return { label: "Terminé", classes: "bg-[#edf7ef] text-[#376b43]" };
  if (status === "in_progress") return { label: "En cours", classes: "bg-[#f3f0ff] text-[#5c50ae]" };
  return { label: "À faire", classes: "bg-[#f1f3f4] text-[#60696e]" };
}

function SD01Document({ content }: { content: SD01Content }) {
  const stakeholders = content.stakeholders || [];
  const painPoints = content.painPoints || [];
  const solutionFit = content.solutionFit || [];
  const nextSteps = content.nextSteps || [];
  return <div className="space-y-5 sm:space-y-6">
    <Lead code="SD01">{content.executiveSummary || "Synthèse en cours de validation."}</Lead>
    <EditorialSection title="Contexte de l’organisation" kicker="Situation actuelle"><div className="grid gap-5 sm:grid-cols-[160px_1fr]"><div><div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7a8388]">Secteur</div><div className="mt-2 font-medium text-[#202a2f]">{content.companyProfile?.sector || "À confirmer"}</div></div><div><div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7a8388]">Entreprise</div><p className="mt-2">{content.companyProfile?.description || "À compléter"}</p></div></div>{content.companyProfile?.context ? <p className="mt-5 border-t border-[#eceeef] pt-5">{content.companyProfile.context}</p> : null}{content.gandoContext ? <p className="mt-5 rounded-xl bg-[#f5f6f8] px-4 py-4"><strong className="font-semibold text-[#2a3439]">Point de rencontre avec Gando.</strong> {content.gandoContext}</p> : null}</EditorialSection>
    <EditorialSection title="Personnes clés" kicker="Parties prenantes">{stakeholders.length ? <div className="divide-y divide-[#eceeef]">{stakeholders.map((person, index) => <div key={`${person.name}-${index}`} className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-2"><div><div className="font-semibold text-[#202a2f]">{person.name}</div><div className="mt-1 text-[14px] text-[#675bbd]">{person.role || "Rôle à confirmer"}</div></div><div className="text-[14px] text-[#697378]">{person.organization}{person.notes ? <><br />{person.notes}</> : null}</div></div>)}</div> : <p className="italic text-[#8a9296]">Cartographie à compléter.</p>}</EditorialSection>
    <EditorialSection title="Processus actuel" kicker="Comment cela fonctionne aujourd’hui"><NumberedList items={content.currentProcess} /></EditorialSection>
    <EditorialSection title="Enjeux prioritaires" kicker="Ce qui doit changer">{painPoints.length ? <div className="space-y-5">{painPoints.map((pain, index) => <article key={`${pain.title}-${index}`} className="grid gap-3 border-b border-[#eceeef] pb-5 last:border-0 last:pb-0 sm:grid-cols-[44px_1fr]"><div className="font-mono text-[12px] font-semibold text-[#675bbd]">P{pain.priority || index + 1}</div><div><h3 className="font-semibold leading-6 text-[#202a2f]">{pain.title}</h3><div className="mt-2"><BulletList items={pain.details} /></div></div></article>)}</div> : <p className="italic text-[#8a9296]">Enjeux à préciser.</p>}</EditorialSection>
    <EditorialSection title="Réponse envisagée" kicker="Correspondance besoin / solution">{solutionFit.length ? <div className="divide-y divide-[#eceeef]">{solutionFit.map((item, index) => <div key={index} className="grid gap-3 py-5 first:pt-0 last:pb-0 md:grid-cols-[0.9fr_1.1fr]"><div className="font-semibold leading-6 text-[#202a2f]">{item.need}</div><div>{item.response}</div></div>)}</div> : <p className="italic text-[#8a9296]">Périmètre à confirmer.</p>}</EditorialSection>
    <EditorialSection title="Décisions et prochaines étapes" kicker="Suite de la synthèse"><PairGrid leftTitle="Décisions actées" left={<BulletList items={content.decisions} />} rightTitle="Prochaines actions" right={<BulletList items={nextSteps.map(step => `${step.owner || "À définir"} — ${step.action}${step.dueDate ? ` · ${step.dueDate}` : ""}`)} />}/>{content.openQuestions?.length ? <div className="mt-6 border-t border-[#eceeef] pt-5"><h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#727b80]">Questions encore ouvertes</h3><BulletList items={content.openQuestions} /></div> : null}</EditorialSection>
  </div>;
}

function SD02Document({ content }: { content: SD02Content }) {
  const roadmap = content.milestones || [];
  const workstreamLabel = (workstream: string) => workstream === "technical" ? "Technique" : workstream === "legal" ? "Juridique" : workstream === "procurement" ? "Achats" : workstream === "other" ? "Autre" : "Business";
  const organizationLabel = (organization: string) => organization === "client" ? "Client" : organization === "gando" ? "Gando" : "Commun";

  return <div className="space-y-5 sm:space-y-6">
    <Lead code="SD02">{content.objective || "Roadmap commune à finaliser."}</Lead>
    <EditorialSection title="Objectif et résultat attendu" kicker="Cap commun"><p>{content.successDefinition || "À confirmer ensemble."}</p></EditorialSection>

    <EditorialSection title="Roadmap commune" kicker="Du cadrage au go-live">
      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#e5e8ea] bg-[#f7f8f9] px-4 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7b8388]">Prochain point</div><div className="mt-1.5 text-[14px] font-semibold text-[#263136]">{formatDate(content.nextMeetingDate) || "À définir"}</div></div>
        <div className="rounded-xl border border-[#e5e8ea] bg-[#f7f8f9] px-4 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7b8388]">Décision cible</div><div className="mt-1.5 text-[14px] font-semibold text-[#263136]">{formatDate(content.decisionDate) || "À définir"}</div></div>
        <div className="rounded-xl border border-[#ddd9f5] bg-[#f4f1ff] px-4 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b60ba]">Go-live cible</div><div className="mt-1.5 text-[14px] font-semibold text-[#443a91]">{formatDate(content.targetGoLiveDate) || "À définir"}</div></div>
      </div>

      {roadmap.length ? <div className="relative">
        <div className="absolute bottom-8 left-[15px] top-8 w-px bg-[#dcdfe2] sm:left-[19px]" />
        <div className="space-y-4">{roadmap.map((item, index) => {
          const status = actionStatus(item.status);
          return <article key={`${item.milestone}-${index}`} className="relative grid grid-cols-[32px_1fr] gap-3 sm:grid-cols-[40px_1fr] sm:gap-4">
            <div className="relative z-10 mt-5 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[#6e62c3] font-mono text-[10px] font-semibold text-white shadow-sm sm:h-10 sm:w-10 sm:text-[11px]">{String(index + 1).padStart(2, "0")}</div>
            <div className="rounded-[14px] border border-[#e2e5e7] bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#f2f0ff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6156ad]">{workstreamLabel(item.workstream)}</span><span className="text-[11px] font-medium text-[#7b8388]">{organizationLabel(item.organization)}</span></div><h3 className="mt-2 text-[17px] font-semibold leading-6 text-[#202a2f]">{item.milestone}</h3></div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.classes}`}>{status.label}</span>
              </div>
              <div className="mt-4 grid gap-3 border-t border-[#eceeef] pt-4 text-[13px] text-[#697378] sm:grid-cols-2">
                <div><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#92999d]">Responsable</span><div className="mt-0.5 font-medium text-[#4c565b]">{item.owner || "À définir"}</div></div>
                <div><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#92999d]">Échéance</span><div className="mt-0.5 font-medium text-[#4c565b]">{formatDate(item.dueDate) || "À définir"}</div></div>
              </div>
              {item.dependency ? <div className="mt-3 rounded-lg bg-[#f6f7f8] px-3 py-2 text-[12px] leading-5 text-[#717b80]"><span className="font-semibold text-[#596368]">Dépendance :</span> {item.dependency}</div> : null}
            </div>
          </article>;
        })}</div>
      </div> : <p className="italic text-[#8a9296]">Aucune étape de roadmap définie.</p>}
    </EditorialSection>

    {content.decisionProcess?.length ? <EditorialSection title="Circuit de décision" kicker="Validations nécessaires"><NumberedList items={content.decisionProcess} /></EditorialSection> : null}
    <EditorialSection title="Engagements réciproques" kicker="Responsabilités"><PairGrid leftTitle="Côté client" left={<BulletList items={content.clientCommitments} />} rightTitle="Côté Gando" right={<BulletList items={content.gandoCommitments} />} /></EditorialSection>
    <EditorialSection title="Dépendances et risques" kicker="Points de vigilance"><PairGrid leftTitle="Dépendances" left={<BulletList items={content.dependencies} />} rightTitle="Risques" right={<BulletList items={content.risks} />} /></EditorialSection>
    <EditorialSection title="Critères de réussite" kicker="Sortie de roadmap"><BulletList items={content.exitCriteria} /></EditorialSection>
  </div>;
}

function SD03Document({ content }: { content: SD03Content }) {
  return <div className="space-y-5 sm:space-y-6"><Lead code="SD03">{content.solutionSummary || "Périmètre solution et intégration à confirmer."}</Lead><EditorialSection title="Périmètre de la solution" kicker="Étape facultative"><PairGrid leftTitle="Inclus" left={<BulletList items={content.scopeIn} />} rightTitle="Hors périmètre" right={<BulletList items={content.scopeOut} />} /></EditorialSection><EditorialSection title="Intégrations et données" kicker="Architecture opérationnelle"><PairGrid leftTitle="Intégrations" left={<BulletList items={content.integrations} />} rightTitle="Données nécessaires" right={<BulletList items={content.dataRequirements} />} /></EditorialSection><EditorialSection title="Pilote" kicker="Mise à l’épreuve"><div className="grid gap-5 sm:grid-cols-2"><div><Eyebrow>Périmètre</Eyebrow><p className="mt-2">{content.pilot?.perimeter || "À définir"}</p></div><div><Eyebrow>Durée</Eyebrow><p className="mt-2">{content.pilot?.duration || "À définir"}</p></div></div><div className="mt-6 border-t border-[#eceeef] pt-5"><BulletList items={content.pilot?.successMetrics} /></div></EditorialSection><EditorialSection title="Sécurité, conformité et déploiement" kicker="Conditions d’exécution"><PairGrid leftTitle="Sécurité & conformité" left={<BulletList items={content.securityAndCompliance} />} rightTitle="Plan de déploiement" right={<BulletList items={content.deploymentPlan} />} /></EditorialSection></div>;
}

function SD04Document({ content }: { content: SD04Content }) {
  return <div className="space-y-5 sm:space-y-6"><Lead code="SD04">{content.offerSummary || "Offre commerciale à finaliser."}</Lead><EditorialSection title="Tarification" kicker="Étape facultative">{content.pricing?.length ? <div className="divide-y divide-[#eceeef]">{content.pricing.map((row, index) => <div key={index} className="grid gap-2 py-5 first:pt-0 last:pb-0 sm:grid-cols-[1fr_1fr_150px]"><div className="font-semibold text-[#202a2f]">{row.item}</div><div className="text-[14px]">{row.model}</div><div className="font-semibold text-[#5d52b6]">{row.price}</div>{row.notes ? <div className="text-[14px] text-[#7a8388] sm:col-span-3">{row.notes}</div> : null}</div>)}</div> : <p className="italic text-[#8a9296]">Tarification à renseigner.</p>}</EditorialSection><EditorialSection title="Business case" kicker="Valeur attendue">{content.businessCase?.length ? <div className="divide-y divide-[#eceeef]">{content.businessCase.map((row, index) => <div key={index} className="grid gap-3 py-5 first:pt-0 last:pb-0 sm:grid-cols-2"><div className="font-semibold text-[#202a2f]">{row.metric}</div><div><div className="text-[14px]">Actuel · {row.baseline || "—"}</div><div className="text-[14px]">Cible · {row.target || "—"}</div>{row.value ? <div className="mt-2 font-medium text-[#5d52b6]">{row.value}</div> : null}</div></div>)}</div> : <p className="italic text-[#8a9296]">Business case à chiffrer.</p>}</EditorialSection><EditorialSection title="Conditions et processus d’achat" kicker="Cadre commercial"><PairGrid leftTitle="Conditions commerciales" left={<BulletList items={content.commercialTerms} />} rightTitle="Achats / procurement" right={<BulletList items={content.procurementSteps} />} /></EditorialSection></div>;
}

function SD05Document({ content }: { content: SD05Content }) {
  return <div className="space-y-5 sm:space-y-6"><Lead code="SD05">{content.contractSummary || "Dernières validations avant signature."}</Lead><EditorialSection title="Points contractuels" kicker="Étape obligatoire">{content.legalItems?.length ? <div className="divide-y divide-[#eceeef]">{content.legalItems.map((row, index) => <div key={index} className="py-5 first:pt-0 last:pb-0"><div className="flex flex-wrap items-center justify-between gap-3"><div className="font-semibold text-[#202a2f]">{row.topic}</div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${row.status === "approved" ? "bg-[#edf7ef] text-[#376b43]" : "bg-[#f1f3f4] text-[#626b70]"}`}>{row.status === "approved" ? "Validé" : row.status === "in_review" ? "En revue" : "Ouvert"}</span></div><div className="mt-2 text-[14px] text-[#7a8388]">Responsable · {row.owner || "à définir"}</div>{row.notes ? <p className="mt-2">{row.notes}</p> : null}</div>)}</div> : <p className="italic text-[#8a9296]">Aucun point contractuel renseigné.</p>}</EditorialSection><EditorialSection title="Signataires" kicker="Pouvoirs de signature">{content.signatories?.length ? <div className="divide-y divide-[#eceeef]">{content.signatories.map((row, index) => <div key={index} className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-2"><div className="font-semibold text-[#202a2f]">{row.name}</div><div className="text-[14px]">{row.role}{row.organization ? ` · ${row.organization}` : ""}</div></div>)}</div> : <p className="italic text-[#8a9296]">Signataires à confirmer.</p>}</EditorialSection><EditorialSection title="Signature et conditions finales" kicker="Closing"><PairGrid leftTitle="Étapes de signature" left={<NumberedList items={content.signatureSteps} />} rightTitle="Conditions finales" right={<BulletList items={content.finalConditions} />} /></EditorialSection><EditorialSection title="Handover et lancement" kicker="Après signature"><BulletList items={content.handoverPlan} />{content.goLiveDate ? <div className="mt-6 border-t border-[#eceeef] pt-5"><Eyebrow>Go-live cible</Eyebrow><div className="mt-1 text-[18px] font-semibold text-[#202a2f]">{content.goLiveDate}</div></div> : null}</EditorialSection></div>;
}

function DocumentBody({ document }: { document: PublicDocument }) {
  if (document.code === "SD01") return <SD01Document content={document.content as SD01Content} />;
  if (document.code === "SD02") return <SD02Document content={document.content as SD02Content} />;
  if (document.code === "SD03") return <SD03Document content={document.content as SD03Content} />;
  if (document.code === "SD04") return <SD04Document content={document.content as SD04Content} />;
  return <SD05Document content={document.content as SD05Content} />;
}

function AccessGate({ firstName, lastName, email, setFirstName, setLastName, setEmail, loading, error, onSubmit }: { firstName: string; lastName: string; email: string; setFirstName: (value: string) => void; setLastName: (value: string) => void; setEmail: (value: string) => void; loading: boolean; error: string; onSubmit: (event: React.FormEvent) => void }) {
  return <main className="min-h-screen bg-[#f5f6f7] px-5 py-8 sm:px-8 sm:py-14"><div className="mx-auto max-w-[1080px]"><header className="flex items-center justify-between"><div className="flex items-center gap-2.5"><GandoMark className="h-8 w-8" /><span className="text-sm font-semibold tracking-[-0.02em] text-[#1d272b]">Gando</span></div><span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7a8287]">Deal Room privée</span></header><div className="grid min-h-[70vh] items-center gap-10 py-12 lg:grid-cols-[1fr_430px] lg:gap-20"><div className="max-w-[620px]"><Eyebrow>Espace de collaboration</Eyebrow><h1 className="mt-5 text-[42px] font-medium leading-[1.08] tracking-[-0.045em] text-[#172126] sm:text-[58px]">Un espace clair pour avancer jusqu’à la signature.</h1><p className="mt-6 max-w-[560px] text-[17px] leading-[1.75] text-[#626d72]">Retrouvez la synthèse, le plan d’action et les validations nécessaires au même endroit.</p><div className="mt-8 flex items-center gap-3 text-[13px] text-[#747e83]"><ShieldCheck className="h-4 w-4 text-[#6558c8]" /> Accès identifié et confidentiel</div></div><form onSubmit={onSubmit} className="rounded-[22px] border border-[#dfe3e5] bg-white p-6 shadow-[0_18px_55px_rgba(30,40,45,0.06)] sm:p-8"><Eyebrow>Accéder à la Room</Eyebrow><h2 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-[#1b252a]">Identifiez-vous</h2><p className="mt-2 text-[14px] leading-6 text-[#747e83]">Ces informations permettent d’attribuer les commentaires et validations.</p><div className="mt-7 grid gap-4 sm:grid-cols-2"><label><span className="text-[12px] font-semibold text-[#4e585d]">Prénom</span><input value={firstName} onChange={event => setFirstName(event.target.value)} required autoComplete="given-name" className="mt-2 h-11 w-full rounded-xl border border-[#d7dcdf] bg-white px-3.5 text-[15px] outline-none focus:border-[#7b6fd0] focus:ring-2 focus:ring-[#7568cf]/10" /></label><label><span className="text-[12px] font-semibold text-[#4e585d]">Nom</span><input value={lastName} onChange={event => setLastName(event.target.value)} required autoComplete="family-name" className="mt-2 h-11 w-full rounded-xl border border-[#d7dcdf] bg-white px-3.5 text-[15px] outline-none focus:border-[#7b6fd0] focus:ring-2 focus:ring-[#7568cf]/10" /></label></div><label className="mt-4 block"><span className="text-[12px] font-semibold text-[#4e585d]">Email professionnel</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" className="mt-2 h-11 w-full rounded-xl border border-[#d7dcdf] bg-white px-3.5 text-[15px] outline-none focus:border-[#7b6fd0] focus:ring-2 focus:ring-[#7568cf]/10" /></label>{error ? <p className="mt-4 rounded-xl bg-[#fff3f1] px-3.5 py-3 text-[13px] text-[#9a4137]">{error}</p> : null}<button type="submit" disabled={loading} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#202a2f] px-4 text-[14px] font-semibold text-white transition hover:bg-[#303b40] disabled:opacity-55">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Entrer dans la Room <ChevronRight className="h-4 w-4" /></button></form></div></div></main>;
}

export function PublicSDRoomV4({ token }: { token: string }) {
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
    const sid = sessionStorage.getItem(`gando-room-session:${token}`) || crypto.randomUUID();
    sessionStorage.setItem(`gando-room-session:${token}`, sid);
    setSessionId(sid);
    setFirstName(sessionStorage.getItem(`gando-room-first:${token}`) || "");
    setLastName(sessionStorage.getItem(`gando-room-last:${token}`) || "");
    setEmail(sessionStorage.getItem(`gando-room-email:${token}`) || "");
  }, [token]);

  const visitorEmail = data?.visitorEmail || "";
  const track = useCallback((eventType: string, documentCode: SDCode | null, activeSeconds = 0) => {
    if (!visitorEmail || !sessionId) return;
    void fetch(`/api/public/deal-room/${encodeURIComponent(token)}/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: visitorEmail, sessionId, eventType, documentCode, activeSeconds, metadata: { firstName, lastName } }), keepalive: true });
  }, [firstName, lastName, sessionId, token, visitorEmail]);

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) return;
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/public/deal-room/${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Accès impossible");
      setData(payload);
      const available = (payload.documents as PublicDocument[]).map(item => item.code);
      setActiveStage(available.includes(payload.room.currentStage) ? payload.room.currentStage : available[0] || "SD01");
      sessionStorage.setItem(`gando-room-first:${token}`, firstName.trim());
      sessionStorage.setItem(`gando-room-last:${token}`, lastName.trim());
      sessionStorage.setItem(`gando-room-email:${token}`, payload.visitorEmail);
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : "Accès impossible");
    } finally { setLoading(false); }
  };

  useEffect(() => { if (!data || !sessionId || openedRef.current) return; openedRef.current = true; track("room_opened", activeStage); }, [activeStage, data, sessionId, track]);
  useEffect(() => { if (data && sessionId) track("stage_viewed", activeStage); }, [activeStage, data, sessionId, track]);
  useEffect(() => { if (!data || !sessionId) return; const interval = window.setInterval(() => { if (document.visibilityState === "visible") track("heartbeat", activeStage, 30); }, 30000); return () => window.clearInterval(interval); }, [activeStage, data, sessionId, track]);

  const currentDocument = data?.documents.find(document => document.code === activeStage) || data?.documents[0];
  const stages = useMemo(() => SD_CODES.map(code => ({ code, document: data?.documents.find(document => document.code === code) })), [data]);
  const requiredValidated = REQUIRED_CODES.filter(code => data?.documents.find(document => document.code === code)?.status === "validated").length;

  const sendComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!comment.trim() || !data || !currentDocument) return;
    setCommentState("sending");
    try {
      const response = await fetch(`/api/public/deal-room/${encodeURIComponent(token)}/comments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: data.visitorEmail, firstName, lastName, documentCode: currentDocument.code, sectionKey: currentDocument.code.toLowerCase(), body: comment.trim() }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Remarque non enregistrée");
      setComment(""); setCommentState("sent"); window.setTimeout(() => setCommentState("idle"), 2500);
    } catch { setCommentState("idle"); }
  };
  const validateStage = async () => {
    if (!data || !currentDocument || currentDocument.status !== "published") return;
    setValidating(true);
    try {
      const response = await fetch(`/api/public/deal-room/${encodeURIComponent(token)}/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: data.visitorEmail, firstName, lastName, documentCode: currentDocument.code }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Validation impossible");
      setData(current => current ? { ...current, documents: current.documents.map(document => document.code === currentDocument.code ? payload.document : document) } : current);
    } finally { setValidating(false); }
  };

  if (!data) return <AccessGate firstName={firstName} lastName={lastName} email={email} setFirstName={setFirstName} setLastName={setLastName} setEmail={setEmail} loading={loading} error={error} onSubmit={unlock} />;
  if (!currentDocument) return <main className="grid min-h-screen place-items-center bg-[#f5f6f7] px-5 text-center"><div><h1 className="text-2xl font-semibold text-[#202a2f]">Room en préparation</h1><p className="mt-2 text-[#6f787d]">Aucune étape n’est encore publiée.</p></div></main>;

  const validatedBy = [currentDocument.validated_by_first_name, currentDocument.validated_by_last_name].filter(Boolean).join(" ");
  return <main className="min-h-screen bg-[#f5f6f7] text-[#1c2529]">
    <header className="sticky top-0 z-50 border-b border-[#e4e7e9] bg-white/95 backdrop-blur-md"><div className="mx-auto flex h-16 max-w-[1180px] items-center gap-4 px-5 sm:px-7"><div className="flex min-w-0 items-center gap-2.5"><GandoMark className="h-8 w-8 shrink-0" /><span className="hidden text-sm font-semibold sm:inline">Gando</span><span className="text-[#b5bbc0]">/</span><span className="truncate text-sm font-medium text-[#4c565b]">{data.room.companyName}</span></div><div className="ml-auto hidden items-center gap-2 text-[12px] text-[#737c81] sm:flex"><LockKeyhole className="h-3.5 w-3.5" /> Room privée</div><div className="h-7 w-px bg-[#e2e5e7]" /><div className="text-right text-[11px] leading-4 text-[#737c81]"><div className="font-semibold text-[#384247]">{firstName} {lastName}</div><div className="hidden sm:block">{data.visitorEmail}</div></div></div></header>

    <SDRoomBrandBanner
      companyName={data.room.companyName}
      logoUrl={data.room.companyLogoUrl}
      bannerUrl={data.room.bannerImageUrl}
      theme={data.room.theme}
      title={data.room.displayTitle || `${data.room.companyName} × Gando`}
      subtitle={data.room.displaySubtitle || "Espace de collaboration"}
      className="min-h-[330px] border-b border-[#e1e4e6] sm:min-h-[390px] sm:pb-14 sm:pt-14"
    />

    <section className="border-b border-[#e4e7e9] bg-white"><div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-5 py-4 text-[12px] text-[#7c858a] sm:px-7"><div className="flex flex-wrap items-center gap-x-5 gap-y-2"><span>Mis à jour le {formatDate(data.room.updatedAt)}</span><span className="h-1 w-1 rounded-full bg-[#bcc2c5]" /><span>{requiredValidated}/3 étapes obligatoires validées</span></div><span className="text-[#737d82]">Synthèse → Roadmap → Contrat</span></div></section>

    <div className="mx-auto grid max-w-[1180px] gap-8 px-5 py-9 sm:px-7 lg:grid-cols-[245px_minmax(0,790px)] lg:justify-between lg:py-12"><aside className="lg:sticky lg:top-24 lg:self-start"><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#777f84]">Parcours</div><nav className="mt-4 space-y-1.5">{stages.map(({ code, document }) => { const active = code === currentDocument.code; const enabled = Boolean(document); const optional = OPTIONAL_CODES.includes(code); return <button key={code} type="button" disabled={!enabled} onClick={() => enabled && setActiveStage(code)} className={`group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${active ? "bg-white shadow-sm ring-1 ring-[#e0e4e6]" : enabled ? "hover:bg-white" : "cursor-default opacity-50"}`}><span className={`mt-0.5 font-mono text-[11px] font-semibold ${active ? "text-[#584ead]" : "text-[#8b9296]"}`}>{code.slice(2)}</span><span className="min-w-0 flex-1"><span className={`block text-[13px] font-semibold leading-5 ${active ? "text-[#202a2f]" : "text-[#576166]"}`}>{SD_STAGE_META[code].title}</span><span className="mt-0.5 block text-[11px] text-[#8a9296]">{optional ? "Facultatif · " : "Obligatoire · "}{document?.status === "validated" ? "Validé" : document?.status === "published" ? "À valider" : "À venir"}</span></span>{document?.status === "validated" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4f835e]" /> : active ? <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#6558c8]" /> : null}</button>; })}</nav></aside>

      <article className="min-w-0"><div className="mb-7 flex items-center justify-between gap-4 border-b border-[#dfe3e5] pb-5"><div><Eyebrow>{currentDocument.code}{OPTIONAL_CODES.includes(currentDocument.code) ? " · Facultatif" : " · Obligatoire"}</Eyebrow><h2 className="mt-1 text-[30px] font-semibold tracking-[-0.035em] text-[#182227]">{SD_STAGE_META[currentDocument.code].title}</h2></div><span className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${currentDocument.status === "validated" ? "bg-[#edf7ef] text-[#366844]" : "bg-white text-[#666f74] ring-1 ring-[#dfe3e5]"}`}>{currentDocument.status === "validated" ? "Validé" : "À valider"}</span></div><DocumentBody document={currentDocument} />

        <section className="mt-7 rounded-[18px] border border-[#dfe3e5] bg-white p-5 sm:p-7">{currentDocument.status === "validated" ? <div className="flex gap-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e8f2ea] text-[#3d7049]"><Check className="h-5 w-5" /></div><div><div className="font-semibold text-[#24302c]">Cette étape est validée</div><p className="mt-1 text-[14px] leading-6 text-[#687277]">{validatedBy ? `Validée par ${validatedBy}` : "Validation enregistrée"}{currentDocument.validated_at ? ` · ${formatDate(currentDocument.validated_at)}` : ""}.</p></div></div> : <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><Eyebrow>Validation</Eyebrow><h3 className="mt-1 text-[21px] font-semibold tracking-[-0.02em] text-[#202a2f]">Confirmez-vous le contenu de cette étape ?</h3><p className="mt-2 text-[14px] leading-6 text-[#6b757a]">La validation enregistre votre accord sur cette version du document.</p></div><button type="button" onClick={() => void validateStage()} disabled={validating} className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#202a2f] px-5 text-[13px] font-semibold text-white transition hover:bg-[#303b40] disabled:opacity-55">{validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Valider {currentDocument.code}</button></div>}</section>

        <section className="mt-5 rounded-[18px] border border-[#e1e4e6] bg-[#eef0f2] p-5 sm:p-7"><div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-[#6558c8]" /><h3 className="text-[15px] font-semibold text-[#263136]">Ajouter une remarque</h3></div><p className="mt-2 text-[13px] leading-6 text-[#747d82]">Question, correction ou point à confirmer : votre message sera rattaché à {currentDocument.code}.</p><form onSubmit={sendComment} className="mt-4"><textarea value={comment} onChange={event => setComment(event.target.value)} rows={4} placeholder="Écrivez votre remarque…" className="w-full resize-y rounded-xl border border-[#d5dade] bg-white px-3.5 py-3 text-[15px] leading-6 text-[#283237] outline-none transition placeholder:text-[#9a9fa2] focus:border-[#776bd0] focus:ring-2 focus:ring-[#776bd0]/10" /><div className="mt-3 flex items-center justify-between"><span className="text-[11px] text-[#858d91]">Attribué à {firstName} {lastName}</span><button type="submit" disabled={!comment.trim() || commentState === "sending"} className="flex h-9 items-center gap-2 rounded-lg border border-[#cfd4d7] bg-white px-3.5 text-[12px] font-semibold text-[#3f494e] transition hover:bg-[#fafbfb] disabled:opacity-50">{commentState === "sending" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : commentState === "sent" ? <Check className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}{commentState === "sent" ? "Envoyé" : "Envoyer"}</button></div></form></section>
      </article></div>
    <footer className="border-t border-[#dfe3e5] bg-white px-5 py-7 text-center text-[11px] text-[#848c90]">Document confidentiel · {data.room.companyName} × Gando</footer>
  </main>;
}