"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CheckSquare2,
  ChevronDown,
  Home,
  Inbox,
  LineChart,
  LogOut,
  Mail,
  MessageSquareText,
  Phone,
  Plus,
  Search,
  Settings,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type CockpitRole = "admin" | "member" | "commercial";
type NavIcon = typeof Home;
type NavItem = { href: string; label: string; icon: NavIcon; accent?: "blue" | "violet" | "green" };
type NavGroup = { key: string; label: string; items: NavItem[] };

const primaryItems: NavItem[] = [
  { href: "/prospection", label: "Accueil", icon: Home },
  { href: "/tasks", label: "Tâches", icon: CheckSquare2 },
  { href: "/emails", label: "Emails", icon: Mail },
  { href: "/prospection", label: "Appels", icon: Phone },
  { href: "/analytics", label: "Rapports", icon: BarChart3 },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
];

const groups: NavGroup[] = [
  {
    key: "records",
    label: "Records",
    items: [
      { href: "/companies", label: "Entreprises", icon: Building2, accent: "blue" },
      { href: "/contacts", label: "Contacts", icon: UserRound, accent: "blue" },
    ],
  },
  {
    key: "lists",
    label: "Lists",
    items: [
      { href: "/segments", label: "Segments", icon: UsersRound, accent: "violet" },
      { href: "/sourcing", label: "Sourcing", icon: Search, accent: "green" },
    ],
  },
  {
    key: "assistant",
    label: "Assistant",
    items: [
      { href: "/ai-sales", label: "Assistant IA", icon: Sparkles, accent: "violet" },
      { href: "/meetings", label: "Rendez-vous", icon: CalendarDays },
    ],
  },
];

function roleLabel(role: CockpitRole) {
  return role === "admin" ? "Administrateur" : role === "commercial" ? "Commercial" : "Membre";
}

