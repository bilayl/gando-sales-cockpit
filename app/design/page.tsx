import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Palette } from "lucide-react";
import { GandoMark } from "@/components/gando-mark";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function DesignPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");

  return (
    <main className="min-h-screen bg-[#f7f7fb] text-[#202435] dark:bg-[#151722] dark:text-white">
      <header className="flex h-20 items-center justify-between border-b border-black/[0.05] px-6 dark:border-white/10 lg:px-10">
        <div className="flex items-center gap-3">
          <GandoMark className="h-9 w-9" />
          <div>
            <div className="text-sm font-bold">Gando</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Design</div>
          </div>
        </div>
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Cockpit
        </Link>
      </header>

      <section className="grid min-h-[calc(100vh-80px)] place-items-center p-6">
        <div className="max-w-lg text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-[24px] bg-[#fff0e7] text-[#d96c2f]">
            <Palette className="h-10 w-10" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em]">Gando Design</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            L’espace Design est maintenant isolé comme un produit du Cockpit. Ses outils seront ajoutés ici sans dépendre du CRM.
          </p>
        </div>
      </section>
    </main>
  );
}
