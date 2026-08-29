import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { BrandBookContent } from "@/components/brand-book-content";
import { CopyBrandLink } from "@/components/copy-brand-link";
import { GandoMark } from "@/components/gando-mark";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function DesignBrandPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");

  const publicBrandUrl = process.env.GANDO_BRAND_URL?.trim() || "/brand";

  return (
    <main className="min-h-screen bg-[#f8f9fb] text-[#1B1F23] dark:bg-[#151722] dark:text-white">
      <header className="sticky top-0 z-20 border-b border-black/[0.05] bg-white/90 backdrop-blur dark:border-white/10 dark:bg-[#151722]/90">
        <div className="mx-auto flex h-20 w-full max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <GandoMark className="h-9 w-9" />
            <div>
              <div className="text-sm font-bold">Gando</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Design · Brand Book</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CopyBrandLink href={publicBrandUrl} />
            <a href={publicBrandUrl} target="_blank" rel="noreferrer" className="hidden items-center gap-2 rounded-xl bg-[#735DF3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6249ee] sm:inline-flex">
              Voir la page publique <ExternalLink className="h-4 w-4" />
            </a>
            <Link href="/design" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900 dark:hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Design
            </Link>
          </div>
        </div>
      </header>
      <BrandBookContent />
    </main>
  );
}
