"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  Check,
  CheckCircle2,
  CircleHelp,
  FileCheck2,
  Loader2,
  LockKeyhole,
  MessageSquare,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SD_CODES,
  SD_STAGE_META,
  type SD01Content,
  type SDCode,
  type SDDocumentRecord,
  type SDRoomBrandTheme,
} from "@/lib/sd-room-types";
import { cn } from "@/lib/utils";

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
  documents: SDDocumentRecord[];
  visitorEmail: string;
};

type Icon = ComponentType<{ className?: string }>;

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "CL";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function LogoBlock({ name, logoUrl, large = false }: { name: string; logoUrl?: string | null; large?: boolean }) {
  const size = large ? "h-20 w-20 sm:h-24 sm:w-24" : "h-10 w-10";
  if (logoUrl) {
    return (
      <div className={cn("grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/70 bg-white shadow-[0_14px_40px_rgba(51,34,132,0.18)]", size)}>
        <img src={logoUrl} alt={`Logo ${name}`} className="h-full w-full object-contain p-2.5" />
      </div>
    );
  }
  return (
    <div className={cn("grid shrink-0 place-items-center rounded-full border border-white/70 bg-white font-black tracking-[-0.05em] text-[#4d39b8] shadow-[0_14px_40px_rgba(51,34,132,0.18)]", size, large ? "text-xl" : "text-xs")}>
      {initials(name)}
    </div>
  );
}

function GandoLogo({ large = false }: { large?: boolean }) {
  return (
    <div className={cn("grid shrink-0 place-items-center rounded-full border-[3px] border-white bg-white/10 shadow-[0_14px_40px_rgba(51,34,132,0.16)] backdrop-blur", large ? "h-20 w-20 sm:h-24 sm:w-24" : "h-10 w-10")}>
      <img src="/icon.svg" alt="Gando" className={cn("rounded-full object-contain", large ? "h-14 w-14 sm:h-16 sm:w-16" : "h-7 w-7")} />
    </div>
  );
}

function heroTheme(theme: SDRoomBrandTheme) {
  if (theme === "dark") return "from-[#14272e] via-[#273b49] to-[#10191d]";
  if (theme === "light") return "from-[#f4f0ff] via-[#e8e2ff] to-[#d8d0ff]";
  if (theme === "gradient") return "from-[#5238d4] via-[#7c65ef] to-[#ad9cf7]";
  return "from-[#7664ef] via-[#907ff4] to-[#a99bf6]";
}

