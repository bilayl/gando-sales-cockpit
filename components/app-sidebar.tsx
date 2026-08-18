"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  ListFilter,
  ListTodo,
  LogOut,
  PhoneCall,
  Search,
  Settings,
  Target,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/prospection", label: "Prospection", icon: PhoneCall },
  { href: "/sourcing", label: "Sourcing", icon: Search },
  { href: "/segments", label: "Segments", icon: ListFilter },
  { href: "/tasks", label: "Tâches", icon: ListTodo },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/meetings", label: "Rendez-vous", icon: CalendarCheck2 },
  { href: "/analytics", label: "Statistiques", icon: BarChart3 },
];

const dealRoomLinks = [
  { href: "/deal-room", label: "Vue d’ensemble", view: null },
  { href: "/deal-room?view=hot", label: "Hot Deals", view: "hot" },
  { href: "/deal-room?view=at_risk", label: "At Risk", view: "at_risk" },
  { href: "/deal-room?view=closing_soon", label: "Closing Soon", view: "closing_soon" },
  { href: "/deal-room?view=no_activity", label: "No Activity", view: "no_activity" },
];

export function AppSidebar({ email }: { email?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dealRoomActive = pathname.startsWith("/deal-room");
  const currentView = searchParams.get("view");

  return (
    <aside className="flex h-screen w-[72px] flex-col border-r border-border bg-card px-2.5 py-4 lg:w-[216px] lg:px-3">
      <Link href="/prospection" className="flex h-11 items-center justify-center gap-2.5 px-1 lg:justify-start lg:px-2">
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

        <div>
          <Link
            href="/deal-room"
            title="Deal Room"
            className={cn(
              "group flex h-9 items-center justify-center gap-2.5 rounded-lg px-2.5 transition-colors lg:justify-start",
              dealRoomActive ? "bg-accent" : "hover:bg-muted"
            )}
          >
            <Target className={cn("h-[17px] w-[17px]", dealRoomActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground lg:block">Deal Room</span>
          </Link>
          <div className="hidden space-y-0.5 pt-0.5 lg:ml-4 lg:block lg:border-l lg:border-border lg:pl-2">
            {dealRoomLinks.map(link => {
              const active = pathname === "/deal-room" && link.view === currentView;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex h-8 items-center gap-2 rounded-md px-2.5 text-xs font-semibold transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span className={cn("h-1 w-1 rounded-full", active ? "bg-primary" : "bg-border")} />
                  <span className="truncate">{link.label}</span>
                  {active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" /> : null}
                </Link>
              );
            })}
          </div>
        </div>
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

        <div className="rounded-lg bg-muted/70 p-2">
          <div className="flex items-center justify-center gap-2.5 lg:justify-start">
            <Avatar className="h-7 w-7 shrink-0 border border-border">
              <AvatarFallback className="bg-card text-[11px] font-bold text-primary">
                {(email || "H").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 flex-1 lg:block">
              <div className="truncate text-[11px] font-semibold text-foreground">{email || "HubSpot connecté"}</div>
              <div className="mt-0.5 flex items-center gap-1 text-[9px] font-semibold text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connecté avec HubSpot
              </div>
            </div>
            <div className="hidden lg:block"><ThemeToggle /></div>
          </div>

          <form action="/api/auth/logout" method="post" className="mt-2">
            <button
              type="submit"
              title="Se déconnecter"
              className="flex h-8 w-full items-center justify-center gap-2 rounded-md text-xs font-semibold text-muted-foreground transition-colors hover:bg-background hover:text-foreground lg:justify-start lg:px-2"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Se déconnecter</span>
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
