"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarCheck2,
  ListFilter,
  ListTodo,
  LogOut,
  Phone,
  Search,
  Settings,
  UsersRound,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type CockpitRole = "admin" | "member" | "commercial";
type NavIcon = typeof Phone;
type NavItem = { href: string; label: string; icon: NavIcon };

const primaryNav: NavItem[] = [
  { href: "/today", label: "Aujourd’hui", icon: Phone },
  { href: "/prospection", label: "Appels", icon: Phone },
  { href: "/prospects", label: "Prospects", icon: UsersRound },
  { href: "/analytics", label: "Analyse", icon: BarChart3 },
];

const workspaceNav: NavItem[] = [
  { href: "/sourcing", label: "Sourcing", icon: Search },
  { href: "/segments", label: "Segments", icon: ListFilter },
  { href: "/tasks", label: "Tâches", icon: ListTodo },
  { href: "/meetings", label: "Rendez-vous", icon: CalendarCheck2 },
];

function roleLabel(role: CockpitRole) {
  return role === "admin" ? "Administrateur" : role === "commercial" ? "Commercial" : "Membre";
}

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={item.label}
      className={cn(
        "group flex h-11 items-center justify-center gap-3 rounded-[13px] px-3 text-[15px] font-medium tracking-[-0.01em] transition-colors lg:justify-start",
        active
          ? "bg-[#edf1ef] text-[#17231f]"
          : "text-[#4d5a54] hover:bg-[#f0f3f1] hover:text-[#17231f]",
      )}
    >
      <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.7} />
      <span className="hidden truncate lg:block">{item.label}</span>
    </Link>
  );
}

export function AppSidebar({ email, role = "member" }: { email?: string; role?: CockpitRole }) {
  const pathname = usePathname();
  const workspaceItems = role === "commercial" ? workspaceNav.filter(item => item.href !== "/segments") : workspaceNav;

  return (
    <aside className="flex h-screen w-[68px] flex-col border-r border-[#e6ebe7] bg-[#f8faf9] px-2 py-4 lg:w-[232px] lg:px-3.5">
      <Link href="/today" className="mb-4 flex h-10 items-center justify-center gap-2.5 px-2 lg:justify-start">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[#1f3a31] text-[13px] font-semibold text-white">G</span>
        <span className="hidden text-[17px] font-semibold tracking-[-0.03em] text-[#17231f] lg:block">Gando</span>
      </Link>

      <nav className="min-h-0 flex-1 overflow-y-auto minari-scrollbar" aria-label="Navigation principale">
        <div className="space-y-0.5">
          {primaryNav.map(item => <SidebarLink key={item.href} item={item} pathname={pathname} />)}
        </div>

        <div className="my-5 border-t border-[#e4e9e6]" />

        <div>
          <div className="mb-2 hidden px-3 text-[13px] font-medium text-[#75817b] lg:block">Workspace</div>
          <div className="space-y-0.5">
            {workspaceItems.map(item => <SidebarLink key={item.href} item={item} pathname={pathname} />)}
          </div>
        </div>
      </nav>

      <div className="border-t border-[#e4e9e6] pt-3">
        <SidebarLink item={{ href: "/settings", label: "Paramètres", icon: Settings }} pathname={pathname} />
        <div className="mt-2 flex items-center justify-center gap-2.5 rounded-xl px-2 py-2.5 lg:justify-start">
          <Avatar className="h-7 w-7 shrink-0 border border-[#dce4df]">
            <AvatarFallback className="bg-[#dcebe3] text-[11px] font-semibold text-[#2c5542]">{(email || "G").slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 flex-1 lg:block">
            <div className="truncate text-[12px] font-medium text-[#314139]">{email || "Compte Gando"}</div>
            <div className="mt-0.5 text-[10px] text-[#87928c]">{roleLabel(role)}</div>
          </div>
        </div>
        <form action="/api/auth/logout" method="post">
          <button type="submit" title="Se déconnecter" className="flex h-9 w-full items-center justify-center gap-3 rounded-xl px-3 text-[12px] font-medium text-[#718079] transition-colors hover:bg-[#edf1ef] hover:text-[#17231f] lg:justify-start">
            <LogOut className="h-4 w-4" strokeWidth={1.7} /><span className="hidden lg:inline">Se déconnecter</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
