import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Banknote,
  BarChart3,
  Building2,
  ShieldCheck,
  TrendingUp,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { GandoMark } from "@/components/gando-mark";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

type MonthRow = {
  year: number;
  month: string;
  revenue: number | null;
  tdv: number | null;
  deposits: number | null;
  activeRenters: number | null;
  newUsers: number | null;
  registeredUsers: number | null;
  totalClients: number | null;
  cumulativeDepositVolume: number | null;
  growth: number | null;
};

const MONTHS: MonthRow[] = [
  { year: 2025, month: "Novembre", revenue: 60.3, tdv: null, deposits: 1, activeRenters: null, newUsers: null, registeredUsers: null, totalClients: null, cumulativeDepositVolume: null, growth: null },
  { year: 2025, month: "Décembre", revenue: 246.99, tdv: null, deposits: 6, activeRenters: null, newUsers: null, registeredUsers: null, totalClients: null, cumulativeDepositVolume: null, growth: 5 },
  { year: 2026, month: "Janvier", revenue: 237.27, tdv: null, deposits: 5, activeRenters: null, newUsers: null, registeredUsers: null, totalClients: null, cumulativeDepositVolume: null, growth: -0.1667 },
  { year: 2026, month: "Février", revenue: 350.82, tdv: null, deposits: 9, activeRenters: null, newUsers: null, registeredUsers: null, totalClients: null, cumulativeDepositVolume: null, growth: 0.8 },
  { year: 2026, month: "Mars", revenue: 230, tdv: null, deposits: 8, activeRenters: null, newUsers: null, registeredUsers: null, totalClients: null, cumulativeDepositVolume: null, growth: -0.1111 },
  { year: 2026, month: "Avril", revenue: 503.32, tdv: null, deposits: 20, activeRenters: 5, newUsers: null, registeredUsers: null, totalClients: null, cumulativeDepositVolume: null, growth: 1.5 },
  { year: 2026, month: "Mai", revenue: 708.98, tdv: 31100, deposits: 28, activeRenters: 6, newUsers: null, registeredUsers: 125, totalClients: null, cumulativeDepositVolume: null, growth: 0.4 },
  { year: 2026, month: "Juin", revenue: 1174.74, tdv: 43900, deposits: 45, activeRenters: 12, newUsers: 23, registeredUsers: 148, totalClients: 286, cumulativeDepositVolume: 143900, growth: 0.6071 },
  { year: 2026, month: "Juillet", revenue: 1714.54, tdv: 56610, deposits: 59, activeRenters: 15, newUsers: 18, registeredUsers: 166, totalClients: 289, cumulativeDepositVolume: 200510, growth: 0.3111 },
  { year: 2026, month: "Août", revenue: null, tdv: null, deposits: null, activeRenters: null, newUsers: null, registeredUsers: null, totalClients: null, cumulativeDepositVolume: null, growth: null },
  { year: 2026, month: "Septembre", revenue: null, tdv: null, deposits: null, activeRenters: null, newUsers: null, registeredUsers: null, totalClients: null, cumulativeDepositVolume: null, growth: null },
  { year: 2026, month: "Octobre", revenue: null, tdv: null, deposits: null, activeRenters: null, newUsers: null, registeredUsers: null, totalClients: null, cumulativeDepositVolume: null, growth: null },
  { year: 2026, month: "Novembre", revenue: null, tdv: null, deposits: null, activeRenters: null, newUsers: null, registeredUsers: null, totalClients: null, cumulativeDepositVolume: null, growth: null },
  { year: 2026, month: "Décembre", revenue: null, tdv: null, deposits: null, activeRenters: null, newUsers: null, registeredUsers: null, totalClients: null, cumulativeDepositVolume: null, growth: null },
];

function euro(value: number | null, maximumFractionDigits = 0) {
  if (value == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits }).format(value);
}

function number(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("fr-FR").format(value);
}

