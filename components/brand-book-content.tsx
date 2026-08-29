import {
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  MessageCircle,
  Palette,
  Shapes,
  Sparkles,
  Type,
  XCircle,
} from "lucide-react";
import { BrandAssetDownloads } from "@/components/brand-asset-downloads";
import { bricolageGrotesque, dmSans } from "@/lib/brand-fonts";
import { GANDO_BRAND_ASSETS, GANDO_BRAND_COLORS, GANDO_BRAND_CONTRASTS } from "@/lib/gando-brand";

const previewClass = {
  light: "bg-white",
  dark: "bg-[#111111]",
  purple: "bg-[#735DF3]",
  petrol: "bg-[#004855]",
};

const contents = [
  ["vision", "01", "Vision de la marque"],
  ["tone", "02", "Ton de communication"],
  ["colors", "03", "Couleurs"],
  ["typography", "04", "Typographies"],
  ["logos", "05", "Logos & variantes"],
  ["accessibility", "06", "Accessibilité"],
  ["graphic-elements", "07", "Éléments graphiques"],
  ["usage", "08", "Règles d’usage"],
] as const;

function WaveLines() {
  return (
    <svg aria-hidden="true" className="absolute inset-0 h-full w-full opacity-45" viewBox="0 0 1200 520" fill="none" preserveAspectRatio="none">
      {Array.from({ length: 11 }, (_, index) => (
        <path
          key={index}
          d={`M-120 ${360 + index * 13} C 160 ${180 + index * 9}, 360 ${470 + index * 8}, 650 ${330 + index * 8} S 1040 ${140 + index * 7}, 1340 ${290 + index * 7}`}
          stroke="#00D776"
          strokeWidth="1.3"
          opacity={0.3 + index * 0.035}
        />
      ))}
      {Array.from({ length: 8 }, (_, index) => (
        <ellipse
          key={`ellipse-${index}`}
          cx="1040"
          cy="100"
          rx={210 + index * 22}
          ry={120 + index * 14}
          stroke="#D4F9C3"
          strokeWidth="1"
          opacity="0.16"
        />
      ))}
    </svg>
  );
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return (
    <div className="max-w-3xl">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#735DF3]">{eyebrow}</div>
      <h2 className={`${bricolageGrotesque.className} mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#111827] sm:text-4xl`}>{title}</h2>
      {copy ? <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base sm:leading-7">{copy}</p> : null}
    </div>
  );
}

function ToneScale({ left, right, value }: { left: string; right: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm font-medium text-slate-700">
        <span>{left}</span><span className="text-slate-400">{right}</span>
      </div>
      <div className="relative mt-3 h-px bg-slate-300">
        <div className="absolute -top-[5px] h-[11px] w-[11px] -translate-x-1/2 rounded-full bg-[#735DF3] ring-4 ring-[#735DF3]/10" style={{ left: `${value}%` }} />
      </div>
    </div>
  );
}

export function BrandBookContent() {
  return (
    <div className={`${dmSans.className} mx-auto w-full max-w-[1280px] px-5 pb-16 pt-6 sm:px-8 lg:px-10`}>
      <section className="relative isolate min-h-[510px] overflow-hidden rounded-[36px] bg-[#004855] px-7 py-10 text-[#D4F9C3] sm:px-12 sm:py-14 lg:px-16">
        <WaveLines />
        <div className="relative z-10 flex min-h-[410px] flex-col justify-between">
          <div className="flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">
              <BookOpen className="h-3.5 w-3.5" /> Brand Book officiel
            </div>
            <div className="text-xs font-medium text-white/55">Gando · 2026</div>
          </div>
          <div className="max-w-4xl">
            <div className={`${bricolageGrotesque.className} text-6xl font-semibold tracking-[-0.065em] text-[#D4F9C3] sm:text-7xl lg:text-8xl`}>Gando</div>
            <h1 className={`${bricolageGrotesque.className} mt-5 max-w-3xl text-3xl font-medium tracking-[-0.045em] text-white sm:text-5xl`}>
              Une identité simple, accessible et immédiatement reconnaissable.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-white/65 sm:text-base sm:leading-7">
              Ce guide rassemble les règles essentielles pour utiliser la marque Gando dans vos intégrations, campagnes, supports commerciaux et communications partenaires.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8 grid overflow-hidden rounded-[30px] border border-slate-200 bg-white lg:grid-cols-[0.9fr_1.1fr]">
        <div className="p-7 sm:p-10 lg:p-12">
          <div className={`${bricolageGrotesque.className} text-3xl font-semibold tracking-[-0.04em] text-slate-900`}>Sommaire</div>
          <nav className="mt-8 space-y-1">
            {contents.map(([id, number, label]) => (
              <a key={id} href={`#${id}`} className="group grid grid-cols-[42px_1fr] items-center border-b border-slate-100 py-3.5 text-sm transition hover:text-[#735DF3]">
                <span className="font-mono text-xs text-slate-400">{number}</span>
                <span className="font-semibold">{label}</span>
              </a>
            ))}
          </nav>
        </div>
        <div className="relative min-h-[420px] overflow-hidden bg-[#f0effb] p-8 sm:p-12">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border-[38px] border-[#D6D0FB]" />
          <div className="absolute bottom-10 right-12 h-40 w-40 rotate-12 rounded-[32px] bg-[#735DF3] shadow-xl" />
          <div className="absolute bottom-28 left-12 h-44 w-32 -rotate-6 rounded-[28px] bg-[#D4F9C3] shadow-lg" />
          <div className="absolute right-36 top-32 h-36 w-36 rotate-6 rounded-[30px] bg-[#004855] shadow-xl" />
          <div className={`${bricolageGrotesque.className} absolute bottom-12 left-12 max-w-xs text-3xl font-semibold leading-tight tracking-[-0.04em] text-[#004855]`}>
            Un système de marque pensé pour rester clair partout.
          </div>
        </div>
      </section>

      <section id="vision" className="scroll-mt-28 py-20">
        <SectionHeading eyebrow="01 · Vision" title="Vision de la marque" copy="Trois principes guident la manière dont Gando doit être présenté, quel que soit le support." />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {[
            ["01", "Accessibilité", "Réduire les frictions et rendre la location plus accessible, sans complexifier le parcours."],
            ["02", "Simplicité", "Expliquer clairement ce que fait Gando, avec une interface et des messages immédiatement compréhensibles."],
            ["03", "Confiance", "Inspirer de la sécurité aux partenaires comme aux utilisateurs grâce à une communication précise et transparente."],
          ].map(([number, title, body]) => (
            <article key={title} className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="font-mono text-xs text-[#735DF3]">{number}</div>
              <h3 className={`${bricolageGrotesque.className} mt-8 text-2xl font-semibold tracking-[-0.035em] text-slate-900`}>{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-500">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="tone" className="scroll-mt-28 border-y border-slate-200 py-20">
        <SectionHeading eyebrow="02 · Communication" title="Ton de communication" copy="La marque doit rester humaine et accessible, tout en conservant le niveau de précision attendu d’un partenaire professionnel." />
        <div className="mt-8 grid gap-8 rounded-[28px] bg-[#fafafa] p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:p-10">
          <div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#D6D0FB] text-[#735DF3]"><MessageCircle className="h-6 w-6" /></div>
            <p className="mt-5 text-sm leading-7 text-slate-600">
              Écrire comme une équipe experte qui rend les choses simples. Éviter le jargon inutile, les formulations trop institutionnelles et les promesses vagues. Préférer des phrases courtes, concrètes et rassurantes.
            </p>
          </div>
          <div className="space-y-9 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <ToneScale left="Amical" right="Informatif" value={38} />
            <ToneScale left="Détendu" right="Formel" value={42} />
            <ToneScale left="Fun" right="Sérieux" value={58} />
          </div>
        </div>
      </section>

      <section id="colors" className="scroll-mt-28 py-20">
        <SectionHeading eyebrow="03 · Couleurs" title="Palette Gando" copy="La palette historique est conservée : pétrole, citron, violet, lavande et vert pomme. Le violet porte la marque ; le pétrole garantit la lisibilité et le contraste." />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {GANDO_BRAND_COLORS.map(color => (
            <article key={color.hex} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <div className="h-44" style={{ backgroundColor: color.hex }} />
              <div className="p-5">
                <div className={`${bricolageGrotesque.className} text-lg font-semibold text-slate-900`}>{color.name}</div>
                <div className="mt-1 font-mono text-xs text-slate-500">{color.hex}</div>
                <div className="mt-1 text-[11px] text-slate-400">RGB {color.rgb}</div>
                <p className="mt-4 text-xs leading-5 text-slate-500">{color.role}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="typography" className="scroll-mt-28 border-y border-slate-200 py-20">
        <SectionHeading eyebrow="04 · Typographies" title="Deux polices, deux rôles" copy="Bricolage Grotesque remplace l’ancienne typographie de titre de la charte. DM Sans devient la police fonctionnelle et éditoriale." />
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
            <div className="bg-[#004855] p-7 text-[#D4F9C3] sm:p-9">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">Titres & identité</div>
              <div className={`${bricolageGrotesque.className} mt-10 text-5xl font-semibold tracking-[-0.055em] sm:text-6xl`}>Bricolage Grotesque</div>
              <div className={`${bricolageGrotesque.className} mt-8 text-2xl tracking-[-0.025em]`}>Aa Bb Cc Dd Ee Ff Gg</div>
              <div className={`${bricolageGrotesque.className} mt-2 text-2xl tracking-[-0.025em]`}>0123456789</div>
            </div>
            <div className="p-7 sm:p-9">
              <p className="text-sm leading-6 text-slate-500">À réserver aux titres, accroches, chiffres clés et éléments de marque. Medium à Bold selon la hiérarchie.</p>
            </div>
          </article>
          <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
            <div className="bg-[#D4F9C3] p-7 text-[#004855] sm:p-9">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#004855]/55">Texte & interfaces</div>
              <div className={`${dmSans.className} mt-10 text-5xl font-semibold tracking-[-0.055em] sm:text-6xl`}>DM Sans</div>
              <div className={`${dmSans.className} mt-8 text-2xl`}>Aa Bb Cc Dd Ee Ff Gg</div>
              <div className={`${dmSans.className} mt-2 text-2xl`}>0123456789</div>
            </div>
            <div className="p-7 sm:p-9">
              <p className="text-sm leading-6 text-slate-500">À utiliser pour les paragraphes, boutons, interfaces, légendes et documents partenaires. Regular à Bold.</p>
            </div>
          </article>
        </div>
      </section>

      <section id="logos" className="scroll-mt-28 py-20">
        <SectionHeading eyebrow="05 · Logotypes" title="Logos & variantes" copy="Utilisez la version primaire dès que l’espace le permet. Lorsque le format devient trop compact, passez au symbole ou à l’icône responsive." />
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {GANDO_BRAND_ASSETS.map(asset => (
            <article key={asset.id} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <div className={`grid h-56 place-items-center p-8 ${previewClass[asset.preview]}`}>
                <div className="flex h-full w-full items-center justify-center [&>svg]:max-h-28 [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: asset.svg }} />
              </div>
              <div className="border-t border-slate-100 p-5">
                <h3 className={`${bricolageGrotesque.className} text-base font-semibold text-slate-900`}>{asset.name}</h3>
                <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">{asset.description}</p>
                <BrandAssetDownloads svg={asset.svg} fileName={asset.fileName} />
              </div>
            </article>
          ))}
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl bg-[#f7f7fb] p-5"><div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Respiration</div><p className="mt-2 text-sm leading-6 text-slate-600">Toujours laisser une zone libre visible autour du logo. Aucun texte, pictogramme ou logo partenaire ne doit le toucher.</p></div>
          <div className="rounded-2xl bg-[#f7f7fb] p-5"><div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Petit format</div><p className="mt-2 text-sm leading-6 text-slate-600">Si le mot-symbole devient difficile à lire, utilisez le symbole seul ou l’icône responsive.</p></div>
          <div className="rounded-2xl bg-[#f7f7fb] p-5"><div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Fonds</div><p className="mt-2 text-sm leading-6 text-slate-600">Version pétrole ou violet sur fond clair ; version blanche sur fond pétrole, violet ou image sombre.</p></div>
        </div>
      </section>

      <section id="accessibility" className="scroll-mt-28 border-y border-slate-200 py-20">
        <SectionHeading eyebrow="06 · Accessibilité" title="Contraste & lisibilité" copy="Les associations ci-dessous reprennent la logique WCAG de la charte graphique et indiquent les combinaisons recommandées pour le texte." />
        <div className="mt-8 overflow-hidden rounded-[26px] border border-slate-200 bg-white">
          {GANDO_BRAND_CONTRASTS.map((pair, index) => (
            <div key={pair.label} className={`grid gap-4 p-5 sm:grid-cols-[1fr_110px_160px] sm:items-center ${index ? "border-t border-slate-100" : ""}`}>
              <div className="flex items-center gap-4">
                <div className="flex -space-x-2">
                  <span className="h-9 w-9 rounded-full border-2 border-white" style={{ backgroundColor: pair.foreground }} />
                  <span className="h-9 w-9 rounded-full border-2 border-white" style={{ backgroundColor: pair.background }} />
                </div>
                <span className="text-sm font-semibold text-slate-800">{pair.label}</span>
              </div>
              <div className="font-mono text-sm font-semibold text-slate-700">{pair.score}</div>
              <div className={`text-xs font-semibold ${pair.level.includes("uniquement") ? "text-amber-600" : "text-emerald-700"}`}>{pair.level}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="graphic-elements" className="scroll-mt-28 py-20">
        <SectionHeading eyebrow="07 · Système graphique" title="Éléments graphiques" copy="Des formes simples permettent de reconnaître Gando même lorsque le logo n’est pas au premier plan." />
        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[28px] bg-[#f8f8fa] p-7 sm:p-9">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#735DF3] shadow-sm"><Shapes className="h-6 w-6" /></div>
            <h3 className={`${bricolageGrotesque.className} mt-6 text-2xl font-semibold tracking-[-0.035em]`}>Formes de base</h3>
            <p className="mt-3 text-sm leading-6 text-slate-500">Cercles, carrés arrondis, losanges et badges pilules. Les formes restent simples, généreuses et faciles à reconnaître.</p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <div className="h-20 w-20 rounded-full bg-[#D6D0FB]" />
              <div className="h-20 w-20 rounded-[18px] bg-[#735DF3]" />
              <div className="h-16 w-16 rotate-45 rounded-[14px] bg-[#D4F9C3]" />
              <div className="rounded-full bg-[#004855] px-6 py-3 text-sm font-semibold text-[#D4F9C3]">Badge Gando</div>
            </div>
          </div>
          <div className="relative min-h-[350px] overflow-hidden rounded-[28px] bg-[#004855] p-8 text-white sm:p-10">
            <WaveLines />
            <div className="relative z-10">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-[#D4F9C3]"><Sparkles className="h-6 w-6" /></div>
              <h3 className={`${bricolageGrotesque.className} mt-6 max-w-md text-3xl font-semibold tracking-[-0.04em]`}>Lignes organiques</h3>
              <p className="mt-3 max-w-md text-sm leading-6 text-white/65">Les lignes répétées peuvent créer du mouvement en arrière-plan. Elles ne doivent jamais nuire à la lecture du contenu principal.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="usage" className="scroll-mt-28 border-t border-slate-200 py-20">
        <SectionHeading eyebrow="08 · Règles d’usage" title="Faire vivre la marque correctement" copy="Quelques règles simples suffisent à préserver la cohérence entre Gando et ses partenaires." />
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <article className="rounded-[26px] border border-emerald-200 bg-emerald-50/60 p-6 sm:p-8">
            <div className={`${bricolageGrotesque.className} flex items-center gap-2 text-lg font-semibold text-emerald-800`}><CheckCircle2 className="h-5 w-5" /> À faire</div>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-emerald-950/75">
              <li>Utiliser les variantes officielles fournies dans cette page.</li>
              <li>Respecter les contrastes et privilégier les combinaisons accessibles.</li>
              <li>Utiliser Bricolage Grotesque pour les titres et DM Sans pour le texte courant.</li>
              <li>Conserver de l’espace autour du logo lors d’un co-branding.</li>
              <li>Utiliser SVG pour le web et PNG pour les outils qui n’acceptent pas le vectoriel.</li>
            </ul>
          </article>
          <article className="rounded-[26px] border border-rose-200 bg-rose-50/60 p-6 sm:p-8">
            <div className={`${bricolageGrotesque.className} flex items-center gap-2 text-lg font-semibold text-rose-800`}><XCircle className="h-5 w-5" /> À éviter</div>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-rose-950/75">
              <li>Ne pas déformer, incliner ou reconstruire le logo.</li>
              <li>Ne pas changer arbitrairement les couleurs du symbole.</li>
              <li>Ne pas ajouter d’ombre, de contour ou d’effet au logo.</li>
              <li>Ne pas utiliser Pomme/Citron pour du texte : le contraste est insuffisant.</li>
              <li>Ne pas coller le logo Gando au logo partenaire sans séparation visuelle.</li>
            </ul>
          </article>
        </div>

        <div className="mt-5 overflow-hidden rounded-[30px] bg-[#735DF3] text-white">
          <div className="grid lg:grid-cols-[1fr_0.8fr]">
            <div className="p-7 sm:p-10">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/60"><BadgeCheck className="h-4 w-4" /> Co-branding partenaire</div>
              <h3 className={`${bricolageGrotesque.className} mt-5 max-w-xl text-3xl font-semibold tracking-[-0.045em] sm:text-4xl`}>Gando × Votre marque</h3>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/70">Présenter les deux marques au même niveau, avec une séparation claire. Si vous avez un doute sur un support important, faites valider le rendu avant diffusion.</p>
            </div>
            <div className="grid min-h-64 place-items-center bg-[#D6D0FB] p-10 text-[#004855]">
              <div className="flex items-center gap-7">
                <div className={`${bricolageGrotesque.className} text-4xl font-semibold tracking-[-0.05em]`}>Gando</div>
                <div className="h-12 w-px bg-[#004855]/20" />
                <div className={`${bricolageGrotesque.className} text-2xl font-medium`}>Votre marque</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] bg-[#004855] px-7 py-9 text-white sm:px-10">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#D4F9C3]/60"><Palette className="h-4 w-4" /> Ressource partenaire</div>
            <h2 className={`${bricolageGrotesque.className} mt-4 text-3xl font-semibold tracking-[-0.045em]`}>Cette page est la source de référence.</h2>
            <p className="mt-3 text-sm leading-6 text-white/65">Les variantes de logos peuvent être téléchargées en SVG et PNG directement depuis la section Logotypes.</p>
          </div>
          <a href="#logos" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D4F9C3] px-5 py-3 text-sm font-bold text-[#004855] transition hover:bg-white">
            <Type className="h-4 w-4" /> Télécharger les logos
          </a>
        </div>
      </section>
    </div>
  );
}
