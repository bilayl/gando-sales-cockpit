import type { Metadata } from "next";
import { CopyBrandLink } from "@/components/copy-brand-link";
import { BrandBookContent } from "@/components/brand-book-content";
import { GandoMark } from "@/components/gando-mark";
import { bricolageGrotesque, dmSans } from "@/lib/brand-fonts";

export const metadata: Metadata = {
  title: "Gando · Brand Book",
  description: "Logos, couleurs, typographies et ressources officielles Gando pour les partenaires.",
};

export default function PublicBrandPage() {
  return (
    <main className={`${dmSans.className} min-h-screen bg-[#f8f9fb] text-[#1B1F23]`}>
      <header className="sticky top-0 z-20 border-b border-black/[0.05] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-20 w-full max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <GandoMark className="h-9 w-9" />
            <div>
              <div className={`${bricolageGrotesque.className} text-sm font-bold`}>Gando</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Brand resources</div>
            </div>
          </div>
          <CopyBrandLink />
        </div>
      </header>
      <BrandBookContent />
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-400">
        Ressources officielles Gando · Partenaires
      </footer>
    </main>
  );
}
