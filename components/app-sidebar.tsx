"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, CalendarDays, ChevronRight, CircleGauge, ListTodo, PhoneCall, Settings, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";

const nav = [
  { href: "/today", label: "Aujourd’hui", icon: CircleGauge },
  { href: "/prospection", label: "Prospection", icon: PhoneCall },
  { href: "/tasks", label: "Tâches", icon: ListTodo },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/analytics", label: "Stats", icon: BarChart3 },
];

export function AppSidebar({ email }: { email?: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex h-[calc(100vh-24px)] w-[224px] shrink-0 flex-col rounded-[22px] border border-border bg-card/80 p-2.5 backdrop-blur minari-scrollbar">
      <div className="flex items-center justify-between px-2 py-2">
        <div className="flex items-center gap-2.5">
          <div className="brand-mark hover-lift grid h-9 w-9 place-items-center rounded-xl">
            <svg width="22" height="22" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M98.8479 81.2759C95.3613 88.4324 89.7153 94.3147 82.706 98.0931C75.6966 101.872 67.6776 103.356 59.7795 102.336C51.8811 101.317 44.5022 97.8459 38.6831 92.4119C32.8637 86.9779 28.8977 79.8554 27.344 72.0485C25.7903 64.2415 26.7273 56.144 30.0231 48.8979C33.3188 41.6516 38.807 35.622 45.7136 31.6592C52.6203 27.6965 60.5972 26.0004 68.5197 26.8102C76.4421 27.62 83.9105 30.8948 89.8717 36.1728L87.804 38.5059C84.1861 42.5879 77.934 42.7267 72.773 40.9575C70.9774 40.3419 69.1075 39.929 67.1975 39.7338C61.9821 39.2006 56.731 40.3172 52.1842 42.926C47.6377 45.5346 44.0247 49.5038 41.8552 54.274C39.6856 59.0443 39.0687 64.3748 40.0916 69.5139C41.1143 74.6533 43.7252 79.342 47.5561 82.9192C51.3868 86.4964 56.2443 88.7815 61.4437 89.4526C66.643 90.1234 71.922 89.1465 76.5362 86.659C78.2261 85.7482 79.7955 84.6513 81.2188 83.3957C85.3096 79.7873 91.139 77.5239 96.0444 79.9115L98.8479 81.2759Z" fill="white"/>
              <path d="M58.7457 70.2185C65.9074 65.8701 74.6138 63.9597 83.2509 64.8414C89.7683 65.5067 95.9122 67.7276 101.047 71.2166C103.606 72.9549 102.959 76.3178 100.113 77.6647C96.2643 73.9283 88.7754 73.899 83.6102 75.2809C80.5881 76.2958 76.5579 78.9089 73.3011 81.6975C70.7982 83.8406 66.7866 84.4307 64.2231 82.3437C59.6547 78.624 54.1802 72.9909 58.7457 70.2185Z" fill="white"/>
            </svg>
          </div>
          <div className="leading-tight">
            <div className="font-display text-[15px] font-bold tracking-tight">Gando</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cockpit</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label="Compte">
            <UsersRound size={16} />
          </Button>
        </div>
      </div>

      <Separator className="my-3" />

      <nav className="space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Button
              key={href}
              asChild
              variant="ghost"
              className={cn(
                "w-full justify-start gap-2.5 rounded-lg px-3 font-medium",
                active
                  ? "bg-accent text-violet-300 shadow-[inset_0_0_0_1px_rgba(115,93,243,0.25)]"
                  : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
              )}
            >
              <Link href={href} className="relative">
                {active && <span className="absolute -left-2 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(115,93,243,0.8)]" />}
                <Icon size={16} className={cn(active && "text-violet-300")} /> {label}
              </Link>
            </Button>
          );
        })}
        <Button variant="ghost" className="w-full justify-start gap-2.5 rounded-lg px-3 text-muted-foreground hover:text-foreground">
          <Bell size={16} /> Notifications
        </Button>
      </nav>

      <div className="mt-auto space-y-1 border-t border-border pt-3">
        <Button asChild variant="ghost" className="w-full justify-start gap-2.5 rounded-lg px-3 text-muted-foreground hover:text-foreground">
          <Link href="/settings"><Settings size={16} /> Paramètres</Link>
        </Button>

        <div className="mt-1 flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-2.5 py-2.5">
          <Avatar className="h-7 w-7 border border-violet-300/30 bg-accent">
            <AvatarFallback className="bg-accent text-xs font-bold text-violet-300">{(email || "H").slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-xs font-semibold text-foreground">{email || "HubSpot connecté"}</div>
            <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />En ligne</div>
          </div>
          <ChevronRight size={14} className="ml-auto shrink-0 text-muted-foreground" />
        </div>
      </div>
    </aside>
  );
}