function percent(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

export default async function KpiPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");

  const lastClosed = [...MONTHS].reverse().find(row => row.revenue != null && row.deposits != null) ?? MONTHS[0];
  const takeRate = lastClosed.revenue != null && lastClosed.tdv ? lastClosed.revenue / lastClosed.tdv : null;
  const arpu = lastClosed.revenue != null && lastClosed.activeRenters ? lastClosed.revenue / lastClosed.activeRenters : null;
  const tdvPerRenter = lastClosed.tdv != null && lastClosed.activeRenters ? lastClosed.tdv / lastClosed.activeRenters : null;
  const completed = MONTHS.filter(row => row.revenue != null);
  const maxRevenue = Math.max(...completed.map(row => row.revenue || 0), 1);

  const primaryMetrics = [
    { label: "Revenu", value: euro(lastClosed.revenue, 2), helper: "revenu du mois", icon: Banknote },
    { label: "TDV", value: euro(lastClosed.tdv), helper: "volume traité", icon: WalletCards },
    { label: "Take rate", value: percent(takeRate), helper: "revenu / TDV", icon: TrendingUp },
    { label: "Cautions activées", value: number(lastClosed.deposits), helper: "sur le mois", icon: ShieldCheck },
    { label: "Loueurs actifs", value: number(lastClosed.activeRenters), helper: "MAU", icon: Building2 },
    { label: "ARPU loueur", value: euro(arpu, 2), helper: "revenu / loueur actif", icon: Activity },
  ];

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
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
              <BarChart3 className="h-3.5 w-3.5" /> Pilotage entreprise
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">Business KPI</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">La santé de Gando, pas la performance du CRM.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Dernier mois renseigné</div>
            <div className="mt-1 text-lg font-semibold">{lastClosed.month} {lastClosed.year}</div>
            <div className="mt-0.5 text-xs text-slate-400">Août est actuellement en cours de saisie</div>
          </div>
        </section>

        <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {primaryMetrics.map(({ label, value, helper, icon: Icon }) => (
            <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"><Icon className="h-4 w-4" /></span>
              </div>
              <div className="mt-5 text-[25px] font-semibold tracking-[-0.04em]">{value}</div>
              <div className="mt-1 text-[11px] text-slate-400">{helper}</div>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Croissance du revenu</h2>
                <p className="mt-1 text-xs text-slate-400">Évolution mensuelle depuis novembre 2025</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-semibold">{percent(lastClosed.growth)}</div>
                <div className="text-[11px] text-slate-400">croissance cautions / mois</div>
              </div>
            </div>
            <div className="mt-7 flex h-52 items-end gap-2 border-b border-slate-100 pb-2 dark:border-white/10">
              {completed.map(row => {
                const height = Math.max(8, ((row.revenue || 0) / maxRevenue) * 100);
                return (
                  <div key={`${row.year}-${row.month}`} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                    <div className="text-[9px] font-semibold text-slate-400">{row.revenue ? Math.round(row.revenue) : 0}</div>
                    <div className="w-full max-w-12 rounded-t-lg bg-[#735DF3]" style={{ height: `${height}%` }} />
                    <div className="w-full truncate text-center text-[9px] text-slate-400">{row.month.slice(0, 3)}</div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <h2 className="text-base font-semibold">Business snapshot</h2>
            <p className="mt-1 text-xs text-slate-400">Base connue à fin {lastClosed.month.toLowerCase()}</p>
            <div className="mt-5 divide-y divide-slate-100 dark:divide-white/10">
              {[
                ["Utilisateurs inscrits", number(lastClosed.registeredUsers)],
                ["Nouveaux utilisateurs", number(lastClosed.newUsers)],
                ["Nombre total de clients", number(lastClosed.totalClients)],
                ["Volume de caution cumulé", euro(lastClosed.cumulativeDepositVolume)],
                ["TDV / loueur actif", euro(tdvPerRenter)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-3">
                  <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
                  <span className="text-sm font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
            <div>
              <h2 className="text-base font-semibold">Suivi mensuel</h2>
              <p className="mt-1 text-xs text-slate-400">Reprise de la structure du tableau “KPI Suivi Mensuel cautions”.</p>
            </div>
            <div className="text-[11px] text-slate-400">Source métier : Notion</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:bg-white/[0.025]">
                <tr>
                  <th className="px-5 py-3">Mois</th>
                  <th className="px-4 py-3">Revenu</th>
                  <th className="px-4 py-3">TDV</th>
                  <th className="px-4 py-3">Take rate</th>
                  <th className="px-4 py-3">Cautions</th>
                  <th className="px-4 py-3">Loueurs actifs</th>
                  <th className="px-4 py-3">Croissance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm dark:divide-white/10">
                {MONTHS.map(row => {
                  const rowTakeRate = row.revenue != null && row.tdv ? row.revenue / row.tdv : null;
                  const future = row.revenue == null && row.deposits == null;
                  return (
                    <tr key={`${row.year}-${row.month}`} className={future ? "text-slate-300 dark:text-slate-600" : "hover:bg-slate-50/70 dark:hover:bg-white/[0.02]"}>
                      <td className="px-5 py-3.5 font-medium">{row.month} <span className="ml-1 text-xs font-normal text-slate-400">{row.year}</span></td>
                      <td className="px-4 py-3.5 font-medium">{euro(row.revenue, 2)}</td>
                      <td className="px-4 py-3.5">{euro(row.tdv)}</td>
                      <td className="px-4 py-3.5">{percent(rowTakeRate)}</td>
                      <td className="px-4 py-3.5">{number(row.deposits)}</td>
                      <td className="px-4 py-3.5">{number(row.activeRenters)}</td>
                      <td className="px-4 py-3.5">{percent(row.growth)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-5 flex items-start gap-2 text-xs text-slate-400">
          <UsersRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Les statistiques d’appels, rendez-vous et activité SDR restent dans le CRM. KPI est réservé aux indicateurs de pilotage de Gando.
        </footer>
      </div>
    </main>
  );
}
