"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarCheck2,
  ContactRound,
  FileText,
  Inbox,
  LifeBuoy,
  ListFilter,
  ListTodo,
  LogOut,
  Mail,
  Search,
  Settings,
  Zap,
  Phone,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type CockpitRole = "admin" | "member" | "commercial";
type NavIcon = typeof Phone;
type NavItem = { href: string; label: string; icon: NavIcon };

const callNav: NavItem[] = [
  { href: "/today", label: "Aujourd’hui", icon: Inbox },
  { href: "/phone", label: "Appels", icon: Phone },
  { href: "/historique", label: "Résumés", icon: FileText },
  { href: "/prospection", label: "Power Dialer", icon: Zap },
];

const workspaceNav: NavItem[] = [
  { href: "/prospects", label: "Contacts", icon: ContactRound },
  { href: "/sourcing", label: "Sourcing", icon: Search },
  { href: "/segments", label: "Segments", icon: ListFilter },
  { href: "/tasks", label: "Tâches", icon: ListTodo },
  { href: "/analytics", label: "Analyse", icon: BarChart3 },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

const followUpNav: NavItem[] = [
  { href: "/meetings", label: "Rendez-vous", icon: CalendarCheck2 },
  { href: "/emails", label: "Emails", icon: Mail },
  { href: "/support", label: "Support", icon: LifeBuoy },
];

function roleLabel(role: CockpitRole) {
  return role === "admin" ? "Administrateur" : role === "commercial" ? "Commercial" : "Membre";
}

function GandoMark() {
  return (
    <span className="h-9 w-9 shrink-0 overflow-hidden rounded-[12px]" aria-hidden="true">
      <svg viewBox="0 0 128 128" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <rect width="128" height="128" rx="28" fill="#CDDFFF" />
        <path d="M98.8479 81.2759C95.3613 88.4324 89.7153 94.3147 82.706 98.0931C75.6966 101.872 67.6776 103.356 59.7795 102.336C51.8811 101.317 44.5022 97.8459 38.6831 92.4119C32.8637 86.9779 28.8977 79.8554 27.344 72.0485C25.7903 64.2415 26.7273 56.144 30.0231 48.8979C33.3188 41.6516 38.807 35.622 45.7136 31.6592C52.6203 27.6965 60.5972 26.0004 68.5197 26.8102C76.4421 27.62 83.9105 30.8948 89.8717 36.1728L87.804 38.5059C84.1861 42.5879 77.934 42.7267 72.773 40.9575C70.9774 40.3419 69.1075 39.929 67.1975 39.7338C61.9821 39.2006 56.731 40.3172 52.1842 42.926C47.6377 45.5346 44.0247 49.5038 41.8552 54.274C39.6856 59.0443 39.0687 64.3748 40.0916 69.5139C41.1143 74.6533 43.7252 79.342 47.5561 82.9192C51.3868 86.4964 56.2443 88.7815 61.4437 89.4526C66.643 90.1234 71.922 89.1465 76.5362 86.659C78.2261 85.7482 79.7955 84.6513 81.2188 83.3957C85.3096 79.7873 91.139 77.5239 96.0444 79.9115L98.8479 81.2759Z" fill="#19324D" />
        <path d="M58.7457 70.2185C65.9074 65.8701 74.6138 63.9597 83.2509 64.8414C89.7683 65.5067 95.9122 67.7276 101.047 71.2166C103.606 72.9549 102.959 76.3178 100.113 77.6647C96.2643 73.9283 88.7754 73.899 83.6102 75.2809C80.5881 76.2958 76.5579 78.9089 73.3011 81.6975C70.7982 83.8406 66.7866 84.4307 64.2231 82.3437C59.6547 78.624 54.1802 72.9909 58.7457 70.2185Z" fill="#19324D" />
      </svg>
    </span>
  );
}

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={item.label}
      className={cn(
        "group flex h-10 items-center justify-center gap-2.5 rounded-[13px] px-3 text-[13px] font-medium tracking-[-0.01em] transition-colors lg:justify-start",
        active
          ? "bg-[color-mix(in_srgb,var(--muted)_82%,#dce9e2_18%)] text-foreground"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
      )}
    >
      <Icon className="h-[16px] w-[16px] shrink-0" strokeWidth={1.65} />
      <span className="hidden truncate lg:block">{item.label}</span>
    </Link>
  );
}

export function AppSidebar({ email, role = "member" }: { email?: string; role?: CockpitRole }) {
  const pathname = usePathname();
  const workspaceItems = role === "commercial" ? workspaceNav.filter(item => item.href !== "/segments") : workspaceNav;

  return (
    <aside className="flex h-screen w-[62px] flex-col border-r border-border bg-[color-mix(in_srgb,var(--background)_96%,var(--foreground)_4%)] px-2 py-3.5 text-foreground transition-colors lg:w-[224px] lg:px-3.5">
      <Link href="/today" className="mb-3 flex min-h-12 items-center justify-center gap-2.5 px-1 lg:justify-start lg:px-2">
        <GandoMark />
        <div className="hidden min-w-0 lg:block">
          <div className="truncate text-[17px] font-semibold leading-5 tracking-[-0.035em] text-foreground">Gando</div>
          <div className="mt-0.5 truncate text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Cockpit · CRM</div>
        </div>
      </Link>

      <nav className="min-h-0 flex-1 overflow-y-auto minari-scrollbar" aria-label="Navigation principale">
        <div className="space-y-0.5">
          {callNav.map(item => <SidebarLink key={item.href} item={item} pathname={pathname} />)}
        </div>

        <div className="my-4 border-t border-border/80" />

        <div>
          <div className="mb-1.5 hidden items-center gap-1 px-3 text-[11px] font-medium tracking-[-0.01em] text-muted-foreground lg:flex">
            Workspace <span className="text-[10px]">⌄</span>
          </div>
          <div className="space-y-0.5">
            {workspaceItems.map(item => <SidebarLink key={item.href} item={item} pathname={pathname} />)}
          </div>
        </div>

        <div className="my-4 border-t border-border/80" />

        <div>
          <div className="mb-1.5 hidden px-3 text-[11px] font-medium tracking-[-0.01em] text-muted-foreground lg:block">Suivi</div>
          <div className="space-y-0.5">
            {followUpNav.map(item => <SidebarLink key={item.href} item={item} pathname={pathname} />)}
          </div>
        </div>
      </nav>

      <div className="border-t border-border/80 pt-2.5">
        <div className="mt-1 flex items-center justify-center gap-2 rounded-xl px-2 py-2 lg:justify-start">
          <Avatar className="h-7 w-7 shrink-0 border border-border">
            <AvatarFallback className="bg-muted text-[10px] font-semibold text-foreground">{(email || "G").slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 flex-1 lg:block">
            <div className="truncate text-[11px] font-medium text-foreground">{email || "Compte Gando"}</div>
            <div className="mt-0.5 text-[9px] text-muted-foreground">{roleLabel(role)}</div>
          </div>
          <div className="hidden lg:block"><ThemeToggle /></div>
        </div>
        <div className="flex justify-center lg:hidden"><ThemeToggle /></div>
        <form action="/api/auth/logout" method="post">
          <button type="submit" title="Se déconnecter" className="flex h-8 w-full items-center justify-center gap-2.5 rounded-xl px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:justify-start">
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.7} /><span className="hidden lg:inline">Se déconnecter</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
