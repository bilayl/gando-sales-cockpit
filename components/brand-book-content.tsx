import { CheckCircle2, Download, ShieldCheck, XCircle } from "lucide-react";
import { GANDO_BRAND_ASSETS, GANDO_BRAND_COLORS, svgDataUrl } from "@/lib/gando-brand";

const previewClass = {
  light: "bg-white",
  dark: "bg-[#111111]",
  purple: "bg-[#735DF3]",
};

export function BrandBookContent() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10 sm:px-8 lg:px-10">
      <section className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700">
          <ShieldCheck className="h-3.5 w-3.5" /> Ressources officielles Gando
        </div>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Brand Book</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500">
          Les logos, couleurs et règles essentielles pour présenter Gando de manière cohérente dans une intégration, une annonce partenaire ou un support commercial.
        </p>
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.025em]">Logos</h2>
            <p className="mt-1 text-sm text-slate-500">Téléchargez la variante adaptée à votre support.</p>
          </div>
          <span className="hidden text-xs font-medium text-slate-400 sm:inline">Format vectoriel SVG</span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {GANDO_BRAND_ASSETS.map(asset => (
            <article key={asset.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className={`grid h-52 place-items-center p-8 ${previewClass[asset.preview]}`}>
                <div className="flex h-full w-full items-center justify-center [&>svg]:max-h-28 [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: asset.svg }} />
              </div>
              <div className="border-t border-slate-100 p-5">
                <h3 className="text-sm font-semibold text-slate-900">{asset.name}</h3>
                <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">{asset.description}</p>
                <a
                  href={svgDataUrl(asset.svg)}
                  download={asset.fileName}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                >
                  <Download className="h-3.5 w-3.5" /> Télécharger SVG
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-[-0.025em]">Couleurs</h2>
        <p className="mt-1 text-sm text-slate-500">Palette principale pour le co-branding et les supports partenaires.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {GANDO_BRAND_COLORS.map(color => (
            <div key={color.hex} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-28" style={{ backgroundColor: color.hex }} />
              <div className="p-4">
                <div className="text-sm font-semibold text-slate-900">{color.name}</div>
                <div className="mt-1 font-mono text-xs text-slate-500">{color.hex}</div>
                <div className="mt-2 text-[11px] leading-4 text-slate-400">{color.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> À faire</div>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-emerald-950/75">
            <li>Utiliser le logo violet ou sombre sur les fonds clairs.</li>
            <li>Utiliser la version blanche sur les fonds violet, noirs ou très sombres.</li>
            <li>Conserver une zone de respiration autour du logo et une taille suffisante pour rester lisible.</li>
            <li>Privilégier les fichiers SVG pour le web, les présentations et les intégrations partenaires.</li>
          </ul>
        </article>
        <article className="rounded-2xl border border-rose-200 bg-rose-50/60 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-800"><XCircle className="h-4 w-4" /> À éviter</div>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-rose-950/75">
            <li>Ne pas étirer, compresser ou faire pivoter le logo.</li>
            <li>Ne pas remplacer le violet Gando par une autre couleur sans validation.</li>
            <li>Ne pas ajouter d’ombre, de contour ou d’effet graphique au symbole.</li>
            <li>Ne pas placer la version sombre sur un fond qui réduit fortement le contraste.</li>
          </ul>
        </article>
      </section>

      <section className="mt-12 rounded-3xl bg-[#735DF3] px-6 py-8 text-white sm:px-8">
        <div className="max-w-2xl">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-white/65">Pour les partenaires</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em]">Vous pouvez partager directement cette page.</h2>
          <p className="mt-3 text-sm leading-6 text-white/75">Elle est pensée comme la source officielle des ressources de marque Gando. Pour un usage qui sort de ces règles, demandez validation à votre interlocuteur Gando.</p>
        </div>
      </section>
    </div>
  );
}
