import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GandoMark } from "@/components/gando-mark";
import { KpiWorkspace } from "@/components/kpi-workspace";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function KpiPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-[#202435] dark:bg-[#14161f] dark:text-white">
      <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-black/[0.05] bg-[#f7f8fb]/90 px-6 backdrop-blur dark:border-white/10 dark:bg-[#14161f]/90 lg:px-10">
        <div className="flex items-center gap-3">
          <GandoMark className="h-9 w-9" />
          <div>
            <div className="text-sm font-bold">Gando</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">KPI</div>
          </div>
        </div>
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Cockpit
        </Link>
      </header>

      <div className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10">
        <KpiWorkspace canEdit={access.role !== "commercial"} />
      </div>
    </main>
  );
}
