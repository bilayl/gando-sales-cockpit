"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Braces,
  Cable,
  KeyRound,
  PhoneCall,
  ShieldCheck,
  UserRound,
  Users,
  Webhook,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/settings/members", label: "Équipe", icon: Users },
  { href: "/settings/profile", label: "Profil", icon: UserRound },
  { href: "/settings/integrations", label: "Intégrations", icon: Cable },
  { href: "/settings/numbers", label: "Numéros", icon: PhoneCall },
  { href: "/settings/email-notifications", label: "Notifications", icon: Bell },
  { href: "/settings/api-keys", label: "Clés API", icon: KeyRound },
  { href: "/settings/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/settings/compliance", label: "Conformité", icon: ShieldCheck },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="min-w-0">
      <div className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
        Paramètres
      </div>

      <div className="flex gap-1 overflow-x-auto pb-2 lg:block lg:space-y-0.5 lg:overflow-visible lg:pb-0">
        {items.map(item => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground lg:flex",
                active && "bg-muted text-foreground",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.8} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