function recordAccent(accent?: NavItem["accent"]) {
  if (accent === "blue") return "bg-[#5865f2] text-white";
  if (accent === "green") return "bg-emerald-500 text-white";
  if (accent === "violet") return "bg-violet-500 text-white";
  return "text-[#6f7075] dark:text-[#9b9ca1]";
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const hasAccent = Boolean(item.accent);

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex h-[34px] items-center gap-2 rounded-[7px] px-2 text-[14px] font-medium tracking-[-0.01em] transition-colors",
        active
          ? "bg-[#ececed] text-[#202124] dark:bg-white/10 dark:text-white"
          : "text-[#292a2d] hover:bg-[#f0f0f1] dark:text-[#d9d9dc] dark:hover:bg-white/[0.07]",
      )}
    >
      <span
        className={cn(
          "grid h-[20px] w-[20px] shrink-0 place-items-center rounded-[5px]",
          hasAccent ? recordAccent(item.accent) : "text-[#707176] dark:text-[#9b9ca1]",
        )}
      >
        <Icon className={cn(hasAccent ? "h-[13px] w-[13px]" : "h-[18px] w-[18px]")} strokeWidth={hasAccent ? 2 : 1.85} />
      </span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function AppSidebar({ email, role = "member" }: { email?: string; role?: CockpitRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ records: true, lists: true, assistant: true });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        router.push("/sourcing");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  const visiblePrimaryItems = useMemo(() => {
    if (role === "commercial") return primaryItems.filter(item => item.href !== "/analytics" || item.label !== "Rapports");
    return primaryItems;
  }, [role]);

  const visibleGroups = useMemo(() => {
    if (role !== "commercial") return groups;
    return groups.map(group => {
      if (group.key === "lists") return { ...group, items: group.items.filter(item => item.href === "/sourcing") };
      return group;
    });
  }, [role]);

  const isActive = (item: NavItem) => {
    if (item.label === "Accueil") return pathname === "/prospection";
    if (item.label === "Appels") return pathname.startsWith("/prospection") && pathname !== "/prospection";
    return pathname.startsWith(item.href);
  };

  return (
    <aside className="flex h-screen w-[252px] flex-col border-r border-[#e8e8e9] bg-[#fbfbfb] text-[#222326] dark:border-white/10 dark:bg-[#171719]">
      <div className="flex h-[58px] items-center justify-between border-b border-[#ededee] px-3 dark:border-white/10">
        <button type="button" className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-[#f0f0f1] dark:hover:bg-white/[0.06]">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[#745cf5] text-[15px] font-semibold text-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]">G</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold tracking-[-0.02em]">Gando</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[#5f6065]" strokeWidth={2} />
        </button>
        <Link href="/settings" aria-label="Paramètres" className="grid h-8 w-8 place-items-center rounded-lg text-[#707176] hover:bg-[#f0f0f1] hover:text-[#2f3033] dark:hover:bg-white/[0.06] dark:hover:text-white">
          <Settings className="h-[17px] w-[17px]" strokeWidth={1.8} />
        </Link>
      </div>

      <div className="px-3 pb-2 pt-3">
        <div className="flex gap-2">
          <Link
            href="/sourcing"
            className="flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-[9px] border border-[#e2e2e4] bg-white px-2.5 text-[#737479] shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:border-[#d5d5d7] dark:border-white/10 dark:bg-[#202023] dark:text-[#aaaab0]"
          >
            <Search className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
            <span className="truncate text-[14px] font-medium">Search</span>
            <kbd className="ml-auto rounded-[6px] border border-[#e5e5e6] bg-[#fafafa] px-1.5 py-0.5 text-[10px] font-medium text-[#8b8c91] shadow-[0_1px_1px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-white/[0.03]">⌘ K</kbd>
          </Link>
          <Link href="/tasks" aria-label="Boîte de tâches" className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[9px] border border-[#e2e2e4] bg-white text-[#5e5f64] shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-[#f6f6f7] dark:border-white/10 dark:bg-[#202023] dark:text-[#aaaab0] dark:hover:bg-white/[0.06]">
            <Inbox className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </Link>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 minari-scrollbar" aria-label="Navigation principale">
        <div className="space-y-[2px] px-1 pb-3">
          {visiblePrimaryItems.map((item, index) => (
            <NavRow key={`${item.href}-${item.label}-${index}`} item={item} active={isActive(item)} />
          ))}
        </div>

        <div className="space-y-3">
          {visibleGroups.map(group => {
            const open = openGroups[group.key] ?? true;
            return (
              <section key={group.key}>
                <button
                  type="button"
                  onClick={() => setOpenGroups(current => ({ ...current, [group.key]: !open }))}
                  className="mb-1 flex h-7 w-full items-center gap-1 rounded-md px-2 text-left text-[13px] font-medium text-[#85868b] hover:text-[#56575c] dark:text-[#85868c] dark:hover:text-[#b5b5bb]"
                >
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} strokeWidth={2} />
                  <span>{group.label}</span>
                </button>
                {open ? (
                  <div className="space-y-[2px] px-1">
                    {group.items.map(item => <NavRow key={`${group.key}-${item.href}`} item={item} active={isActive(item)} />)}
                  </div>
                ) : null}
              </section>
            );
          })}

          <section>
            <div className="mb-1 flex h-7 items-center gap-1 px-2 text-[13px] font-medium text-[#85868b] dark:text-[#85868c]">
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
              <span>Chats</span>
            </div>
            <Link href="/ai-sales" className="mx-1 flex h-[36px] items-center justify-center gap-2 rounded-[9px] border border-dashed border-[#dfdfe1] text-[13px] font-medium text-[#87888d] transition hover:border-[#cfcfd2] hover:bg-[#f5f5f6] hover:text-[#55565b] dark:border-white/10 dark:hover:bg-white/[0.05]">
              <Plus className="h-4 w-4" strokeWidth={1.8} /> Nouveau chat
            </Link>
          </section>
        </div>
      </nav>

      <div className="border-t border-[#ededee] px-3 py-3 dark:border-white/10">
        <Link href="/analytics" className="mb-2 flex h-8 items-center gap-2 rounded-[7px] px-2 text-[13px] font-medium text-[#65666b] hover:bg-[#f0f0f1] dark:text-[#a0a0a6] dark:hover:bg-white/[0.06]">
          <LineChart className="h-4 w-4" strokeWidth={1.8} /> Performance
        </Link>
        <Link href="/support" className="mb-3 flex h-8 items-center gap-2 rounded-[7px] px-2 text-[13px] font-medium text-[#65666b] hover:bg-[#f0f0f1] dark:text-[#a0a0a6] dark:hover:bg-white/[0.06]">
          <MessageSquareText className="h-4 w-4" strokeWidth={1.8} /> Support
        </Link>

        <div className="flex items-center gap-2 rounded-[9px] px-1.5 py-1.5">
          <Avatar className="h-8 w-8 shrink-0 border border-[#e4e4e6] dark:border-white/10">
            <AvatarFallback className="bg-white text-[12px] font-semibold text-[#55565b] dark:bg-white/[0.06] dark:text-white">
              {(email || "G").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-[#343538] dark:text-[#e5e5e7]">{email || "Compte Gando"}</div>
            <div className="mt-0.5 text-[10px] text-[#95969b]">{roleLabel(role)}</div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button type="submit" title="Se déconnecter" className="grid h-8 w-8 place-items-center rounded-[7px] text-[#88898e] hover:bg-[#f0f0f1] hover:text-[#4d4e52] dark:hover:bg-white/[0.06] dark:hover:text-white">
              <LogOut className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
