"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, CheckCircle2, ChevronRight, ExternalLink, FileSignature, FileText, Loader2, LockKeyhole, MessageSquare, ShieldCheck } from "lucide-react";
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

function stageTitle(code: SDCode) {
  return code === "SD04" ? "PDF commercial" : SD_STAGE_META[code].title;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
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

function stageStatus(status: string) {
  if (status === "done") return { label: "Terminé", classes: "bg-[#edf7ef] text-[#376b43]" };
  if (status === "in_progress") return { label: "En cours", classes: "bg-[#f3f0ff] text-[#5c50ae]" };
  return { label: "À faire", classes: "bg-[#f1f3f4] text-[#60696e]" };
}

function SD01Document({ content }: { content: SD01Content }) {
  return <div className="space-y-5 sm:space-y-6">
    <Section title="Synthèse exécutive" kicker="SD01 · Compréhension commune"><p className="text-[18px] font-medium leading-8 text-[#202a2f]">{content.executiveSummary || "Synthèse en cours de validation."}</p></Section>
    {content.stakeholders?.length ? <SD01KeyPeoplePublic stakeholders={content.stakeholders} /> : null}
    <Section title="Contexte"><div className="grid gap-5 sm:grid-cols-[170px_1fr]"><div><Eyebrow>Secteur</Eyebrow><div className="mt-2 font-semibold text-[#202a2f]">{content.companyProfile?.sector || "À confirmer"}</div></div><div><Eyebrow>Entreprise</Eyebrow><p className="mt-2">{content.companyProfile?.description || "À compléter"}</p></div></div>{content.companyProfile?.context ? <p className="mt-5 border-t border-[#eceeef] pt-5">{content.companyProfile.context}</p> : null}</Section>
    <Section title="Enjeux prioritaires">{content.painPoints?.length ? <div className="space-y-5">{content.painPoints.map((pain, index) => <div key={index} className="border-b border-[#eceeef] pb-5 last:border-0 last:pb-0"><div className="font-semibold text-[#202a2f]">{pain.title}</div><div className="mt-2"><BulletList items={pain.details} /></div></div>)}</div> : <p className="italic text-[#81898e]">Enjeux à préciser.</p>}</Section>
    <Section title="Réponse envisagée">{content.solutionFit?.length ? <div className="divide-y divide-[#eceeef]">{content.solutionFit.map((item, index) => <div key={index} className="grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-2"><div className="font-semibold text-[#202a2f]">{item.need}</div><div>{item.response}</div></div>)}</div> : <p className="italic text-[#81898e]">Réponse à préciser.</p>}</Section>
    <Section title="Décisions et prochaines étapes"><PairGrid leftTitle="Décisions" left={<BulletList items={content.decisions} />} rightTitle="Prochaines actions" right={<BulletList items={(content.nextSteps || []).map(step => `${step.owner || "À définir"} — ${step.action}${step.dueDate ? ` · ${formatDate(step.dueDate)}` : ""}`)} />} /></Section>
  </div>;
}

function SD02Document({ content }: { content: SD02Content }) {
  const steps = content.milestones || [];
  return <div className="space-y-5 sm:space-y-6"><Section title="Plan d’action" kicker="SD02 · Les étapes à franchir ensemble">
    {steps.length ? <div className="relative"><div className="absolute bottom-8 left-[15px] top-8 w-px bg-[#d9dde0] sm:left-[19px]" /><div className="space-y-4">{steps.map((item, index) => {
      const status = stageStatus(item.status);
      return <article key={`${item.milestone}-${index}`} className="relative grid grid-cols-[32px_1fr] gap-3 sm:grid-cols-[40px_1fr] sm:gap-4">
        <div className="relative z-10 mt-4 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[#6e62c3] font-mono text-[10px] font-semibold text-white shadow-sm sm:h-10 sm:w-10">{String(index + 1).padStart(2, "0")}</div>
        <div className="rounded-[14px] border border-[#e1e5e7] bg-white p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><h3 className="text-[17px] font-semibold leading-6 text-[#202a2f]">{item.milestone}</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.classes}`}>{status.label}</span></div><div className="mt-4 grid gap-3 border-t border-[#eceeef] pt-4 text-[13px] sm:grid-cols-2"><div><Eyebrow>Responsable</Eyebrow><div className="mt-1 font-medium text-[#4c565b]">{item.owner || "À définir"}</div></div><div><Eyebrow>Échéance</Eyebrow><div className="mt-1 font-medium text-[#4c565b]">{formatDate(item.dueDate) || "À définir"}</div></div></div>{item.dependency ? <div className="mt-3 rounded-lg bg-[#f6f7f8] px-3 py-2 text-[12px] text-[#687277]"><strong>Dépendance :</strong> {item.dependency}</div> : null}</div>
      </article>;
    })}</div></div> : <p className="italic text-[#81898e]">Aucune étape définie.</p>}
  </Section></div>;
}

function SD03Document({ content }: { content: SD03Content }) {
  return <div className="space-y-5 sm:space-y-6">
    <Section title="Solution retenue" kicker="SD03 · Solution & intégration"><p className="text-[18px] font-medium leading-8 text-[#202a2f]">{content.solutionSummary || "Solution à finaliser."}</p></Section>
    <Section title="Périmètre"><PairGrid leftTitle="Inclus" left={<BulletList items={content.scopeIn} />} rightTitle="Hors périmètre" right={<BulletList items={content.scopeOut} />} /></Section>
    <Section title="Intégration"><PairGrid leftTitle="Intégrations" left={<BulletList items={content.integrations} />} rightTitle="Données nécessaires" right={<BulletList items={content.dataRequirements} />} /></Section>
    <Section title="Pilote"><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-[#f6f7f8] p-4"><Eyebrow>Périmètre</Eyebrow><div className="mt-2 font-semibold text-[#202a2f]">{content.pilot?.perimeter || "À définir"}</div></div><div className="rounded-xl bg-[#f6f7f8] p-4"><Eyebrow>Durée</Eyebrow><div className="mt-2 font-semibold text-[#202a2f]">{content.pilot?.duration || "À définir"}</div></div></div><div className="mt-5"><Eyebrow>Critères de succès</Eyebrow><div className="mt-3"><BulletList items={content.pilot?.successMetrics} /></div></div></Section>
    <Section title="Déploiement"><PairGrid leftTitle="Sécurité & conformité" left={<BulletList items={content.securityAndCompliance} />} rightTitle="Plan de déploiement" right={<BulletList items={content.deploymentPlan} />} /></Section>
  </div>;
}

function SD04Document({ content }: { content: SD04Content }) {
  const pdfUrl = /^https?:\/\//i.test(content.deckSubtitle || "") ? content.deckSubtitle : "";
  const fileName = content.deckTitle || "Offre commerciale.pdf";
  return <div className="space-y-5 sm:space-y-6"><Section title="Document commercial" kicker="SD04 · PDF commercial">
    {pdfUrl ? <div className="overflow-hidden rounded-[16px] border border-[#d9dee1] bg-[#eef0f2] shadow-sm">
      <div className="flex flex-col gap-3 border-b border-white/10 bg-[#20282d] px-4 py-3 text-white sm:flex-row sm:items-center">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10"><FileText className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{fileName}</div><div className="mt-0.5 text-[11px] text-white/55">Document PDF partagé par Gando</div></div>
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-3 text-[12px] font-semibold text-[#20282d]"><ExternalLink className="h-3.5 w-3.5" /> Ouvrir en plein écran</a>
      </div>
      <div className="p-2 sm:p-4"><iframe src={pdfUrl} title={fileName} className="hidden h-[780px] w-full rounded-lg border border-[#d9dee1] bg-white md:block" /><div className="grid min-h-40 place-items-center rounded-lg bg-white p-6 text-center md:hidden"><div><FileText className="mx-auto h-8 w-8 text-[#7166c7]" /><p className="mt-3 text-sm text-[#687277]">Ouvrez le PDF en plein écran pour une lecture confortable.</p></div></div></div>
    </div> : <p className="italic text-[#81898e]">Aucun PDF n’a encore été publié.</p>}
  </Section></div>;
}

function SD05Document({ content }: { content: SD05Content }) {
  const signed = content.contractStatus === "signed";
  const ready = content.contractStatus === "ready_to_sign";
  return <div className="space-y-5 sm:space-y-6"><Section title={content.contractTitle || "Contrat"} kicker="SD05 · Contrat & signature">
    <div className="flex flex-col gap-5"><div className="flex flex-wrap items-center gap-3"><span className={`inline-flex rounded-full px-3 py-1.5 text-[12px] font-semibold ${signed ? "bg-[#edf7ef] text-[#376b43]" : ready ? "bg-[#f3f0ff] text-[#5c50ae]" : "bg-[#f1f3f4] text-[#60696e]"}`}>{signed ? "Contrat signé" : ready ? "Prêt à signer" : "Brouillon"}</span>{content.signatureDeadline ? <span className="text-sm text-[#687277]">Signature attendue avant le {formatDate(content.signatureDeadline)}</span> : null}</div>{content.contractSummary ? <p className="text-[16px] leading-7 text-[#465157]">{content.contractSummary}</p> : null}{content.contractUrl ? <a href={content.contractUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-[#202a2f] px-5 text-[13px] font-semibold text-white"><FileSignature className="h-4 w-4" />{signed ? "Voir le contrat signé" : "Ouvrir et signer le contrat"}<ExternalLink className="h-4 w-4" /></a> : <p className="italic text-[#81898e]">Le lien du contrat sera ajouté ici.</p>}</div>
  </Section>{content.signatories?.length ? <Section title="Signataires">{content.signatories.map((person, index) => <div key={`${person.email}-${index}`} className="flex items-center justify-between gap-4 border-b border-[#eceeef] py-3 last:border-0"><div><div className="font-semibold text-[#202a2f]">{person.name}</div><div className="text-sm text-[#687277]">{person.role}{person.email ? ` · ${person.email}` : ""}</div></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${person.signatureStatus === "signed" ? "bg-[#edf7ef] text-[#376b43]" : "bg-[#f1f3f4] text-[#60696e]"}`}>{person.signatureStatus === "signed" ? "Signé" : person.signatureStatus === "sent" ? "Envoyé" : "À signer"}</span></div>)}</Section> : null}</div>;
}

function DocumentBody({ document }: { document: PublicDocument }) {
  if (document.code === "SD01") return <SD01Document content={document.content as SD01Content} />;
  if (document.code === "SD02") return <SD02Document content={document.content as unknown as SD02Content} />;
  if (document.code === "SD03") return <SD03Document content={document.content as unknown as SD03Content} />;
  if (document.code === "SD04") return <SD04Document content={document.content as unknown as SD04Content} />;
  return <SD05Document content={document.content as unknown as SD05Content} />;
}

const inputStyle: React.CSSProperties = {
  color: "#111111",
  WebkitTextFillColor: "#111111",
  backgroundColor: "#ffffff",
  colorScheme: "light",
};

function AccessGate({ firstName, lastName, email, setFirstName, setLastName, setEmail, loading, error, onSubmit }: { firstName: string; lastName: string; email: string; setFirstName: (value: string) => void; setLastName: (value: string) => void; setEmail: (value: string) => void; loading: boolean; error: string; onSubmit: (event: React.FormEvent) => void }) {
  const inputClass = "mt-2 h-11 w-full rounded-xl border border-[#cbd2d6] bg-white px-3.5 text-[15px] !text-black outline-none placeholder:!text-[#6b7378] focus:border-[#7b6fd0] focus:ring-2 focus:ring-[#7568cf]/10";
  return <main className="min-h-screen bg-[#f5f6f7] px-5 py-8 text-[#111111] sm:px-8 sm:py-12" style={{ colorScheme: "light" }}><div className="mx-auto max-w-[760px]">
    <header className="flex items-center justify-between"><div className="flex items-center gap-2.5"><GandoMark className="h-8 w-8" /><span className="text-sm font-semibold text-black">Gando</span></div><span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#343b3f]">Deal Room privée</span></header>
    <form onSubmit={onSubmit} className="mt-10 rounded-[22px] border border-[#d8dde0] bg-white p-6 text-black shadow-[0_18px_55px_rgba(30,40,45,0.06)] sm:p-8" style={{ colorScheme: "light" }}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#30383d]">Accéder à la Room</div>
      <h1 className="mt-2 text-[34px] font-semibold tracking-[-0.04em] text-black">Identifiez-vous</h1>
      <p className="mt-3 text-[15px] leading-7 text-[#262d31]">Ces informations permettent d’attribuer les commentaires et validations.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2"><label><span className="text-[12px] font-semibold text-black">Prénom</span><input value={firstName} onChange={event => setFirstName(event.target.value)} required autoComplete="given-name" placeholder="Prénom" className={inputClass} style={inputStyle} /></label><label><span className="text-[12px] font-semibold text-black">Nom</span><input value={lastName} onChange={event => setLastName(event.target.value)} required autoComplete="family-name" placeholder="Nom" className={inputClass} style={inputStyle} /></label></div>
      <label className="mt-4 block"><span className="text-[12px] font-semibold text-black">Email professionnel</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" placeholder="prenom@entreprise.com" className={inputClass} style={inputStyle} /></label>
      {error ? <p className="mt-4 rounded-xl bg-[#fff3f1] px-3.5 py-3 text-[13px] text-[#9a4137]">{error}</p> : null}
      <button type="submit" disabled={loading} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#202a2f] px-4 text-[14px] font-semibold text-white transition hover:bg-[#303b40] disabled:opacity-55">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Entrer dans la Room <ChevronRight className="h-4 w-4" /></button>
      <div className="mt-4 flex items-center justify-center gap-2 text-[12px] text-[#40494e]"><ShieldCheck className="h-4 w-4 text-[#6558c8]" /> Accès identifié et confidentiel</div>
    </form>
  </div></main>;
}

export function PublicSDRoomV6({ token }: { token: string }) {
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

  if (!data) return <AccessGate firstName={firstName} lastName={lastName} email={email} setFirstName={setFirstName} setLastName={setLastName} setEmail={setEmail} loading={loading} error={error} onSubmit={unlock} />;
  if (!currentDocument) return <main className="grid min-h-screen place-items-center bg-[#f5f6f7] px-5 text-center"><div><h1 className="text-2xl font-semibold text-[#202a2f]">Room en préparation</h1><p className="mt-2 text-[#6f787d]">Aucune étape n’est encore publiée.</p></div></main>;

  const validatedBy = [currentDocument.validated_by_first_name, currentDocument.validated_by_last_name].filter(Boolean).join(" ");

  return <main className="min-h-screen bg-[#f5f6f7] text-[#1c2529]">
    <header className="sticky top-0 z-50 border-b border-[#e4e7e9] bg-white/95 backdrop-blur-md"><div className="mx-auto flex h-16 max-w-[1180px] items-center gap-4 px-5 sm:px-7"><div className="flex min-w-0 items-center gap-2.5"><GandoMark className="h-8 w-8 shrink-0" /><span className="hidden text-sm font-semibold sm:inline">Gando</span><span className="text-[#b5bbc0]">/</span><span className="truncate text-sm font-medium text-[#4c565b]">{data.room.companyName}</span></div><div className="ml-auto hidden items-center gap-2 text-[12px] text-[#737c81] sm:flex"><LockKeyhole className="h-3.5 w-3.5" /> Room privée</div><div className="h-7 w-px bg-[#e2e5e7]" /><div className="text-right text-[11px] leading-4 text-[#737c81]"><div className="font-semibold text-[#384247]">{firstName} {lastName}</div><div className="hidden sm:block">{data.visitorEmail}</div></div></div></header>

    <SDRoomBrandBanner companyName={data.room.companyName} logoUrl={data.room.companyLogoUrl} bannerUrl={data.room.bannerImageUrl} theme={data.room.theme} title={data.room.displayTitle || `${data.room.companyName} × Gando`} subtitle={data.room.displaySubtitle || "Espace de collaboration stratégique"} className="border-b border-[#e1e4e6]" />

    <div className="mx-auto grid max-w-[1180px] gap-8 px-5 py-9 sm:px-7 lg:grid-cols-[245px_minmax(0,790px)] lg:justify-between lg:py-12">
      <aside className="lg:sticky lg:top-24 lg:self-start"><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#687277]">Parcours</div><nav className="mt-4 space-y-1.5">{stages.map(({ code, document }) => {
        const active = code === currentDocument.code;
        const enabled = Boolean(document);
        const optional = OPTIONAL_CODES.includes(code);
        return <button key={code} type="button" disabled={!enabled} onClick={() => enabled && setActiveStage(code)} className={`group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${active ? "bg-white shadow-sm ring-1 ring-[#e0e4e6]" : enabled ? "hover:bg-white" : "cursor-default opacity-45"}`}><span className={`mt-0.5 font-mono text-[11px] font-semibold ${active ? "text-[#584ead]" : "text-[#7f888d]"}`}>{code.slice(2)}</span><span className="min-w-0 flex-1"><span className={`block text-[13px] font-semibold leading-5 ${active ? "text-[#202a2f]" : "text-[#505b60]"}`}>{stageTitle(code)}</span><span className="mt-0.5 block text-[11px] text-[#747e83]">{optional ? "Facultatif · " : "Obligatoire · "}{document?.status === "validated" ? "Validé" : document?.status === "published" ? "À valider" : "À venir"}</span></span>{document?.status === "validated" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4f835e]" /> : active ? <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#6558c8]" /> : null}</button>;
      })}</nav></aside>

      <article className="min-w-0"><div className="mb-7 flex items-center justify-between gap-4 border-b border-[#dfe3e5] pb-5"><div><Eyebrow>{currentDocument.code}{OPTIONAL_CODES.includes(currentDocument.code) ? " · Facultatif" : " · Obligatoire"}</Eyebrow><h2 className="mt-1 text-[30px] font-semibold tracking-[-0.035em] text-[#182227]">{stageTitle(currentDocument.code)}</h2></div><span className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${currentDocument.status === "validated" ? "bg-[#edf7ef] text-[#366844]" : "bg-white text-[#666f74] ring-1 ring-[#dfe3e5]"}`}>{currentDocument.status === "validated" ? "Validé" : "À valider"}</span></div>
        <DocumentBody document={currentDocument} />

        <section className="mt-7 rounded-[18px] border border-[#dfe3e5] bg-white p-5 sm:p-7">{currentDocument.status === "validated" ? <div className="flex gap-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e8f2ea] text-[#3d7049]"><Check className="h-5 w-5" /></div><div><div className="font-semibold text-[#24302c]">Cette étape est validée</div><p className="mt-1 text-[14px] leading-6 text-[#687277]">{validatedBy ? `Validée par ${validatedBy}` : "Validation enregistrée"}{currentDocument.validated_at ? ` · ${formatDate(currentDocument.validated_at)}` : ""}.</p></div></div> : <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><Eyebrow>Validation</Eyebrow><h3 className="mt-1 text-[21px] font-semibold tracking-[-0.02em] text-[#202a2f]">Confirmez-vous le contenu de cette étape ?</h3><p className="mt-2 text-[14px] leading-6 text-[#6b757a]">La validation enregistre votre accord sur cette version.</p></div><button type="button" onClick={() => void validateStage()} disabled={validating || currentDocument.status !== "published"} className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#202a2f] px-5 text-[13px] font-semibold text-white disabled:opacity-45">{validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Valider {currentDocument.code}</button></div>}</section>

        <section className="mt-5 rounded-[18px] border border-[#e1e4e6] bg-[#eef0f2] p-5 sm:p-7"><div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-[#6558c8]" /><h3 className="text-[15px] font-semibold text-[#263136]">Ajouter une remarque</h3></div><p className="mt-2 text-[13px] leading-6 text-[#747d82]">Question, correction ou point à confirmer : votre message sera rattaché à {currentDocument.code}.</p><form onSubmit={sendComment} className="mt-4"><textarea value={comment} onChange={event => setComment(event.target.value)} rows={4} placeholder="Écrivez votre remarque…" className="w-full resize-y rounded-xl border border-[#d5dade] bg-white px-3.5 py-3 text-[15px] leading-6 text-[#11181c] outline-none placeholder:text-[#737c81] focus:border-[#776bd0] focus:ring-2 focus:ring-[#776bd0]/10" /><div className="mt-3 flex items-center justify-between"><span className="text-[11px] text-[#687277]">Attribué à {firstName} {lastName}</span><button type="submit" disabled={!comment.trim() || commentState === "sending"} className="flex h-9 items-center gap-2 rounded-lg border border-[#cfd4d7] bg-white px-3.5 text-[12px] font-semibold text-[#3f494e] disabled:opacity-50">{commentState === "sending" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : commentState === "sent" ? <Check className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}{commentState === "sent" ? "Envoyé" : "Envoyer"}</button></div></form></section>
      </article>
    </div>
    <footer className="border-t border-[#dfe3e5] bg-white px-5 py-7 text-center text-[11px] text-[#848c90]">Document confidentiel · {data.room.companyName} × Gando</footer>
  </main>;
}
