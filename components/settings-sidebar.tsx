"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  CreditCard,
  Hash,
  KeyRound,
  Mail,
  PieChart,
  Plug,
  ShieldCheck,
  Tags,
  UserRound,
  UsersRound,
  WandSparkles,
  Webhook,
} from "lucide-react";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

type Item = { href: string; label: string; icon: typeof Hash };
type Group = { label: string; items: Item[] };

const groups: Group[] = [
  {
    label: "Espace de travail",
    items: [
      { href: "/settings/numbers", label: "Numéros", icon: Hash },
      { href: "/settings/members", label: "Membres", icon: UsersRound },
      { href: "/settings/billing", label: "Facturation", icon: CreditCard },
      { href: "/settings/usage", label: "Utilisation", icon: PieChart },
    ],
  },
  {
    label: "Appel",
    items: [
      { href: "/settings/tags", label: "Tags", icon: Tags },
      { href: "/settings/models", label: "Modèles", icon: WandSparkles },
    ],
  },
  {
    label: "Personnel",
    items: [
      { href: "/settings/profile", label: "Profil", icon: UserRound },
      { href: "/settings/email-notifications", label: "Notifications par e-mail", icon: Mail },
    ],
  },
  {
    label: "Autres",
    items: [
      { href: "/settings/integrations", label: "Intégrations", icon: Plug },
      { href: "/settings/api-keys", label: "Clés API", icon: KeyRound },
      { href: "/settings/webhooks", label: "Webhooks", icon: Webhook },
      { href: "/settings/compliance", label: "Conformité", icon: ShieldCheck },
    ],
  },
];

export function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-sidebar-border bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:h-svh lg:w-[244px] lg:border-b-0 lg:border-r">
      <SidebarHeader className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" className="h-12">
              <Link href="/prospection">
                <span className="grid size-8 place-items-center rounded-lg border border-sidebar-border bg-background">
                  <ChevronLeft className="size-4" />
                </span>
                <div className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate text-[14px] font-semibold">Paramètres</span>
                  <span className="truncate text-[10px] text-sidebar-foreground/55">Configuration du cockpit</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-y-auto">
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="min-w-[190px] lg:min-w-0">
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const selected = pathname === item.href;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={selected}>
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
        ))}
      </SidebarContent>
    </aside>
  );
}