function ClientHero({ room }: { room: PublicRoomData["room"] }) {
  const darkText = room.theme === "light";
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br px-5 py-8 shadow-[0_26px_70px_rgba(84,62,177,0.18)] sm:px-10 sm:py-11 lg:px-14",
        heroTheme(room.theme),
      )}
      style={room.bannerImageUrl ? { backgroundImage: `linear-gradient(110deg, rgba(87,64,211,.84), rgba(157,139,245,.74)), url(${room.bannerImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      <div className="pointer-events-none absolute -left-24 -top-32 h-72 w-[72%] rotate-[8deg] rounded-[52%] bg-white/10 blur-[1px]" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-60 w-[68%] -rotate-[8deg] rounded-[50%] bg-[#5a41dc]/20" />
      <div className="pointer-events-none absolute left-[18%] top-[46%] h-24 w-[70%] -rotate-[6deg] rounded-full bg-white/[0.055]" />

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center text-center">
        <div className="flex items-center justify-center gap-6 sm:gap-10">
          <LogoBlock name={room.companyName} logoUrl={room.companyLogoUrl} large />
          <span className={cn("text-4xl font-black tracking-[-0.08em] sm:text-5xl", darkText ? "text-[#172a32]" : "text-white")}>×</span>
          <GandoLogo large />
        </div>
        <div className="mt-8 max-w-3xl">
          <div className={cn("text-[10px] font-black uppercase tracking-[0.2em]", darkText ? "text-[#4d39b8]" : "text-white/75")}>Gando Deal Room</div>
          <h1 className={cn("mt-3 text-2xl font-black tracking-[-0.04em] sm:text-4xl", darkText ? "text-[#172a32]" : "text-white")}>{room.displayTitle}</h1>
          <p className={cn("mx-auto mt-3 max-w-2xl text-sm leading-6 sm:text-base", darkText ? "text-[#4c5d63]" : "text-white/80")}>{room.displaySubtitle}</p>
        </div>
      </div>
    </section>
  );
}

function Section({ id, eyebrow, title, icon: Icon, children }: { id: string; eyebrow?: string; title: string; icon: Icon; children: ReactNode }) {
  return (
    <section data-room-section={id} className="scroll-mt-28 rounded-[22px] border border-[#e4e0f3] bg-white p-5 shadow-[0_14px_38px_rgba(40,31,85,0.055)] sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f0edff] text-[#6f58e8]"><Icon className="h-5 w-5" /></span>
        <div>
          {eyebrow ? <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6f58e8]">{eyebrow}</div> : null}
          <h2 className="mt-0.5 text-lg font-black tracking-[-0.025em] text-[#172a32] sm:text-xl">{title}</h2>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function BulletList({ items, empty = "À confirmer ensemble" }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="text-sm italic text-[#829096]">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3 text-sm leading-6 text-[#4c5d63]">
          <span className="mt-1.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#f0edff] text-[#6f58e8]"><Check className="h-2.5 w-2.5" /></span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SD01PublicDocument({ content }: { content: SD01Content }) {
  return (
    <div className="space-y-5">
      <section data-room-section="summary" className="scroll-mt-28 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#172a32] via-[#233d48] to-[#31295c] p-6 text-white shadow-[0_22px_54px_rgba(25,35,55,0.18)] sm:p-9">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#cfc6ff]"><Sparkles className="h-3.5 w-3.5" /> SD01 · Synthèse exécutive</div>
        <p className="mt-5 max-w-4xl whitespace-pre-line text-lg font-medium leading-8 text-white/92 sm:text-xl">{content.executiveSummary || "Synthèse en cours de validation."}</p>
      </section>

      <Section id="company" eyebrow="Contexte" title="L’entreprise et la situation actuelle" icon={Building2}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#f7f8fa] p-4"><div className="text-[10px] font-black uppercase tracking-wider text-[#829096]">Secteur</div><div className="mt-2 text-sm font-bold text-[#172a32]">{content.companyProfile.sector || "À confirmer"}</div></div>
          <div className="rounded-2xl bg-[#f7f8fa] p-4 sm:col-span-2"><div className="text-[10px] font-black uppercase tracking-wider text-[#829096]">Entreprise</div><div className="mt-2 text-sm leading-6 text-[#4c5d63]">{content.companyProfile.description || "À compléter"}</div></div>
        </div>
        {content.companyProfile.context ? <p className="mt-4 text-sm leading-7 text-[#4c5d63]">{content.companyProfile.context}</p> : null}
        {content.gandoContext ? <div className="mt-4 rounded-2xl border border-[#ddd5ff] bg-[#f5f2ff] p-4 text-sm leading-6 text-[#4c5d63]"><strong className="text-[#4d39b8]">Pourquoi Gando :</strong> {content.gandoContext}</div> : null}
      </Section>

      <Section id="stakeholders" eyebrow="Équipe" title="Parties prenantes clés" icon={Users}>
        {content.stakeholders.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {content.stakeholders.map((person, index) => (
              <article key={`${person.name}-${index}`} className="rounded-2xl border border-[#e7e8eb] bg-[#fbfbfc] p-4">
                <div className="font-bold text-[#172a32]">{person.name}</div>
                <div className="mt-1 text-sm font-semibold text-[#6f58e8]">{person.role || "Rôle à confirmer"}</div>
                <div className="mt-1 text-xs text-[#829096]">{person.organization}</div>
                {person.notes ? <p className="mt-3 text-xs leading-5 text-[#637278]">{person.notes}</p> : null}
              </article>
            ))}
          </div>
        ) : <p className="text-sm italic text-[#829096]">Cartographie des parties prenantes à compléter.</p>}
      </Section>

      <Section id="process" eyebrow="Aujourd’hui" title="Processus, offres et modèle" icon={Route}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div><h3 className="mb-3 text-[10px] font-black uppercase tracking-wider text-[#829096]">Processus actuel</h3><BulletList items={content.currentProcess} /></div>
          <div><h3 className="mb-3 text-[10px] font-black uppercase tracking-wider text-[#829096]">Offres / produits</h3><BulletList items={content.productsAndOffers} /></div>
          <div><h3 className="mb-3 text-[10px] font-black uppercase tracking-wider text-[#829096]">Business model</h3><BulletList items={content.businessModel} /></div>
        </div>
      </Section>

      <Section id="pains" eyebrow="Priorités" title="Enjeux à résoudre" icon={Target}>
        {content.painPoints.length ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {content.painPoints.map((pain, index) => (
              <article key={`${pain.title}-${index}`} className="rounded-2xl border border-[#e4e0f3] bg-white p-5">
                <span className="inline-flex rounded-full bg-[#f0edff] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#6f58e8]">Priorité {pain.priority}</span>
                <h3 className="mt-3 font-black text-[#172a32]">{pain.title}</h3>
                <div className="mt-3"><BulletList items={pain.details} /></div>
              </article>
            ))}
          </div>
        ) : <p className="text-sm italic text-[#829096]">Enjeux à préciser ensemble.</p>}
      </Section>

      <Section id="solution" eyebrow="Cible" title="Réponse envisagée avec Gando" icon={Sparkles}>
        {content.solutionFit.length ? (
          <div className="overflow-hidden rounded-2xl border border-[#e4e0f3]">
            {content.solutionFit.map((item, index) => (
              <div key={index} className={cn("grid gap-2 p-4 sm:grid-cols-[0.9fr_1.1fr] sm:gap-6", index ? "border-t border-[#eceaf4]" : "") }>
                <div className="text-sm font-bold text-[#172a32]">{item.need}</div>
                <div className="text-sm leading-6 text-[#637278]">{item.response}</div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm italic text-[#829096]">Périmètre de solution à confirmer.</p>}
      </Section>

      <Section id="value" eyebrow="Business case" title="Valeur et critères de succès" icon={FileCheck2}>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            {content.roi.valueLevers.map((item, index) => (
              <article key={index} className="rounded-2xl bg-[#f7f8fa] p-4">
                <div className="font-bold text-[#172a32]">{item.lever}</div>
                <p className="mt-1 text-sm leading-6 text-[#637278]">{item.mechanism}</p>
                {item.value ? <div className="mt-2 text-sm font-black text-[#6f58e8]">{item.value}</div> : null}
              </article>
            ))}
            {!content.roi.valueLevers.length ? <p className="text-sm italic text-[#829096]">Leviers de valeur à confirmer.</p> : null}
          </div>
          <div className="rounded-2xl border border-[#e4e0f3] p-4"><h3 className="mb-3 text-[10px] font-black uppercase tracking-wider text-[#829096]">Métriques à obtenir</h3><BulletList items={content.roi.metricsRequired} /></div>
        </div>
      </Section>

      <Section id="next" eyebrow="Exécution" title="Décisions et prochaines étapes" icon={CalendarCheck2}>
        <div className="grid gap-7 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-[10px] font-black uppercase tracking-wider text-[#829096]">Décisions actées</h3>
            <BulletList items={content.decisions} />
            <h3 className="mb-3 mt-6 text-[10px] font-black uppercase tracking-wider text-[#829096]">Pourquoi maintenant ?</h3>
            <BulletList items={content.urgency} />
          </div>
          <div>
            <h3 className="mb-3 text-[10px] font-black uppercase tracking-wider text-[#829096]">Plan d’action mutuel</h3>
            <div className="space-y-3">
              {content.nextSteps.map((step, index) => (
                <article key={index} className="relative rounded-2xl border border-[#e4e0f3] bg-[#fbfaff] p-4 pl-12">
                  <span className="absolute left-4 top-4 grid h-6 w-6 place-items-center rounded-full bg-[#6f58e8] text-[10px] font-black text-white">{index + 1}</span>
                  <div className="flex items-start justify-between gap-3"><div className="text-sm font-bold text-[#172a32]">{step.action}</div>{step.dueDate ? <Badge variant="outline" className="shrink-0 border-[#d8d0fa] bg-white text-[#5d4bc6]">{step.dueDate}</Badge> : null}</div>
                  <div className="mt-2 text-xs text-[#829096]">Responsable : {step.owner || "à définir"}</div>
                </article>
              ))}
              {!content.nextSteps.length ? <p className="text-sm italic text-[#829096]">Prochaines étapes à confirmer.</p> : null}
            </div>
          </div>
        </div>
        {content.openQuestions.length ? (
          <div className="mt-6 rounded-2xl border border-[#e5dffb] bg-[#faf8ff] p-5">
            <div className="flex items-center gap-2 font-bold text-[#4d39b8]"><CircleHelp className="h-4 w-4" /> Questions ouvertes</div>
            <div className="mt-3"><BulletList items={content.openQuestions} /></div>
          </div>
        ) : null}
      </Section>
    </div>
  );
}

function AccessGate({ token }: { token: string }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const unlock = async (event: FormEvent) => {
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
      sessionStorage.setItem(`gando-room-email:${token}`, payload.visitorEmail);
      window.dispatchEvent(new CustomEvent("gando-room-unlocked", { detail: payload }));
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : "Accès impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f7f9fa] p-5 text-[#172a32]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[45vh] bg-gradient-to-br from-[#6f58e8] via-[#8b77f2] to-[#b0a1f7]" />
      <div className="pointer-events-none absolute -left-20 top-0 h-48 w-[70%] rotate-[7deg] rounded-full bg-white/10" />
      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/70 bg-white p-7 shadow-[0_30px_90px_rgba(55,38,136,0.22)] sm:p-9">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5"><GandoLogo /><div><div className="text-sm font-black tracking-[-0.03em]">GANDO</div><div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#829096]">Deal Room</div></div></div>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f0edff] text-[#6f58e8]"><LockKeyhole className="h-5 w-5" /></span>
        </div>
        <h1 className="mt-8 text-2xl font-black tracking-[-0.04em]">Votre espace de collaboration</h1>
        <p className="mt-2 text-sm leading-6 text-[#637278]">Indiquez votre email professionnel pour accéder au contenu partagé et conserver un historique fiable des échanges.</p>
        <form onSubmit={unlock} className="mt-6 space-y-4">
          <div className="space-y-2"><Label htmlFor="room-email" className="text-[#394c54]">Email professionnel</Label><Input id="room-email" type="email" value={email} onChange={event => setEmail(event.target.value)} required placeholder="prenom@entreprise.com" className="h-11 border-[#dce5e7] bg-white" /></div>
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">{error}</div> : null}
          <Button type="submit" disabled={loading} className="h-11 w-full bg-[#6f58e8] text-white hover:bg-[#5d48d6]">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />} Ouvrir la Deal Room</Button>
        </form>
        <div className="mt-6 flex items-center gap-2 border-t border-[#edf0f1] pt-5 text-[11px] text-[#829096]"><ShieldCheck className="h-4 w-4 text-[#6f58e8]" /> Cet espace est privé et suivi par Gando.</div>
      </div>
    </main>
  );
}

export function PublicSDRoom({ token }: { token: string }) {
  const [data, setData] = useState<PublicRoomData | null>(null);
  const [activeStage, setActiveStage] = useState<SDCode>("SD01");
  const [sessionId, setSessionId] = useState("");
  const [comment, setComment] = useState("");
  const [commentState, setCommentState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const viewedSections = useRef(new Set<string>());
  const visitorEmail = data?.visitorEmail || "";

  useEffect(() => {
    const storageKey = `gando-room-session:${token}`;
    const stored = sessionStorage.getItem(storageKey);
    const next = stored || crypto.randomUUID();
    if (!stored) sessionStorage.setItem(storageKey, next);
    setSessionId(next);

    const onUnlocked = (event: Event) => {
      const detail = (event as CustomEvent<PublicRoomData>).detail;
      setData(detail);
      setActiveStage(detail.room.currentStage || "SD01");
    };
    window.addEventListener("gando-room-unlocked", onUnlocked);

    const savedEmail = sessionStorage.getItem(`gando-room-email:${token}`);
    if (savedEmail) {
      void fetch(`/api/public/deal-room/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: savedEmail }),
      }).then(async response => {
        const payload = await response.json();
        if (response.ok) {
          setData(payload);
          setActiveStage(payload.room.currentStage || "SD01");
        }
      }).catch(() => undefined);
    }

    return () => window.removeEventListener("gando-room-unlocked", onUnlocked);
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
    }, { threshold: 0.5 });
    document.querySelectorAll("[data-room-section]").forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [activeStage, data, track]);

  const changeStage = (code: SDCode) => {
    setActiveStage(code);
    viewedSections.current.clear();
    track("stage_viewed", code);
  };

  const sendComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!comment.trim() || !data) return;
    setCommentState("sending");
    setError("");
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

  if (!data) return <AccessGate token={token} />;

  const document = data.documents.find(item => item.code === activeStage);
  const content = activeStage === "SD01" && document ? document.content as SD01Content : null;

  return (
    <main className="min-h-screen bg-[#f7f9fa] text-[#172a32]">
      <header className="sticky top-0 z-40 border-b border-[#e8e7ef]/90 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5"><GandoLogo /><div className="min-w-0"><div className="truncate text-sm font-black tracking-[-0.025em]">{data.room.companyName} × Gando</div><div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#829096]">Deal Room stratégique</div></div></div>
          <div className="ml-auto hidden items-center gap-2 rounded-full border border-[#e8e7ef] bg-[#fbfbfc] px-3 py-1.5 text-[11px] text-[#637278] sm:flex"><LockKeyhole className="h-3.5 w-3.5 text-[#6f58e8]" /> {data.visitorEmail}</div>
        </div>
      </header>

      <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 sm:py-8">
        <ClientHero room={data.room} />

        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#e4e0f3] bg-white p-3 shadow-sm lg:flex-row lg:items-center">
          <div className="flex flex-1 gap-2 overflow-x-auto pb-1 lg:pb-0">
            {SD_CODES.map(code => {
              const stageDocument = data.documents.find(item => item.code === code);
              const available = Boolean(stageDocument);
              return (
                <button
                  type="button"
                  key={code}
                  onClick={() => available && changeStage(code)}
                  disabled={!available}
                  className={cn(
                    "min-w-[150px] flex-1 rounded-xl border px-3 py-3 text-left transition-all",
                    activeStage === code ? "border-[#8f7bf2] bg-[#f2efff] shadow-sm" : available ? "border-transparent bg-[#f8f9fa] hover:border-[#ddd5ff] hover:bg-white" : "cursor-not-allowed border-transparent bg-[#fafafa] opacity-45",
                  )}
                >
                  <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-wider text-[#6f58e8]">{code}</span>{stageDocument ? <CheckCircle2 className="h-3.5 w-3.5 text-[#6f58e8]" /> : null}</div>
                  <div className="mt-1 text-xs font-bold text-[#172a32]">{SD_STAGE_META[code].title}</div>
                </button>
              );
            })}
          </div>
          <div className="shrink-0 px-2 text-[10px] text-[#829096]">Mis à jour le {formatDate(data.room.updatedAt)}</div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            {activeStage === "SD01" && content ? (
              <SD01PublicDocument content={content} />
            ) : (
              <section className="rounded-[24px] border border-[#e4e0f3] bg-white p-8 text-center shadow-sm sm:p-12">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f0edff] text-[#6f58e8]"><FileCheck2 className="h-5 w-5" /></div>
                <div className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#6f58e8]">{activeStage}</div>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">{SD_STAGE_META[activeStage].title}</h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#637278]">{SD_STAGE_META[activeStage].subtitle}</p>
              </section>
            )}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-21 xl:self-start">
            <div className="rounded-[22px] border border-[#e4e0f3] bg-white p-5 shadow-[0_14px_38px_rgba(40,31,85,0.05)]">
              <div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-[#6f58e8]" /><h3 className="font-black tracking-[-0.02em]">Un point à partager ?</h3></div>
              <p className="mt-2 text-xs leading-5 text-[#829096]">Laissez une remarque à l’équipe Gando. Elle sera rattachée à cette étape de la Deal Room.</p>
              <form onSubmit={sendComment} className="mt-4 space-y-3">
                <textarea value={comment} onChange={event => setComment(event.target.value)} rows={5} placeholder="Question, correction ou point à valider…" className="w-full resize-y rounded-xl border border-[#dde3e5] bg-[#fbfbfc] px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-[#8f7bf2] focus:ring-2 focus:ring-[#8f7bf2]/15" />
                {error ? <p className="text-xs text-rose-600">{error}</p> : null}
                <Button type="submit" disabled={commentState === "sending" || comment.trim().length < 3} className="w-full bg-[#6f58e8] text-white hover:bg-[#5d48d6]">{commentState === "sending" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : commentState === "sent" ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <MessageSquare className="mr-2 h-4 w-4" />}{commentState === "sent" ? "Remarque envoyée" : "Envoyer à Gando"}</Button>
              </form>
            </div>

            <div className="rounded-[22px] border border-[#e4e0f3] bg-gradient-to-br from-[#f8f6ff] to-white p-5">
              <div className="flex items-center gap-2 text-sm font-black"><ShieldCheck className="h-4 w-4 text-[#6f58e8]" /> Une source de vérité partagée</div>
              <p className="mt-2 text-xs leading-5 text-[#637278]">Cette Deal Room centralise le cadrage, les décisions et les prochaines étapes jusqu’à la signature.</p>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#829096]"><Sparkles className="h-3.5 w-3.5 text-[#6f58e8]" /> Propulsé par Gando</div>
            </div>
          </aside>
        </div>

        <footer className="mt-10 flex flex-col gap-2 border-t border-[#e5e8ea] py-8 text-xs text-[#829096] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2"><GandoLogo /><span>Gando · Infrastructure de confiance pour la location</span></div>
          <span>Espace confidentiel · {data.room.companyName} × Gando</span>
        </footer>
      </div>
    </main>
  );
}
