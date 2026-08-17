"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  CircleGauge,
  ListFilter,
  ListTodo,
  PhoneCall,
  Settings,
  Target,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/today", label: "Aujourd’hui", icon: CircleGauge },
  { href: "/prospection", label: "Prospection", icon: PhoneCall },
  { href: "/segments", label: "Segments", icon: ListFilter },
  { href: "/deal-room", label: "Deal Room", icon: Target },
  { href: "/tasks", label: "Tâches", icon: ListTodo },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/meetings", label: "Rendez-vous", icon: CalendarCheck2 },
  { href: "/analytics", label: "Statistiques", icon: BarChart3 },
];

export function AppSidebar({ email }: { email?: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-[72px] flex-col border-r border-border bg-card px-2.5 py-4 lg:w-[216px] lg:px-3">
      <Link href="/today" className="flex h-11 items-center justify-center gap-2.5 px-1 lg:justify-start lg:px-2">
        <span className="brand-mark grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold text-white">G</span>
        <span className="hidden min-w-0 lg:block">
          <span className="block text-sm font-bold tracking-[-0.02em]">Gando</span>
          <span className="block text-[9px] font-bold uppercase tracking-[0.17em] text-muted-foreground">Sales cockpit</span>
        </span>
      </Link>

      <div className="my-4 border-t border-border" />

      <nav className="space-y-1" aria-label="Navigation principale">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "group flex h-10 items-center justify-center gap-3 rounded-lg px-2.5 text-sm font-semibold transition-colors lg:justify-start",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span className={cn("grid h-5 w-5 place-items-center", active && "text-primary")}>
                <Icon className="h-[17px] w-[17px]" />
              </span>
              <span className="hidden truncate lg:block">{label}</span>
              {active ? <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-primary lg:block" /> : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 border-t border-border pt-3">
        <Link
          href="/settings"
          title="Paramètres"
          className={cn(
            "flex h-10 items-center justify-center gap-3 rounded-lg px-2.5 text-sm font-semibold transition-colors lg:justify-start",
            pathname.startsWith("/settings")
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Settings className="h-[17px] w-[17px]" />
          <span className="hidden lg:block">Paramètres</span>
        </Link>

        <div className="flex items-center justify-center gap-2.5 rounded-lg bg-muted/70 p-2 lg:justify-start">
          <Avatar className="h-7 w-7 shrink-0 border border-border">
            <AvatarFallback className="bg-card text-[11px] font-bold text-primary">
              {(email || "H").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 flex-1 lg:block">
            <div className="truncate text-[11px] font-semibold text-foreground">{email || "HubSpot connecté"}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[9px] font-semibold text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connecté
            </div>
          </div>
          <div className="hidden lg:block"><ThemeToggle /></div>
        </div>
      </div>
    </aside>
  );
}
