import { redirect } from "next/navigation";
import {
  BarChart3,
  BriefcaseBusiness,
  LockKeyhole,
  LogOut,
  Palette,
  UsersRound,
} from "lucide-react";
import { GandoMark } from "@/components/gando-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { cockpitRoleLabel, getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

type CockpitApp = {
  key: string;
  name: string;
  domain: string;
  href: string;
  icon: typeof UsersRound;
  iconClassName: string;
  disabled?: boolean;
};

function appHref(configuredUrl: string | undefined, fallback: string) {
  return configuredUrl?.trim() || fallback;
}

export default async function Page() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");

  const apps: CockpitApp[] = [
    {
      key: "crm",
      name: "CRM",
      domain: "crm.gando.pro",
      href: appHref(process.env.GANDO_CRM_URL, "/prospection"),
      icon: UsersRound,
      iconClassName: "bg-[#eaf0ff] text-[#315ed3]",
    },
    {
      key: "dealroom",
      name: "Dealroom",
      domain: "dealroom.gando.pro",
      href: appHref(process.env.GANDO_DEALROOM_URL, "/deal-room"),
      icon: BriefcaseBusiness,
      iconClassName: "bg-[#f1eaff] text-[#7652d6]",
      disabled: !access.canAccessDealRoom,
    },
    {
      key: "kpi",
      name: "KPI",
      domain: "kpi.gando.pro",
      href: appHref(process.env.GANDO_KPI_URL, "/kpi"),
      icon: BarChart3,
      iconClassName: "bg-[#e6f7ef] text-[#17845b]",
    },
    {
      key: "design",
      name: "Design",
      domain: "design.gando.pro",
      href: appHref(process.env.GANDO_DESIGN_URL, "/design"),
      icon: Palette,
      iconClassName: "bg-[#fff0e7] text-[#d96c2f]",
    },
  ];

  const accountLabel = access.displayName || access.email || "Compte Gando";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#eef0fa] text-[#202435] dark:bg-[#151722] dark:text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-90 dark:opacity-20"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.36) 0%, rgba(255,255,255,0.36) 45%, transparent 45%, transparent 100%), linear-gradient(315deg, rgba(210,211,237,0.48) 0%, rgba(210,211,237,0.48) 20%, transparent 20%, transparent 100%)",
        }}
      />

      <header className="relative z-10 flex h-20 items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-3">
          <GandoMark className="h-9 w-9" />
          <div>
            <div className="text-sm font-bold tracking-[-0.02em]">Gando</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Cockpit</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden text-right sm:block">
            <div className="max-w-56 truncate text-xs font-semibold">{accountLabel}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">{cockpitRoleLabel(access.role)}</div>
          </div>
          <ThemeToggle />
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              title="Se déconnecter"
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/70 bg-white/65 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>

      <section className="relative z-10 flex min-h-[calc(100vh-80px)] items-center justify-center px-6 pb-24">
        <div className="w-full max-w-5xl">
          <div className="mb-12 text-center">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Cockpit</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Choisissez l’outil Gando que vous souhaitez ouvrir.</p>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 sm:gap-x-10 lg:gap-x-14">
            {apps.map(app => {
              const Icon = app.icon;
              const content = (
                <>
                  <div className="relative grid h-[116px] w-[116px] place-items-center rounded-[20px] border border-white/80 bg-white shadow-[0_8px_24px_rgba(43,47,76,0.12)] transition duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_14px_34px_rgba(43,47,76,0.16)] dark:border-white/10 dark:bg-[#232633]">
                    <div className={`grid h-16 w-16 place-items-center rounded-[18px] ${app.iconClassName}`}>
                      <Icon className="h-8 w-8" strokeWidth={1.9} />
                    </div>
                    {app.disabled ? (
                      <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-slate-500">
                        <LockKeyhole className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 text-center">
                    <div className="text-[17px] font-medium tracking-[-0.02em]">{app.name}</div>
                    <div className="mt-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">{app.domain}</div>
                  </div>
                </>
              );

              if (app.disabled) {
                return (
                  <div key={app.key} className="flex flex-col items-center opacity-55" title="Accès non autorisé pour ce rôle">
                    {content}
                  </div>
                );
              }

              return (
                <a key={app.key} href={app.href} className="group flex flex-col items-center rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#735DF3] focus-visible:ring-offset-4 focus-visible:ring-offset-[#eef0fa]">
                  {content}
                </a>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
