import {
  BookOpen,
  CheckCircle2,
  Hash,
  Instagram,
  Linkedin,
  Megaphone,
  MessageCircle,
  XCircle,
} from "lucide-react";
import { BrandAssetDownloads } from "@/components/brand-asset-downloads";
import { CopySocialContent } from "@/components/copy-social-content";
import { bricolageGrotesque, dmSans } from "@/lib/brand-fonts";
import { GANDO_BRAND_ASSETS, GANDO_BRAND_COLORS, GANDO_BRAND_CONTRASTS } from "@/lib/gando-brand";

const previewClass = {
  light: "bg-white",
  dark: "bg-[#111111]",
  purple: "bg-[#735DF3]",
};

const contents = [
  ["vision", "01", "Vision de la marque"],
  ["tone", "02", "Ton de communication"],
  ["colors", "03", "Couleurs"],
  ["typography", "04", "Typographies"],
  ["logos", "05", "Logos & variantes"],
  ["social", "06", "Contenus réseaux sociaux"],
  ["accessibility", "07", "Accessibilité"],
  ["usage", "08", "Règles d’usage"],
] as const;

const socialExamples = [
  {
    id: "linkedin",
    label: "LinkedIn",
    title: "Annonce de partenariat",
    icon: Linkedin,
    text: "Nous sommes heureux d’annoncer notre partenariat avec Gando pour proposer une expérience de location plus fluide, plus simple et sans blocage de fonds. Avec Gando, nos clients peuvent sécuriser leur location sans immobiliser plusieurs centaines ou milliers d’euros sur leur carte.",
  },
  {
    id: "instagram",
    label: "Instagram / Facebook",
    title: "Mise en avant de l’offre",
    icon: Instagram,
    text: "La caution évolue. Avec Gando, sécurisez votre location sans bloquer votre argent sur votre carte. Une expérience plus simple pour louer, tout en conservant la sécurité attendue par le loueur.",
  },
  {
    id: "story",
    label: "Story / post court",
    title: "Message court",
    icon: Megaphone,
    text: "Bonne nouvelle : la caution devient plus simple. Louez sans bloquer votre argent grâce à Gando.",
  },
] as const;

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return (
    <div className="max-w-3xl">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#735DF3]">{eyebrow}</div>
      <h2 className={`${bricolageGrotesque.className} mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#111111] sm:text-4xl`}>{title}</h2>
      {copy ? <p className="mt-3 text-sm leading-6 text-black/55 sm:text-base sm:leading-7">{copy}</p> : null}
    </div>
  );
}

