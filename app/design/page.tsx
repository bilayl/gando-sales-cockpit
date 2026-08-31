import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BookOpen, ExternalLink, Image as ImageIcon, Palette, Share2 } from "lucide-react";
import { CopyBrandLink } from "@/components/copy-brand-link";
import { GandoMark } from "@/components/gando-mark";
import { bricolageGrotesque, dmSans } from "@/lib/brand-fonts";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function DesignPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");

  const publicBrandUrl = process.env.GANDO_BRAND_URL?.trim() || "/brand";

  return (
    <main className={`${dmSans.className} min-h-screen bg-[#f7f7fb] text-[#202435] dark:bg-[#151722] dark:text-white`}>
      <header className="flex h-20 items-center justify-between border-b border-black/[0.05] px-6 dark:border-white/10 lg:px-10">
        <div className="flex items-center gap-3">
          <GandoMark className="h-9 w-9" />
          <div>
            <div className={`${bricolageGrotesque.className} text-sm font-bold`}>Gando</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Design</div>
          </div>
        </div>
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Cockpit
        </Link>
      </header>

      <div className="mx-auto w-full max-w-[1180px] px-5 py-10 sm:px-8 lg:px-10">
        <section className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-semibold text-orange-700">
            <Palette className="h-3.5 w-3.5" /> Gando Design
          </div>
          <h1 className={`${bricolageGrotesque.className} mt-5 text-4xl font-semibold tracking-[-0.045em]`}>Design</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            L’espace central pour maintenir les ressources de marque et donner aux partenaires les bons fichiers sans échange manuel.
          </p>
        </section>

        <section className="mt-9 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:p-8">
              <div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-[#735DF3]">
                  <BookOpen className="h-6 w-6" />
                </div>
                <h2 className={`${bricolageGrotesque.className} mt-5 text-2xl font-semibold tracking-[-0.035em]`}>Brand Book</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Logos officiels, variantes, couleurs, typographies et règles d’utilisation. La même base alimente une page publique dédiée aux partenaires.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Link href="/design/brand" className="inline-flex items-center gap-2 rounded-xl bg-[#735DF3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6249ee]">
                    Ouvrir le Brand Book <BookOpen className="h-4 w-4" />
                  </Link>
                  <CopyBrandLink href={publicBrandUrl} />
                </div>
              </div>
              <div className="grid min-w-40 place-items-center rounded-3xl bg-[#735DF3] px-8 py-10 text-white">
                <GandoMark className="h-24 w-24" />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4 text-xs dark:border-white/10 dark:bg-white/[0.02] sm:px-8">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400"><Share2 className="h-3.5 w-3.5" /> Lien public partenaire</div>
              <a href={publicBrandUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-[#735DF3] hover:underline">
                Voir `/brand` <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </article>

          <article className="rounded-3xl border border-dashed border-slate-300 bg-white/50 p-6 dark:border-white/15 dark:bg-white/[0.02] sm:p-8">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-white/[0.06]">
              <ImageIcon className="h-5 w-5" />
            </div>
            <h2 className={`${bricolageGrotesque.className} mt-5 text-lg font-semibold`}>Assets partenaires</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Les partenaires peuvent désormais télécharger directement les variantes SVG depuis le Brand Book public, sans compte Cockpit.
            </p>
            <div className="mt-5 rounded-xl bg-slate-100 px-3 py-2 font-mono text-xs text-slate-500 dark:bg-white/[0.05]">/brand</div>
          </article>
        </section>
      </div>
    </main>
  );
}
