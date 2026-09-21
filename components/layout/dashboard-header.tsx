"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";

const PAGE_META: Array<{ test: (path: string) => boolean; title: string; section?: string }> = [
  { test: path => path === "/today", title: "Accueil" },
  { test: path => path === "/kpi" || path.startsWith("/kpi/"), title: "KPI" },
  { test: path => path === "/prospection" || path.startsWith("/prospection/"), title: "Prospection" },
  { test: path => path === "/contacts" || path.startsWith("/contacts/"), title: "Contacts" },
  { test: path => path === "/agenda" || path.startsWith("/agenda/"), title: "Agenda" },
  { test: path => path === "/deal-room" || path.startsWith("/deal-room/"), title: "Pipeline" },
  { test: path => path === "/settings" || path.startsWith("/settings/"), title: "Paramètres" },
  { test: path => path === "/tasks" || path.startsWith("/tasks/"), title: "Tâches" },
  { test: path => path === "/sourcing" || path.startsWith("/sourcing/"), title: "Sourcing" },
  { test: path => path === "/analytics" || path.startsWith("/analytics/"), title: "Analyse" },
  { test: path => path === "/historique" || path.startsWith("/historique/"), title: "Résumés" },
  { test: path => path === "/emails" || path.startsWith("/emails/"), title: "Emails" },
  { test: path => path === "/support" || path.startsWith("/support/"), title: "Support" },
];

export function DashboardHeader() {
  const pathname = usePathname();
  const meta = PAGE_META.find(item => item.test(pathname)) || { title: "Cockpit" };

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-border/60 bg-background/90 px-3 backdrop-blur-xl sm:px-5">
      <SidebarTrigger className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" />
      <div className="h-4 w-px bg-border/70" />
      <div className="min-w-0 truncate text-[13px] font-medium text-foreground">{meta.title}</div>
      <div className="ml-auto text-[11px] text-muted-foreground">Gando Cockpit</div>
    </header>
  );
}