function ToneScale({ left, right, value }: { left: string; right: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm font-medium text-[#111111]">
        <span>{left}</span><span className="text-black/35">{right}</span>
      </div>
      <div className="relative mt-3 h-px bg-black/15">
        <div className="absolute -top-[5px] h-[11px] w-[11px] -translate-x-1/2 rounded-full bg-[#735DF3] ring-4 ring-[#735DF3]/10" style={{ left: `${value}%` }} />
      </div>
    </div>
  );
}

export function BrandBookContent() {
  return (
    <div className={`${dmSans.className} mx-auto w-full max-w-[1280px] px-5 pb-16 pt-6 sm:px-8 lg:px-10`}>
      <section className="relative isolate min-h-[500px] overflow-hidden rounded-[36px] bg-[#735DF3] px-7 py-10 text-white sm:px-12 sm:py-14 lg:px-16">
        <div className="absolute -right-20 -top-24 h-80 w-80 rounded-full border-[42px] border-white/10" />
        <div className="absolute -bottom-28 right-40 h-80 w-80 rotate-12 rounded-[70px] border border-white/20" />
        <div className="relative z-10 flex min-h-[400px] flex-col justify-between">
          <div className="flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
              <BookOpen className="h-3.5 w-3.5" /> Brand Book officiel
            </div>
            <div className="text-xs font-medium text-white/60">Gando · 2026</div>
          </div>
          <div className="max-w-4xl">
            <div className={`${bricolageGrotesque.className} text-6xl font-semibold tracking-[-0.065em] sm:text-7xl lg:text-8xl`}>Gando</div>
            <h1 className={`${bricolageGrotesque.className} mt-5 max-w-3xl text-3xl font-medium tracking-[-0.045em] sm:text-5xl`}>
              Une identité simple à reprendre par tous nos partenaires.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-white/75 sm:text-base sm:leading-7">
              Logos, couleurs, typographies et contenus prêts à l’emploi pour communiquer sur Gando de manière cohérente.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8 grid overflow-hidden rounded-[30px] border border-black/10 bg-white lg:grid-cols-[0.9fr_1.1fr]">
        <div className="p-7 sm:p-10 lg:p-12">
          <div className={`${bricolageGrotesque.className} text-3xl font-semibold tracking-[-0.04em] text-[#111111]`}>Sommaire</div>
          <nav className="mt-8 space-y-1">
            {contents.map(([id, number, label]) => (
              <a key={id} href={`#${id}`} className="group grid grid-cols-[42px_1fr] items-center border-b border-black/5 py-3.5 text-sm text-[#111111] transition hover:text-[#735DF3]">
                <span className="font-mono text-xs text-black/35">{number}</span>
                <span className="font-semibold">{label}</span>
              </a>
            ))}
          </nav>
        </div>
        <div className="relative min-h-[420px] overflow-hidden bg-[#111111] p-8 text-white sm:p-12">
          <div className="absolute -right-14 -top-14 h-60 w-60 rounded-full border-[34px] border-[#735DF3]" />
          <div className="absolute bottom-12 right-14 h-40 w-40 rotate-12 rounded-[32px] bg-[#735DF3]" />
          <div className="absolute bottom-24 left-14 h-44 w-32 -rotate-6 rounded-[28px] border-2 border-white" />
          <div className={`${bricolageGrotesque.className} absolute bottom-12 left-12 max-w-xs text-3xl font-semibold leading-tight tracking-[-0.04em]`}>
            Une marque claire, même en co-branding.
          </div>
        </div>
      </section>

      <section id="vision" className="scroll-mt-28 py-20">
        <SectionHeading eyebrow="01 · Vision" title="Vision de la marque" copy="Trois principes simples pour expliquer Gando de manière cohérente." />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {[
            ["01", "Accessibilité", "Réduire les frictions de la location et éviter d’immobiliser inutilement le pouvoir d’achat du locataire."],
            ["02", "Simplicité", "Expliquer le service avec des mots courts, concrets et immédiatement compréhensibles."],
            ["03", "Confiance", "Montrer que la simplicité côté locataire reste compatible avec la sécurité attendue par le loueur."],
          ].map(([number, title, body]) => (
            <article key={title} className="rounded-[26px] border border-black/10 bg-white p-6 sm:p-7">
              <div className="font-mono text-xs text-[#735DF3]">{number}</div>
              <h3 className={`${bricolageGrotesque.className} mt-8 text-2xl font-semibold tracking-[-0.035em] text-[#111111]`}>{title}</h3>
              <p className="mt-3 text-sm leading-6 text-black/55">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="tone" className="scroll-mt-28 border-y border-black/10 py-20">
        <SectionHeading eyebrow="02 · Communication" title="Ton de communication" copy="Une marque accessible et humaine, mais suffisamment précise pour être utilisée par un partenaire professionnel." />
        <div className="mt-8 grid gap-8 rounded-[28px] border border-black/10 bg-white p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:p-10">
          <div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#735DF3] text-white"><MessageCircle className="h-6 w-6" /></div>
            <p className="mt-5 text-sm leading-7 text-black/60">
              Écrire simplement. Éviter le jargon et les formulations trop institutionnelles. Préférer une promesse concrète : moins de fonds bloqués, un parcours plus fluide, une location plus accessible.
            </p>
          </div>
          <div className="space-y-9 rounded-2xl border border-black/10 bg-white p-6 sm:p-8">
            <ToneScale left="Amical" right="Informatif" value={38} />
            <ToneScale left="Détendu" right="Formel" value={42} />
            <ToneScale left="Accessible" right="Technique" value={30} />
          </div>
        </div>
      </section>

      <section id="colors" className="scroll-mt-28 py-20">
        <SectionHeading eyebrow="03 · Couleurs" title="Couleurs de marque" copy="Uniquement les trois couleurs officielles ci-dessous. Aucune autre couleur ne doit être présentée comme une couleur Gando." />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {GANDO_BRAND_COLORS.map(color => (
            <article key={color.hex} className="overflow-hidden rounded-[24px] border border-black/10 bg-white">
              <div className="h-52 border-b border-black/10" style={{ backgroundColor: color.hex }} />
              <div className="p-5">
                <div className={`${bricolageGrotesque.className} text-xl font-semibold text-[#111111]`}>{color.name}</div>
                <div className="mt-1 font-mono text-sm text-black/55">{color.hex}</div>
                <div className="mt-1 text-xs text-black/35">RGB {color.rgb}</div>
                <p className="mt-4 text-xs leading-5 text-black/50">{color.role}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="typography" className="scroll-mt-28 border-y border-black/10 py-20">
        <SectionHeading eyebrow="04 · Typographies" title="Deux polices, deux rôles" copy="Bricolage Grotesque porte les titres. DM Sans assure la lecture des contenus et des interfaces." />
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <article className="overflow-hidden rounded-[28px] border border-black/10 bg-white">
            <div className="bg-[#111111] p-7 text-white sm:p-9">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">Titres & identité</div>
              <div className={`${bricolageGrotesque.className} mt-10 text-5xl font-semibold tracking-[-0.055em] sm:text-6xl`}>Bricolage Grotesque</div>
              <div className={`${bricolageGrotesque.className} mt-8 text-2xl`}>Aa Bb Cc Dd Ee Ff Gg</div>
              <div className={`${bricolageGrotesque.className} mt-2 text-2xl`}>0123456789</div>
            </div>
            <div className="p-7 sm:p-9"><p className="text-sm leading-6 text-black/55">Titres, accroches, chiffres clés et éléments de marque.</p></div>
          </article>
          <article className="overflow-hidden rounded-[28px] border border-black/10 bg-white">
            <div className="bg-[#735DF3] p-7 text-white sm:p-9">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">Texte & interfaces</div>
              <div className={`${dmSans.className} mt-10 text-5xl font-semibold tracking-[-0.055em] sm:text-6xl`}>DM Sans</div>
              <div className={`${dmSans.className} mt-8 text-2xl`}>Aa Bb Cc Dd Ee Ff Gg</div>
              <div className={`${dmSans.className} mt-2 text-2xl`}>0123456789</div>
            </div>
            <div className="p-7 sm:p-9"><p className="text-sm leading-6 text-black/55">Paragraphes, boutons, interfaces, légendes et contenus partenaires.</p></div>
          </article>
        </div>
      </section>

      <section id="logos" className="scroll-mt-28 py-20">
        <SectionHeading eyebrow="05 · Logotypes" title="Logos & variantes" copy="Chaque variante peut être téléchargée directement en SVG ou PNG haute résolution." />
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {GANDO_BRAND_ASSETS.map(asset => (
            <article key={asset.id} className="overflow-hidden rounded-[24px] border border-black/10 bg-white">
              <div className={`grid h-56 place-items-center p-8 ${previewClass[asset.preview]}`}>
                <div className="flex h-full w-full items-center justify-center [&>svg]:max-h-28 [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: asset.svg }} />
              </div>
              <div className="border-t border-black/10 p-5">
                <h3 className={`${bricolageGrotesque.className} text-base font-semibold text-[#111111]`}>{asset.name}</h3>
                <p className="mt-1 min-h-10 text-xs leading-5 text-black/50">{asset.description}</p>
                <BrandAssetDownloads svg={asset.svg} fileName={asset.fileName} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="social" className="scroll-mt-28 border-y border-black/10 py-20">
        <SectionHeading eyebrow="06 · Réseaux sociaux" title="Contenus prêts à reprendre" copy="Des exemples conçus pour que les partenaires puissent annoncer Gando rapidement sur leurs propres réseaux. Le texte est copiable en un clic." />
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {socialExamples.map(example => {
            const Icon = example.icon;
            return (
              <article key={example.id} className="overflow-hidden rounded-[28px] border border-black/10 bg-white">
                <div className="flex aspect-square flex-col justify-between bg-[#735DF3] p-7 text-white">
                  <div className="flex items-center justify-between">
                    <div className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em]">{example.label}</div>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className={`${bricolageGrotesque.className} text-3xl font-semibold leading-tight tracking-[-0.045em]`}>{example.title}</div>
                    <div className="mt-6 flex items-center gap-2 text-sm font-semibold"><span className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#735DF3]">G</span> Gando</div>
                  </div>
                </div>
                <div className="p-6">
                  <p className="min-h-36 text-sm leading-6 text-black/60">{example.text}</p>
                  <div className="mt-5"><CopySocialContent text={example.text} /></div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-5 rounded-[24px] border border-black/10 bg-white p-6 sm:p-7">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#111111]"><Hash className="h-4 w-4 text-[#735DF3]" /> Hashtags suggérés</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {["#Gando", "#Location", "#Mobilité", "#Partenariat", "#Innovation"].map(tag => (
              <span key={tag} className="rounded-full bg-[#735DF3]/10 px-3 py-1.5 text-xs font-semibold text-[#735DF3]">{tag}</span>
            ))}
          </div>
        </div>
      </section>

      <section id="accessibility" className="scroll-mt-28 py-20">
        <SectionHeading eyebrow="07 · Accessibilité" title="Combinaisons de contraste" copy="Utiliser les combinaisons ci-dessous pour conserver une lecture confortable dans les supports partenaires." />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {GANDO_BRAND_CONTRASTS.map(item => (
            <article key={item.label} className="overflow-hidden rounded-[24px] border border-black/10 bg-white">
              <div className="grid h-36 place-items-center text-2xl font-bold" style={{ color: item.foreground, backgroundColor: item.background }}>Aa</div>
              <div className="p-5">
                <div className="text-sm font-semibold text-[#111111]">{item.label}</div>
                <div className="mt-2 text-xs text-black/50">Contraste {item.score}</div>
                <div className="mt-1 text-xs font-semibold text-[#735DF3]">{item.level}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="usage" className="scroll-mt-28 border-t border-black/10 py-20">
        <SectionHeading eyebrow="08 · Usage" title="Les règles à retenir" copy="Si un partenaire ne doit retenir que quelques règles, ce sont celles-ci." />
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <article className="rounded-[28px] border border-[#735DF3]/25 bg-[#735DF3]/5 p-7 sm:p-8">
            <div className={`${bricolageGrotesque.className} flex items-center gap-2 text-lg font-semibold text-[#111111]`}><CheckCircle2 className="h-5 w-5 text-[#735DF3]" /> À faire</div>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-black/65">
              <li>Utiliser uniquement Gando Violet, White et Gando Black comme couleurs de marque.</li>
              <li>Télécharger les logos officiels depuis cette page plutôt que de les recréer.</li>
              <li>Utiliser Bricolage Grotesque pour les titres et DM Sans pour le texte.</li>
              <li>Adapter les exemples de posts au nom du partenaire sans modifier la promesse de fond.</li>
            </ul>
          </article>
          <article className="rounded-[28px] border border-black/15 bg-[#111111] p-7 text-white sm:p-8">
            <div className={`${bricolageGrotesque.className} flex items-center gap-2 text-lg font-semibold`}><XCircle className="h-5 w-5 text-[#735DF3]" /> À éviter</div>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-white/70">
              <li>Ne pas introduire une autre couleur dans la palette officielle Gando.</li>
              <li>Ne pas étirer, incliner ou recolorer le logo.</li>
              <li>Ne pas présenter Gando comme une marketplace.</li>
              <li>Ne pas promettre « zéro caution » : parler de caution sans blocage de fonds.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="rounded-[32px] bg-[#735DF3] px-7 py-10 text-white sm:px-10 sm:py-12">
        <div className="max-w-3xl">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-white/60">Pour les partenaires</div>
          <h2 className={`${bricolageGrotesque.className} mt-3 text-3xl font-semibold tracking-[-0.04em]`}>Logos, textes et règles sont prêts à être utilisés.</h2>
          <p className="mt-3 text-sm leading-6 text-white/75">Cette page est la référence à partager lorsqu’un partenaire prépare une annonce, une intégration ou un support co-brandé avec Gando.</p>
        </div>
      </section>
    </div>
  );
}
