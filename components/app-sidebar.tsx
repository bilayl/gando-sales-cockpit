"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Collapsible } from "@base-ui/react/collapsible";
import { motion } from "motion/react";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  ContactRound,
  FileText,
  Home,
  KanbanSquare,
  ListTodo,
  Mail,
  PhoneOutgoing,
  Search,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  CockpitSidebarHeader,
  CockpitSidebarUser,
  type CockpitRole,
} from "@/components/cockpit-sidebar-shared";
import { cn } from "@/lib/utils";

type NavIcon = typeof Home;
type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  exact?: boolean;
  visible?: boolean;
};

function isActive(pathname: string, href: string, exact = false) {
  const path = href.split("?")[0];
  return exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href, item.exact);
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.label}
        className="relative h-9 rounded-lg px-2.5 text-[13px] font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground data-[active=true]:bg-transparent data-[active=true]:text-sidebar-foreground"
      >
        <Link href={item.href}>
          {active ? (
            <motion.span
              layoutId="gando-sidebar-active"
              className="absolute inset-0 -z-10 rounded-lg bg-sidebar-accent/80"
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
            />
          ) : null}
          <Icon className={cn("size-[17px]", active ? "text-sidebar-foreground" : "text-sidebar-foreground/55")} />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar({
  email,
  role = "member",
  canAccessKpi = true,
  canAccessDealRoom = true,
}: {
  email?: string;
  role?: CockpitRole;
  canAccessKpi?: boolean;
  canAccessDealRoom?: boolean;
}) {
  const pathname = usePathname();

  const primaryNav: NavItem[] = [
    { href: "/today", label: "Accueil", icon: Home, exact: true },
    { href: "/kpi", label: "KPI", icon: BarChart3, visible: canAccessKpi },
    { href: "/prospection", label: "Prospection", icon: PhoneOutgoing },
    { href: "/contacts", label: "Contacts", icon: ContactRound },
    { href: "/agenda", label: "Agenda", icon: CalendarDays },
    { href: "/deal-room", label: "Pipeline", icon: KanbanSquare, visible: canAccessDealRoom },
    { href: "/settings", label: "Paramètres", icon: Settings },
  ].filter(item => item.visible !== false);

  const secondaryNav: NavItem[] = [
    { href: "/sourcing", label: "Sourcing", icon: Search },
    ...(role === "commercial" ? [] : [{ href: "/segments", label: "Segments", icon: SlidersHorizontal }]),
    { href: "/tasks", label: "Tâches", icon: ListTodo },
    { href: "/historique", label: "Résumés", icon: FileText },
    { href: "/analytics", label: "Analyse", icon: BarChart3 },
    { href: "/emails", label: "Emails", icon: Mail },
    { href: "/support", label: "Support", icon: CircleHelp },
  ];

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border/70 bg-sidebar">
      <SidebarHeader className="px-2 pt-2">
        <CockpitSidebarHeader />
      </SidebarHeader>

      <SidebarSeparator className="mx-3 w-auto bg-sidebar-border/70" />

      <SidebarContent className="gap-1 px-2 py-2">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {primaryNav.map(item => <NavLink key={item.href} item={item} pathname={pathname} />)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2 bg-sidebar-border/60" />

        <Collapsible.Root defaultOpen={false} className="group/tools">
          <Collapsible.Trigger className="flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-[11px] font-medium text-sidebar-foreground/45 outline-none transition hover:bg-sidebar-accent/40 hover:text-sidebar-foreground/70">
            <span className="truncate group-data-[collapsible=icon]:hidden">Plus</span>
            <ChevronDown className="ml-auto size-3.5 transition-transform group-data-[panel-open]/tools:rotate-180 group-data-[collapsible=icon]:hidden" />
          </Collapsible.Trigger>
          <Collapsible.Panel className="mt-1 overflow-hidden data-[starting-style]:h-0 data-[ending-style]:h-0">
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {secondaryNav.map(item => <NavLink key={item.href} item={item} pathname={pathname} />)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </Collapsible.Panel>
        </Collapsible.Root>
      </SidebarContent>

      <SidebarFooter className="px-2 pb-2">
        <CockpitSidebarUser email={email} role={role} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
