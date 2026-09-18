"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarCheck2,
  Code2,
  FileText,
  Inbox,
  LifeBuoy,
  ListFilter,
  ListTodo,
  Mail,
  Phone,
  Search,
  Settings,
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
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  CockpitSidebarHeader,
  CockpitSidebarUser,
  type CockpitRole,
} from "@/components/cockpit-sidebar-shared";

type NavIcon = typeof Phone;
type NavItem = { href: string; label: string; icon: NavIcon };

const callNav: NavItem[] = [
  { href: "/today", label: "Aujourd’hui", icon: Inbox },
  { href: "/prospection", label: "Prospection", icon: Phone },
  { href: "/historique", label: "Résumés", icon: FileText },
];

const workspaceNav: NavItem[] = [
  { href: "/sourcing", label: "Sourcing", icon: Search },
  { href: "/segments", label: "Segments", icon: ListFilter },
  { href: "/tasks", label: "Tâches", icon: ListTodo },
  { href: "/analytics", label: "Analyse", icon: BarChart3 },
  { href: "/developer", label: "Développeur", icon: Code2 },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

const followUpNav: NavItem[] = [
  { href: "/meetings", label: "Rendez-vous", icon: CalendarCheck2 },
  { href: "/emails", label: "Emails", icon: Mail },
  { href: "/support", label: "Support", icon: LifeBuoy },
];

function NavigationGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                  <Link href={item.href}>
                    <Icon />
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
}: {
  email?: string;
  role?: CockpitRole;
  canAccessKpi?: boolean;
}) {
  const pathname = usePathname();
  const workspaceItems = role === "commercial"
    ? workspaceNav.filter((item) => item.href !== "/segments")
    : workspaceNav;

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader>
        <CockpitSidebarHeader section="Cockpit CRM" canAccessKpi={canAccessKpi} />
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <NavigationGroup label="Appels" items={callNav} pathname={pathname} />
        <NavigationGroup label="Espace de travail" items={workspaceItems} pathname={pathname} />
        <NavigationGroup label="Suivi" items={followUpNav} pathname={pathname} />
      </SidebarContent>

      <SidebarFooter>
        <CockpitSidebarUser email={email} role={role} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
