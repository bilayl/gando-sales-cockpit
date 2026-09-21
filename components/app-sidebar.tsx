"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  CircleHelp,
  ContactRound,
  Home,
  ListFilter,
  ListTodo,
  Mail,
  PhoneCall,
  Search,
  Settings,
  Workflow,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  CockpitSidebarUser,
  GandoSidebarMark,
  type CockpitRole,
} from "@/components/cockpit-sidebar-shared";

type NavIcon = typeof Home;
type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  visible?: boolean;
};

function isActive(pathname: string, href: string) {
  if (href === "/today") return pathname === "/today";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label?: string;
  items: NavItem[];
  pathname: string;
}) {
  const visible = items.filter(item => item.visible !== false);
  if (!visible.length) return null;

  return (
    <SidebarGroup className="px-2">
      {label ? <SidebarGroupLabel className="px-2 text-[10px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/40">{label}</SidebarGroupLabel> : null}
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {visible.map(item => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.label}
                  className="h-9 rounded-lg px-2.5 text-[13px] font-medium text-sidebar-foreground/72 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent/70 data-[active=true]:text-sidebar-foreground data-[active=true]:shadow-none"
                >
                  <Link href={item.href}>
                    <Icon className="size-[17px]" strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
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

  const primary: NavItem[] = [
    { href: "/today", label: "Accueil", icon: Home },
    { href: "/kpi", label: "KPI", icon: BarChart3, visible: canAccessKpi },
    { href: "/prospection", label: "Prospection", icon: PhoneCall },
    { href: "/contacts", label: "Contacts", icon: ContactRound },
    { href: "/agenda", label: "Agenda", icon: CalendarDays },
    { href: "/deal-room", label: "Pipeline", icon: Workflow, visible: canAccessDealRoom },
    { href: "/settings", label: "Paramètres", icon: Settings },
  ];

  const tools: NavItem[] = [
    { href: "/sourcing", label: "Sourcing", icon: Search },
    { href: "/segments", label: "Segments", icon: ListFilter, visible: role !== "commercial" },
    { href: "/tasks", label: "Tâches", icon: ListTodo },
    { href: "/emails", label: "Emails", icon: Mail },
    { href: "/support", label: "Support", icon: CircleHelp },
  ];

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border/50 bg-sidebar"
    >
      <SidebarHeader className="px-3 pb-2 pt-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" className="h-12 rounded-xl px-1.5 hover:bg-sidebar-accent/40">
              <Link href="/today" aria-label="Accueil du Cockpit Gando">
                <GandoSidebarMark />
                <div className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate text-[15px] font-semibold tracking-[-0.025em] text-sidebar-foreground">Gando</span>
                  <span className="truncate text-[9px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/40">Cockpit</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-1 pt-1">
        <NavGroup items={primary} pathname={pathname} />
        <NavGroup label="Outils" items={tools} pathname={pathname} />
      </SidebarContent>

      <SidebarFooter className="px-3 pb-3">
        <CockpitSidebarUser email={email} role={role} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
