"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { PublicSD01MetricConfirmations } from "@/components/public-sd01-metric-confirmations";
import type { SD01Content, SD01Metric } from "@/lib/sd-room-types";

type RoomLanguage = "fr" | "en";
const tr = (language: RoomLanguage, fr: string, en: string) => language === "en" ? en : fr;

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

function AccordionBubble({ title, children, kicker, defaultOpen = false }: { title: string; children: React.ReactNode; kicker?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return <details open={open} onToggle={event => setOpen(event.currentTarget.open)} className="group overflow-hidden rounded-[18px] border border-[#e0e4e6] bg-white shadow-[0_1px_2px_rgba(20,30,35,0.025)]">
    <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-5 sm:px-8 sm:py-6 [&::-webkit-details-marker]:hidden">
      <div className="min-w-0 flex-1">
        {kicker ? <Eyebrow>{kicker}</Eyebrow> : null}
        <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.025em] text-[#172126] sm:text-[22px]">{title}</h2>
      </div>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#e0e4e6] bg-[#f7f8f9] text-[#6558c8] transition group-open:bg-[#f0edff]">
        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
      </span>
    </summary>
    <div className="border-t border-[#eceeef] px-5 py-6 text-[15px] leading-7 text-[#465157] sm:px-8 sm:py-7">{children}</div>
  </details>;
}

function BulletList({ items, empty = "À confirmer" }: { items?: string[]; empty?: string }) {
  if (!items?.length) return <p className="italic text-[#81898e]">{empty}</p>;
  return <ul className="space-y-3">{items.map((item, index) => <li key={`${index}-${item}`} className="flex gap-3"><span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#7166c7]" /><span>{item}</span></li>)}</ul>;
}

function RoiTable({ rows, companyName, language }: { rows: SD01Metric[]; companyName: string; language: RoomLanguage }) {
  if (!rows.length) return null;
  return <Section title={tr(language, "Valeur & estimation du ROI", "Value & ROI estimate")} kicker={tr(language, "Impact attendu", "Expected impact")}>
    <div className="overflow-hidden rounded-[14px] border border-[#dedaf7]">
      <div className="hidden grid-cols-[1fr_1.35fr_1.35fr] bg-[#f5f3ff] text-[11px] font-semibold text-[#6558c8] sm:grid">
        <div className="px-4 py-3">{tr(language, "Levier", "Lever")}</div>
        <div className="border-l border-[#dedaf7] px-4 py-3">{tr(language, "Mécanisme", "Mechanism")}</div>
        <div className="border-l border-[#dedaf7] px-4 py-3">{tr(language, `Valeur pour ${companyName}`, `Value for ${companyName}`)}</div>
      </div>
      <div className="divide-y divide-[#e4e0f7]">{rows.map((row, index) => <div key={`${row.lever}-${index}`} className="grid bg-white sm:grid-cols-[1fr_1.35fr_1.35fr]">
        <div className="px-4 py-4"><div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6558c8] sm:hidden">{tr(language, "Levier", "Lever")}</div><div className="font-semibold text-[#202a2f]">{row.lever}</div></div>
        <div className="border-t border-[#eceeef] px-4 py-4 sm:border-l sm:border-t-0"><div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6558c8] sm:hidden">{tr(language, "Mécanisme", "Mechanism")}</div>{row.mechanism || tr(language, "À préciser", "TBD")}</div>
        <div className="border-t border-[#eceeef] px-4 py-4 sm:border-l sm:border-t-0"><div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6558c8] sm:hidden">{tr(language, `Valeur pour ${companyName}`, `Value for ${companyName}`)}</div>{row.value || tr(language, "À estimer", "To estimate")}</div>
      </div>)}</div>
    </div>
  </Section>;
}

export function PublicSD01EnterpriseDocument({
  content,
  language,
  token,
  email,
  firstName,
  lastName,
  companyName,
  locked,
  onMetricConfirmed,
}: {
  content: SD01Content;
  language: RoomLanguage;
  token: string;
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  locked: boolean;
  onMetricConfirmed: (index: number, metric: SD01Metric) => void;
}) {
  const roiRecord = content.roi as SD01Content["roi"] & { estimates?: SD01Metric[] };
  const hasSeparatedRoi = Array.isArray(roiRecord.estimates);
  const metrics = hasSeparatedRoi ? (content.roi.valueLevers || []).filter(metric => String(metric.lever || "").trim()) : [];
  const roiRows = (hasSeparatedRoi ? roiRecord.estimates || [] : content.roi.valueLevers || []).filter(metric => String(metric.lever || "").trim());

  return <div className="space-y-5 sm:space-y-6">
    <AccordionBubble title={tr(language, "Synthèse exécutive", "Executive summary")} kicker={tr(language, "SD01 · Compréhension commune", "SD01 · Shared understanding")} defaultOpen>
      <p className="text-[18px] font-medium leading-8 text-[#202a2f]">{content.executiveSummary || tr(language, "Synthèse en cours de validation.", "Summary pending approval.")}</p>
    </AccordionBubble>

    {(content.companyProfile?.sector || content.companyProfile?.description || content.companyProfile?.context || content.gandoContext) ? <AccordionBubble title={tr(language, "Entreprise & contexte", "Company & context")}>
      <div className="grid gap-5 sm:grid-cols-[170px_1fr]">
        <div><Eyebrow>{tr(language, "Secteur", "Industry")}</Eyebrow><div className="mt-2 font-semibold text-[#202a2f]">{content.companyProfile?.sector || tr(language, "À confirmer", "TBD")}</div></div>
        <div><Eyebrow>{tr(language, "Entreprise", "Company")}</Eyebrow><p className="mt-2">{content.companyProfile?.description || tr(language, "À compléter", "To complete")}</p></div>
      </div>
      {content.companyProfile?.context ? <div className="mt-5 border-t border-[#eceeef] pt-5"><Eyebrow>{tr(language, "Contexte", "Context")}</Eyebrow><p className="mt-2">{content.companyProfile.context}</p></div> : null}
      {content.gandoContext ? <div className="mt-5 rounded-xl bg-[#f7f6ff] p-4"><Eyebrow>{tr(language, "Pourquoi Gando", "Why Gando")}</Eyebrow><p className="mt-2">{content.gandoContext}</p></div> : null}
    </AccordionBubble> : null}

    {content.currentProcess?.length ? <AccordionBubble title={tr(language, "Processus actuel", "Current process")}><BulletList items={content.currentProcess} /></AccordionBubble> : null}

    {content.stakeholders?.length ? <Section title={tr(language, "Personnes clés", "Key people")}><div className="grid gap-3 sm:grid-cols-2">{content.stakeholders.map((person, index) => <div key={index} className="rounded-xl bg-[#f6f7f8] p-4"><div className="font-semibold text-[#202a2f]">{person.name}</div><div className="mt-1 text-[13px] text-[#687277]">{person.role}{person.organization ? ` · ${person.organization}` : ""}</div>{person.notes ? <p className="mt-2 text-[13px] leading-6 text-[#687277]">{person.notes}</p> : null}</div>)}</div></Section> : null}

    {content.productsAndOffers?.length ? <Section title={tr(language, "Produits & offres", "Products & offers")}><BulletList items={content.productsAndOffers} /></Section> : null}

    <Section title={tr(language, "Enjeux prioritaires", "Top priorities")}>
      {content.painPoints?.length ? <div className="space-y-5">{content.painPoints.map((pain, index) => <div key={index} className="border-b border-[#eceeef] pb-5 last:border-0 last:pb-0"><div className="font-semibold text-[#202a2f]">{pain.title}</div><div className="mt-2"><BulletList items={pain.details} /></div></div>)}</div> : <p className="italic text-[#81898e]">{tr(language, "Enjeux à préciser.", "Priorities to clarify.")}</p>}
    </Section>

    {content.solutionFit?.length ? <Section title={tr(language, "Solution fit", "Solution fit")} kicker={tr(language, "Besoin → réponse proposée", "Need → proposed response")}><div className="divide-y divide-[#eceeef]">{content.solutionFit.map((item, index) => <div key={index} className="grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-2"><div className="font-semibold text-[#202a2f]">{item.need}</div><div>{item.response}</div></div>)}</div></Section> : null}

    {content.businessModel?.length ? <Section title={tr(language, "Modèle commercial", "Commercial model")} kicker={tr(language, "Sous la solution proposée", "Below the proposed solution")}>
      <div className="grid gap-3">{content.businessModel.map((item, index) => <div key={`${index}-${item}`} className="flex gap-4 rounded-[14px] border border-[#e2e4e7] bg-[#fafafa] p-4 sm:p-5"><div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#6e62c3] text-[11px] font-semibold text-white">{index + 1}</div><p className="pt-0.5 text-[15px] leading-6 text-[#394348]">{item}</p></div>)}</div>
    </Section> : null}

    {metrics.length ? <PublicSD01MetricConfirmations token={token} metrics={content.roi.valueLevers} email={email} firstName={firstName} lastName={lastName} language={language} companyName={companyName} locked={locked} onConfirmed={onMetricConfirmed} /> : null}

    <RoiTable rows={roiRows} companyName={companyName} language={language} />

    {content.urgency?.length ? <Section title={tr(language, "Pourquoi maintenant ?", "Why now?")}><BulletList items={content.urgency} /></Section> : null}
  </div>;
}
