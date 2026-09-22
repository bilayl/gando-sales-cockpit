"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CrmGlobalSearch } from "@/components/crm-global-search";

const TITLES: Array<[string, string]> = [
  ["/kpi", "KPI"],
  ["/prospection", "Prospection"],
  ["/contacts", "Contacts"],
  ["/agenda", "Agenda"],
  ["/deal-room", "Pipeline"],
  ["/settings", "Paramètres"],
  ["/today", "Accueil"],
];

function currentTitle(pathname: string) {
  return TITLES.find(([href]) => pathname === href || pathname.startsWith(`${href}/`))?.[1] || "Cockpit";
}

export function DashboardHeader() {
  const pathname = usePathname();
  const title = currentTitle(pathname);

  return (
    <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-3 border-b border-border/45 bg-background/90 px-3 backdrop-blur-xl sm:px-5">
      <SidebarTrigger className="-ml-1 h-8 w-8 text-muted-foreground hover:text-foreground" />
      <div className="h-4 w-px bg-border/70" />
      <span className="hidden truncate text-[13px] font-medium tracking-[-0.01em] text-muted-foreground sm:inline">{title}</span>
      <div className="ml-auto">
        <CrmGlobalSearch />
      </div>
    </header>
  );
}
