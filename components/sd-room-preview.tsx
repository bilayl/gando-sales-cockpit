"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, FileSignature, FileText, Loader2, MessageSquareText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SDRoomBrandBanner } from "@/components/sd-room-brand-banner";
import { SD_CODES, SD_STAGE_META, type SD01Content, type SDCode, type SDDocumentRecord, type SDRoomComment, type SDRoomRecord } from "@/lib/sd-room-types";
import type { SD02Content, SD03Content, SD04Content, SD05Content } from "@/lib/sd-stage-content";

const ROOM_BASE_URL = (process.env.NEXT_PUBLIC_ROOM_BASE_URL || "https://room.gando.pro").replace(/\/$/, "");
type PreviewResponse = { room: SDRoomRecord | null; documents: SDDocumentRecord[]; comments?: SDRoomComment[]; message?: string; error?: string };

function displayContent(document: SDDocumentRecord) {
  if ((document.status === "published" || document.status === "validated") && document.published_content) return document.published_content;
  return document.content;
}

function formatDate(value?: string | null) {
  if (!value) return "À définir";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}

function List({ items, empty = "À compléter" }: { items?: string[]; empty?: string }) {
  if (!items?.length) return <p className="text-sm italic text-[#8a9296]">{empty}</p>;
  return <ul className="space-y-2">{items.map((item, index) => <li key={`${index}-${item}`} className="flex gap-3 text-sm leading-6 text-[#4d585d]"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7166c7]" /><span>{item}</span></li>)}</ul>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-[16px] border border-[#e1e4e6] bg-white p-5 sm:p-6"><h3 className="text-[16px] font-semibold text-[#202a2f]">{title}</h3><div className="mt-4">{children}</div></section>;
}

function PreviewSD01({ content }: { content: SD01Content }) {
  const metrics = (content.roi?.valueLevers || []).filter(metric => metric.value?.trim());
  return <div className="space-y-4">
    <Section title="Synthèse exécutive"><p className="whitespace-pre-line text-[17px] font-medium leading-7 text-[#202a2f]">{content.executiveSummary || "Synthèse à compléter."}</p></Section>
    {(content.companyProfile?.description || content.companyProfile?.context || content.companyProfile?.sector) ? <Section title="Entreprise & contexte"><div className="grid gap-4 sm:grid-cols-2"><div><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7b858a]">Secteur</div><div className="mt-1 text-sm font-semibold text-[#343e43]">{content.companyProfile?.sector || "À confirmer"}</div></div><div><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7b858a]">Entreprise</div><p className="mt-1 text-sm leading-6 text-[#566166]">{content.companyProfile?.description || "À compléter"}</p></div></div>{content.companyProfile?.context ? <p className="mt-4 border-t border-[#eceeef] pt-4 text-sm leading-6 text-[#566166]">{content.companyProfile.context}</p> : null}</Section> : null}
    {content.stakeholders?.length ? <Section title="Personnes clés"><div className="grid gap-2 sm:grid-cols-2">{content.stakeholders.map((person, index) => <div key={index} className="rounded-xl bg-[#f6f7f8] p-3"><div className="text-sm font-semibold text-[#2f393e]">{person.name}</div><div className="mt-0.5 text-xs text-[#747d82]">{person.role}{person.organization ? ` · ${person.organization}` : ""}</div></div>)}</div></Section> : null}
    {content.currentProcess?.length ? <Section title="Processus actuel"><List items={content.currentProcess} /></Section> : null}
    {content.painPoints?.length ? <Section title="Enjeux prioritaires"><div className="space-y-4">{content.painPoints.map((pain, index) => <div key={index} className="border-b border-[#eceeef] pb-4 last:border-0 last:pb-0"><div className="text-sm font-semibold text-[#2f393e]">{pain.title}</div><div className="mt-2"><List items={pain.details} /></div></div>)}</div></Section> : null}
    {content.solutionFit?.length ? <Section title="Solution fit"><div className="divide-y divide-[#eceeef]">{content.solutionFit.map((item, index) => <div key={index} className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-2"><div className="text-sm font-semibold text-[#2f393e]">{item.need}</div><div className="text-sm leading-6 text-[#566166]">{item.response}</div></div>)}</div></Section> : null}
    {metrics.length ? <Section title="Métriques confirmées"><div className="grid gap-3 sm:grid-cols-2">{metrics.map((metric, index) => <div key={index} className="rounded-xl bg-[#f3f0ff] p-4"><div className="text-xs font-semibold text-[#5c50ae]">{metric.lever}</div><div className="mt-1 text-xl font-bold text-[#2e2867]">{metric.value}</div>{metric.mechanism ? <div className="mt-1 text-xs leading-5 text-[#6c668a]">{metric.mechanism}</div> : null}</div>)}</div></Section> : null}
    {content.urgency?.length ? <Section title="Pourquoi maintenant ?"><List items={content.urgency} /></Section> : null}
  </div>;
}

function PreviewSD02({ content }: { content: SD02Content }) {
  return <div className="space-y-4">
    {content.objective ? <Section title="Objectif partagé"><p className="whitespace-pre-line text-[17px] font-medium leading-7 text-[#202a2f]">{content.objective}</p></Section> : null}
    {(content.decisionProcess?.length || content.blockers?.length) ? <Section title="Décisions & points à trancher"><div className="grid gap-6 sm:grid-cols-2"><div><div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7b858a]">Décisions actées</div><List items={content.decisionProcess} /></div><div><div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7b858a]">Points à trancher</div><List items={content.blockers} /></div></div></Section> : null}
    <Section title="Prochaines étapes">{content.milestones?.length ? <div className="space-y-3">{content.milestones.map((step, index) => <div key={index} className="grid grid-cols-[30px_1fr] gap-3"><div className="grid h-8 w-8 place-items-center rounded-full bg-[#6b5fc8] text-[10px] font-semibold text-white">{String(index + 1).padStart(2, "0")}</div><div className="rounded-xl border border-[#e4e7e9] p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="text-sm font-semibold text-[#2f393e]">{step.milestone}</div><span className="rounded-full bg-[#f3f0ff] px-2 py-1 text-[10px] font-semibold text-[#5c50ae]">{step.status === "done" ? "Terminé" : step.status === "in_progress" ? "En cours" : "À faire"}</span></div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#747d82]"><span>Responsable : {step.owner || "À définir"}</span><span>Échéance : {formatDate(step.dueDate)}</span></div>{step.dependency ? <p className="mt-3 text-xs leading-5 text-[#747d82]">{step.dependency}</p> : null}</div></div>)}</div> : <p className="text-sm italic text-[#8a9296]">Aucune étape définie.</p>}</Section>
  </div>;
}

function PreviewSD03({ content }: { content: SD03Content }) {
  return <div className="space-y-4"><Section title="Solution retenue"><p className="text-[17px] font-medium leading-7 text-[#202a2f]">{content.solutionSummary || "À finaliser"}</p></Section><Section title="Périmètre"><div className="grid gap-6 sm:grid-cols-2"><div><div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7b858a]">Inclus</div><List items={content.scopeIn} /></div><div><div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7b858a]">Hors périmètre</div><List items={content.scopeOut} /></div></div></Section></div>;
}

function PreviewSD04({ content }: { content: SD04Content }) {
  const pdfUrl = /^https?:\/\//i.test(content.deckSubtitle || "") ? content.deckSubtitle : "";
  return <div className="space-y-4">{pdfUrl ? <Section title={content.deckTitle || "Proposition commerciale"}><div className="overflow-hidden rounded-xl border border-[#dfe3e5] bg-[#f5f6f7]"><div className="flex items-center justify-between gap-3 bg-[#202a2f] px-4 py-3 text-white"><div className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4" />{content.deckTitle || "Document commercial"}</div><a href={pdfUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold underline">Ouvrir</a></div><iframe src={`${pdfUrl.split("#")[0]}#toolbar=0&navpanes=0&view=FitH`} title="Proposition commerciale" className="h-[650px] w-full bg-white" /></div></Section> : <Section title="Proposition commerciale"><p className="text-sm text-[#566166]">{content.executiveMessage || content.offerSummary || "Aucun document commercial publié."}</p></Section>}</div>;
}

function PreviewSD05({ content }: { content: SD05Content }) {
  return <Section title={content.contractTitle || "Contrat & signature"}><div className="flex flex-wrap items-center gap-3"><Badge variant="outline">{content.contractStatus === "signed" ? "Signé" : content.contractStatus === "ready_to_sign" ? "Prêt à signer" : "En préparation"}</Badge>{content.contractUrl ? <a href={content.contractUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#202a2f] px-4 py-2 text-xs font-semibold text-white"><FileSignature className="h-4 w-4" />Ouvrir le contrat</a> : null}</div>{content.contractSummary ? <p className="mt-4 text-sm leading-6 text-[#566166]">{content.contractSummary}</p> : null}</Section>;
}

function DocumentPreview({ document }: { document: SDDocumentRecord }) {
  const content = displayContent(document);
  if (document.code === "SD01") return <PreviewSD01 content={content as SD01Content} />;
  if (document.code === "SD02") return <PreviewSD02 content={content as unknown as SD02Content} />;
  if (document.code === "SD03") return <PreviewSD03 content={content as unknown as SD03Content} />;
  if (document.code === "SD04") return <PreviewSD04 content={content as unknown as SD04Content} />;
  return <PreviewSD05 content={content as unknown as SD05Content} />;
}

export function SDRoomPreview({ dealId }: { dealId: string }) {
  const [data, setData] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCode, setActiveCode] = useState<SDCode>("SD01");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json() as PreviewResponse;
      if (!response.ok) throw new Error(payload.message || payload.error || "Impossible de charger l’aperçu.");
      setData(payload);
      const preferred = payload.documents.find(document => document.status === "published" || document.status === "validated") || payload.documents[0];
      if (preferred) setActiveCode(preferred.code);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Impossible de charger l’aperçu."); }
    finally { setLoading(false); }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);
  const room = data?.room;
  const activeDocument = data?.documents.find(document => document.code === activeCode) || data?.documents[0];
  const comments = useMemo(() => (data?.comments || []).filter(comment => comment.document_code === activeCode), [activeCode, data?.comments]);
  const shareUrl = room ? `${ROOM_BASE_URL}/r/${room.share_token}` : "";

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error || !room || !data) return <div className="mx-auto max-w-2xl p-6"><Card className="p-8 text-center"><p className="text-sm text-destructive">{error || "Créez d’abord la Room SD."}</p><Button variant="outline" className="mt-4" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Réessayer</Button></Card></div>;

  async function copyLink() { await navigator.clipboard.writeText(shareUrl); toast.success("Lien client copié"); }

  return <div className="min-h-screen bg-[#eef0f2] p-4 lg:p-7"><div className="mx-auto max-w-[1380px] space-y-4">
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Prévisualisation réelle</div><div className="mt-1 text-sm font-semibold">Ce que le client verra, sans passer par l’écran d’accès.</div><div className="mt-1 max-w-xl truncate text-xs text-muted-foreground">{shareUrl}</div></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => void copyLink()}><Copy className="mr-2 h-4 w-4" />Copier le lien</Button><Button variant="outline" size="sm" onClick={() => window.open(shareUrl, "_blank", "noopener,noreferrer")}><ExternalLink className="mr-2 h-4 w-4" />Ouvrir la Room</Button></div></div>

    <div className="overflow-hidden rounded-[20px] border border-[#dce1e3] bg-[#f5f6f7] shadow-[0_18px_60px_rgba(30,40,45,0.08)]">
      <div className="flex items-center gap-2 border-b border-[#e3e6e8] bg-white px-4 py-3"><span className="h-2.5 w-2.5 rounded-full bg-[#d5dade]" /><span className="h-2.5 w-2.5 rounded-full bg-[#d5dade]" /><span className="h-2.5 w-2.5 rounded-full bg-[#d5dade]" /><div className="mx-auto max-w-xl flex-1 truncate rounded-lg bg-[#f2f4f5] px-3 py-1.5 text-center text-[11px] text-[#777f84]">{shareUrl}</div></div>
      <SDRoomBrandBanner companyName={room.company_name} logoUrl={room.prospect_logo_url} bannerUrl={room.brand_banner_image_url} theme={room.brand_theme} title={room.brand_title || room.title} subtitle={room.brand_subtitle || "Espace de collaboration"} className="min-h-[260px]" />
      <div className="grid gap-7 px-5 py-7 sm:px-8 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#777f84]">Parcours</div><div className="mt-3 space-y-1">{SD_CODES.map(code => { const document = data.documents.find(item => item.code === code); if (!document) return null; const active = activeDocument?.code === code; return <button key={code} type="button" onClick={() => setActiveCode(code)} className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left ${active ? "bg-white ring-1 ring-[#e0e4e6]" : "hover:bg-white/60"}`}><span className="font-mono text-[10px] font-semibold text-[#6b5fc8]">{code.slice(2)}</span><div className="min-w-0 flex-1"><div className="text-[11px] font-semibold leading-4 text-[#3f494e]">{SD_STAGE_META[code].title}</div><div className="mt-0.5 text-[9px] text-[#8a9296]">{document.status === "validated" ? "Validé" : document.status === "published" ? "Publié · à valider" : "Brouillon interne"}</div></div>{document.status === "validated" ? <CheckCircle2 className="h-3.5 w-3.5 text-[#4f835e]" /> : null}</button>; })}</div></aside>
        <main className="min-w-0"><div className="mb-5 flex items-start justify-between gap-3 border-b border-[#dfe3e5] pb-4"><div><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#737b80]">{activeDocument?.code}</div><h2 className="mt-1 text-[26px] font-semibold tracking-[-0.03em] text-[#182227]">{activeDocument ? SD_STAGE_META[activeDocument.code].title : "Aperçu"}</h2></div>{activeDocument ? <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[#687277] ring-1 ring-[#dfe3e5]">{activeDocument.status === "draft" ? "Brouillon" : activeDocument.status === "validated" ? "Validé" : "Publié"}</span> : null}</div>
          {activeDocument ? <DocumentPreview document={activeDocument} /> : null}
          <section className="mt-5 rounded-[16px] border border-[#e1e4e6] bg-white p-5"><div className="flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-[#6558c8]" /><h3 className="text-sm font-semibold text-[#263136]">Remarques visibles sur cette étape</h3><span className="rounded-full bg-[#f3f0ff] px-2 py-0.5 text-[10px] font-semibold text-[#5c50ae]">{comments.length}</span></div><div className="mt-4 space-y-2">{comments.map(comment => <div key={comment.id} className={`rounded-xl border p-3 ${comment.status === "resolved" ? "border-[#e4e7e9] bg-[#f7f8f8] opacity-65" : "border-[#dedaf7] bg-[#faf9ff]"}`}><div className="flex items-center justify-between gap-2 text-[11px]"><span className="font-semibold text-[#454f54]">{comment.author_email}</span><span className="text-[#899196]">{comment.status === "resolved" ? "Traitée" : "Ouverte"}</span></div><p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#566166]">{comment.body}</p></div>)}{!comments.length ? <p className="text-sm italic text-[#8a9296]">Aucune remarque sur cette étape.</p> : null}</div></section>
        </main>
      </div>
    </div>
  </div></div>;
}
