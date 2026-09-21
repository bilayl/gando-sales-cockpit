"use client";

import Link from "next/link";
import {
  ChevronsUpDown,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

export type CockpitRole = "admin" | "member" | "commercial";

function roleLabel(role: CockpitRole) {
  return role === "admin" ? "Administrateur" : role === "commercial" ? "Commercial" : "Membre";
}

export function GandoSidebarMark() {
  return (
    <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-[11px] bg-[#dce7ff]" aria-hidden="true">
      <svg viewBox="0 0 128 128" className="size-7" xmlns="http://www.w3.org/2000/svg">
        <path d="M98.8479 81.2759C95.3613 88.4324 89.7153 94.3147 82.706 98.0931C75.6966 101.872 67.6776 103.356 59.7795 102.336C51.8811 101.317 44.5022 97.8459 38.6831 92.4119C32.8637 86.9779 28.8977 79.8554 27.344 72.0485C25.7903 64.2415 26.7273 56.144 30.0231 48.8979C33.3188 41.6516 38.807 35.622 45.7136 31.6592C52.6203 27.6965 60.5972 26.0004 68.5197 26.8102C76.4421 27.62 83.9105 30.8948 89.8717 36.1728L87.804 38.5059C84.1861 42.5879 77.934 42.7267 72.773 40.9575C70.9774 40.3419 69.1075 39.929 67.1975 39.7338C61.9821 39.2006 56.731 40.3172 52.1842 42.926C47.6377 45.5346 44.0247 49.5038 41.8552 54.274C39.6856 59.0443 39.0687 64.3748 40.0916 69.5139C41.1143 74.6533 43.7252 79.342 47.5561 82.9192C51.3868 86.4964 56.2443 88.7815 61.4437 89.4526C66.643 90.1234 71.922 89.1465 76.5362 86.659C78.2261 85.7482 79.7955 84.6513 81.2188 83.3957C85.3096 79.7873 91.139 77.5239 96.0444 79.9115L98.8479 81.2759Z" fill="#19324D" />
        <path d="M58.7457 70.2185C65.9074 65.8701 74.6138 63.9597 83.2509 64.8414C89.7683 65.5067 95.9122 67.7276 101.047 71.2166C103.606 72.9549 102.959 76.3178 100.113 77.6647C96.2643 73.9283 88.7754 73.899 83.6102 75.2809C80.5881 76.2958 76.5579 78.9089 73.3011 81.6975C70.7982 83.8406 66.7866 84.4307 64.2231 82.3437C59.6547 78.624 54.1802 72.9909 58.7457 70.2185Z" fill="#19324D" />
      </svg>
    </span>
  );
}

export function CockpitSidebarHeader() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild size="lg" className="h-14 rounded-xl px-2 hover:bg-sidebar-accent/40">
          <Link href="/today" title="Accueil du Cockpit">
            <GandoSidebarMark />
            <div className="grid min-w-0 flex-1 text-left leading-tight">
              <span className="truncate text-[15px] font-semibold tracking-[-0.025em] text-sidebar-foreground">Gando</span>
              <span className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/45">Cockpit</span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function CockpitSidebarUser({
  email,
  role,
}: {
  email?: string;
  role: CockpitRole;
}) {
  const { isMobile } = useSidebar();
  const account = email || "Compte Gando";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="h-12 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg border border-sidebar-border">
                <AvatarFallback className="rounded-lg bg-background text-xs font-semibold text-foreground">
                  {account.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate text-[11px] font-semibold">{account}</span>
                <span className="truncate text-[10px] text-sidebar-foreground/55">{roleLabel(role)}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-sidebar-foreground/55" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-60 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={6}
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center gap-2 py-1">
                <Avatar className="size-8 rounded-lg border">
                  <AvatarFallback className="rounded-lg text-xs font-semibold">
                    {account.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{account}</div>
                  <div className="text-xs text-muted-foreground">{roleLabel(role)}</div>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/profile" className="gap-2">
                <UserRound className="size-4" />
                Profil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="gap-2">
                <Settings className="size-4" />
                Paramètres
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(event) => event.preventDefault()}
              className="justify-between gap-3"
            >
              <span>Apparence</span>
              <ThemeToggle />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action="/api/auth/logout" method="post">
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full gap-2 text-left">
                  <LogOut className="size-4" />
                  Se déconnecter
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
