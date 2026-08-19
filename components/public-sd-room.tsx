"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  CircleHelp,
  FileCheck2,
  Loader2,
  LockKeyhole,
  MessageSquare,
  Route,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SD_CODES,
  SD_STAGE_META,
  type SD01Content,
  type SDCode,
  type SDDocumentRecord,
} from "@/lib/sd-room-types";
import { cn } from "@/lib/utils";

type PublicRoomData = {
  room: { id: string; title: string; companyName: string; currentStage: SDCode; updatedAt: string };
  documents: SDDocumentRecord[];
  visitorEmail: string;
};

function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: typeof Building2; children: React.ReactNode }) {
  return (
    <section data-room-section={id} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#ee6a2c]/10 text-[#d9571b]"><Icon className="h-5 w-5" /></span><h2 className="text-lg font-bold tracking-[-0.02em] text-slate-950">{title}</h2></div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function BulletList({ items, empty = "À confirmer ensemble" }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="text-sm italic text-slate-500">{empty}</p>;
  return <ul className="space-y-2.5">{items.map((item, index) => <li key={index} className="flex gap-3 text-sm leading-6 text-slate-700"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#ee6a2c]" /><span>{item}</span></li>)}</ul>;
}

function SD01PublicDocument({ content }: { content: SD01Content }) {
  return (
    <div className="space-y-5">
      <section data-room-section="summary" className="scroll-mt-24 overflow-hidden rounded-2xl bg-slate-950 p-6 text-white shadow-xl sm:p-9">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff9c6b]">SD01 · Synthèse exécutive</div>
        <p className="mt-5 max-w-4xl whitespace-pre-line text-lg leading-8 text-slate-100 sm:text-xl">{content.executiveSummary || "Synthèse en cours de validation."}</p>
      </section>

      <Section id="company" title="Contexte et organisations" icon={Building2}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Secteur</div><div className="mt-2 text-sm font-semibold text-slate-900">{content.companyProfile.sector || "À confirmer"}</div></div>
          <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Entreprise</div><div className="mt-2 text-sm leading-6 text-slate-700">{content.companyProfile.description || "À compléter"}</div></div>
        </div>
        {content.companyProfile.context ? <p className="mt-4 text-sm leading-6 text-slate-700">{content.companyProfile.context}</p> : null}
        {content.gandoContext ? <div className="mt-4 rounded-xl border border-[#ee6a2c]/20 bg-[#ee6a2c]/5 p-4 text-sm leading-6 text-slate-700"><strong className="text-slate-950">Pourquoi Gando :</strong> {content.gandoContext}</div> : null}
      </Section>

      <Section id="stakeholders" title="Personnes clés" icon={Users}>
        {content.stakeholders.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{content.stakeholders.map((person, index) => <article key={`${person.name}-${index}`} className="rounded-xl border border-slate-200 p-4"><div className="font-semibold text-slate-950">{person.name}</div><div className="mt-1 text-sm text-[#d9571b]">{person.role || "Rôle à confirmer"}</div><div className="mt-1 text-xs text-slate-500">{person.organization}</div>{person.notes ? <p className="mt-3 text-xs leading-5 text-slate-600">{person.notes}</p> : null}</article>)}</div> : <p className="text-sm italic text-slate-500">Cartographie des parties prenantes à compléter.</p>}
      </Section>

      <Section id="process" title="Processus actuel et modèle" icon={Route}>
        <div className="grid gap-6 lg:grid-cols-3"><div><h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Processus</h3><BulletList items={content.currentProcess} /></div><div><h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Offres / produits</h3><BulletList items={content.productsAndOffers} /></div><div><h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Business model</h3><BulletList items={content.businessModel} /></div></div>
      </Section>

      <Section id="pains" title="Enjeux prioritaires" icon={Target}>
        {content.painPoints.length ? <div className="grid gap-3 lg:grid-cols-3">{content.painPoints.map((pain, index) => <article key={`${pain.title}-${index}`} className="rounded-xl border border-slate-200 p-5"><Badge className="bg-slate-950 text-white hover:bg-slate-950">Priorité {pain.priority}</Badge><h3 className="mt-3 font-bold text-slate-950">{pain.title}</h3><div className="mt-3"><BulletList items={pain.details} /></div></article>)}</div> : <p className="text-sm italic text-slate-500">Enjeux à préciser ensemble.</p>}
      </Section>

      <Section id="solution" title="Réponse envisagée" icon={Sparkles}>
        {content.solutionFit.length ? <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">{content.solutionFit.map((item, index) => <div key={index} className="grid gap-2 p-4 sm:grid-cols-2 sm:gap-6"><div className="text-sm font-semibold text-slate-950">{item.need}</div><div className="text-sm leading-6 text-slate-600">{item.response}</div></div>)}</div> : <p className="text-sm italic text-slate-500">Périmètre de solution à confirmer.</p>}
      </Section>

      <Section id="value" title="Valeur et critères de succès" icon={FileCheck2}>
        <div className="grid gap-5 lg:grid-cols-2"><div className="space-y-3">{content.roi.valueLevers.map((item, index) => <article key={index} className="rounded-xl bg-slate-50 p-4"><div className="font-semibold text-slate-950">{item.lever}</div><p className="mt-1 text-sm leading-6 text-slate-600">{item.mechanism}</p>{item.value ? <div className="mt-2 text-sm font-bold text-[#d9571b]">{item.value}</div> : null}</article>)}</div><div><h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Métriques à obtenir</h3><BulletList items={content.roi.metricsRequired} /></div></div>
      </Section>

      <Section id="next" title="Décisions et prochaines étapes" icon={CalendarCheck2}>
        <div className="grid gap-6 lg:grid-cols-2"><div><h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Décisions actées</h3><BulletList items={content.decisions} /><h3 className="mb-3 mt-6 text-xs font-bold uppercase tracking-wider text-slate-500">Pourquoi maintenant ?</h3><BulletList items={content.urgency} /></div><div><h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Plan d’action</h3><div className="space-y-3">{content.nextSteps.map((step, index) => <article key={index} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div className="text-sm font-semibold text-slate-950">{step.action}</div>{step.dueDate ? <Badge variant="outline" className="shrink-0 border-slate-300 text-slate-600">{step.dueDate}</Badge> : null}</div><div className="mt-2 text-xs text-slate-500">Responsable : {step.owner || "à définir"}</div></article>)}{!content.nextSteps.length ? <p className="text-sm italic text-slate-500">Prochaines étapes à confirmer.</p> : null}</div></div></div>
        {content.openQuestions.length ? <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-center gap-2 font-semibold text-amber-950"><CircleHelp className="h-4 w-4" /> Questions ouvertes</div><div className="mt-3"><BulletList items={content.openQuestions} /></div></div> : null}
      </Section>
    </div>
  );
}

export function PublicSDRoom({ token }: { token: string }) {
  const [email, setEmail] = useState("");
  const [data, setData] = useState<PublicRoomData | null>(null);
  const [activeStage, setActiveStage] = useState<SDCode>("SD01");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [comment, setComment] = useState("");
  const [commentState, setCommentState] = useState<"idle" | "sending" | "sent">("idle");
  const viewedSections = useRef(new Set<string>());
  const visitorEmail = data?.visitorEmail || "";

  useEffect(() => {
    const storageKey = `gando-room-session:${token}`;
    const stored = sessionStorage.getItem(storageKey);
    const next = stored || crypto.randomUUID();
    if (!stored) sessionStorage.setItem(storageKey, next);
    setSessionId(next);
    const savedEmail = sessionStorage.getItem(`gando-room-email:${token}`);
    if (savedEmail) setEmail(savedEmail);
  }, [token]);

  const track = useCallback((eventType: string, documentCode: SDCode | null, metadata: Record<string, unknown> = {}, activeSeconds = 0) => {
    if (!visitorEmail || !sessionId) return;
    void fetch(`/api/public/deal-room/${encodeURIComponent(token)}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: visitorEmail, sessionId, eventType, documentCode, metadata, activeSeconds }),
      keepalive: true,
    });
  }, [sessionId, token, visitorEmail]);

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/public/deal-room/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Accès impossible");
      setData(payload);
      setActiveStage(payload.room.currentStage || "SD01");
      sessionStorage.setItem(`gando-room-email:${token}`, payload.visitorEmail);
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : "Accès impossible");
    } finally {
      setLoading(false);
    }
  };

  const sendComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!comment.trim() || !data) return;
    setCommentState("sending");
    try {
      const response = await fetch(`/api/public/deal-room/${encodeURIComponent(token)}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: data.visitorEmail, documentCode: activeStage, sectionKey: activeStage.toLowerCase(), body: comment }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Remarque non enregistrée");
      setComment("");
      setCommentState("sent");
      window.setTimeout(() => setCommentState("idle"), 4000);
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : "Remarque non enregistrée");
      setCommentState("idle");
    }
  };

  useEffect(() => {
    if (!data || !sessionId) return;
    track("room_opened", data.room.currentStage);
  }, [data, sessionId, track]);

  useEffect(() => {
    if (!data || !sessionId) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") track("heartbeat", activeStage, {}, 30);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [activeStage, data, sessionId, track]);

  useEffect(() => {
    if (!data) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const section = (entry.target as HTMLElement).dataset.roomSection;
        if (!section || viewedSections.current.has(section)) continue;
        viewedSections.current.add(section);
        track("section_viewed", activeStage, { section });
      }
    }, { threshold: 0.55 });
    document.querySelectorAll("[data-room-section]").forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [activeStage, data, track]);

  if (!data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f7f9] p-5 text-slate-950">
        <Card className="w-full max-w-md border-slate-200 bg-white p-7 shadow-xl sm:p-9">
          <div className="flex items-center justify-between"><div className="text-xl font-black tracking-[-0.04em] text-slate-950">GANDO</div><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#ee6a2c]/10 text-[#d9571b]"><LockKeyhole className="h-5 w-5" /></span></div>
          <h1 className="mt-8 text-2xl font-bold tracking-[-0.03em]">Accéder à la Deal Room</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Indiquez votre email professionnel pour ouvrir cet espace partagé et garder un historique fiable des consultations.</p>
          <form onSubmit={unlock} className="mt-6 space-y-4"><div className="space-y-2"><Label htmlFor="room-email" className="text-slate-800">Email professionnel</Label><Input id="room-email" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="border-slate-300 bg-white text-slate-950" placeholder="prenom@entreprise.com" /></div>{error ? <p className="text-sm text-rose-600">{error}</p> : null}<Button type="submit" className="w-full bg-[#ee6a2c] text-white hover:bg-[#d9571b]" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />} Ouvrir la room</Button></form>
          <p className="mt-5 text-[11px] leading-5 text-slate-500">Votre email sert uniquement à sécuriser et attribuer l’accès à cette room commerciale.</p>
        </Card>
      </main>
    );
  }

  const currentDocument = data.documents.find(item => item.code === activeStage);
  const available = new Set(data.documents.map(item => item.code));
  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-5 px-5 py-4 sm:px-7"><div className="text-lg font-black tracking-[-0.04em]">GANDO</div><div className="h-6 w-px bg-slate-200" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{data.room.title}</div><div className="text-[11px] text-slate-500">Deal Room partagée · {data.visitorEmail}</div></div><Badge variant="outline" className="hidden border-slate-300 text-slate-600 sm:inline-flex">Mis à jour {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(data.room.updatedAt))}</Badge></div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 pb-3 sm:px-7" aria-label="Étapes SD">{SD_CODES.map(code => <button key={code} type="button" disabled={!available.has(code)} onClick={() => { setActiveStage(code); viewedSections.current.clear(); track("stage_viewed", code); }} className={cn("min-w-36 rounded-lg px-3 py-2 text-left transition-colors", activeStage === code ? "bg-slate-950 text-white" : available.has(code) ? "text-slate-600 hover:bg-slate-100" : "cursor-not-allowed text-slate-300")}><div className="text-[10px] font-bold uppercase tracking-wider">{code}</div><div className="mt-0.5 truncate text-xs font-semibold">{SD_STAGE_META[code].title}</div></button>)}</nav>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-7 sm:py-10">
        {currentDocument?.code === "SD01" ? <SD01PublicDocument content={currentDocument.content as SD01Content} /> : <Card className="border-slate-200 bg-white p-10 text-center shadow-sm"><FileCheck2 className="mx-auto h-8 w-8 text-[#ee6a2c]" /><h1 className="mt-4 text-2xl font-bold">{activeStage} · {SD_STAGE_META[activeStage].title}</h1><p className="mt-2 text-sm text-slate-500">Cette étape sera partagée après validation par les équipes.</p></Card>}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#ee6a2c]/10 text-[#d9571b]"><MessageSquare className="h-5 w-5" /></span><div><h2 className="font-bold text-slate-950">Proposer une correction ou un complément</h2><p className="text-xs text-slate-500">Votre remarque sera attribuée à {data.visitorEmail} et traitée par l’équipe.</p></div></div>
          <form onSubmit={sendComment} className="mt-4"><textarea value={comment} onChange={event => setComment(event.target.value)} rows={4} maxLength={4000} className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-950 outline-none focus:border-[#ee6a2c] focus:ring-2 focus:ring-[#ee6a2c]/15" placeholder={`Votre remarque sur ${activeStage}…`} />{error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}<div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-emerald-700">{commentState === "sent" ? "Merci, votre remarque a bien été enregistrée." : ""}</p><Button type="submit" className="bg-[#ee6a2c] text-white hover:bg-[#d9571b]" disabled={commentState === "sending" || comment.trim().length < 3}>{commentState === "sending" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />} Envoyer la remarque</Button></div></form>
        </section>
        <footer className="mt-10 border-t border-slate-200 py-7 text-center text-xs text-slate-500">Gando × {data.room.companyName} · Une mémoire commune jusqu’à la signature.</footer>
      </div>
    </main>
  );
}
