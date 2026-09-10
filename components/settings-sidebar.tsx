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
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: typeof Hash };
type Group = { label: string; items: Item[] };

const groups: Group[] = [
  { label: "Espace de travail", items: [
    { href: "/settings/numbers", label: "Numéros", icon: Hash },
    { href: "/settings/members", label: "Membres", icon: UsersRound },
    { href: "/settings/billing", label: "Facturation", icon: CreditCard },
    { href: "/settings/usage", label: "Utilisation", icon: PieChart },
  ] },
  { label: "Appel", items: [
    { href: "/settings/tags", label: "Tags", icon: Tags },
    { href: "/settings/models", label: "Modèles", icon: WandSparkles },
  ] },
  { label: "Personnel", items: [
    { href: "/settings/profile", label: "Profil", icon: UserRound },
    { href: "/settings/email-notifications", label: "Notifications par e-mail", icon: Mail },
  ] },
  { label: "Autres", items: [
    { href: "/settings/integrations", label: "Intégrations", icon: Plug },
    { href: "/settings/api-keys", label: "Clés API", icon: KeyRound },
    { href: "/settings/webhooks", label: "Webhooks", icon: Webhook },
    { href: "/settings/compliance", label: "Conformité", icon: ShieldCheck },
  ] },
];

export function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full shrink-0 border-b border-[#e7ece8] bg-[#f7f9f7] dark:border-border dark:bg-background lg:sticky lg:top-0 lg:h-screen lg:w-[212px] lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col px-3 py-4 lg:px-3.5 lg:py-4.5">
        <div className="mb-4 flex items-center gap-1 px-1">
          <Link
            href="/prospection"
            className="grid h-7 w-7 place-items-center rounded-full text-[#607069] transition hover:bg-[#edf1ee] hover:text-[#34433c] dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground"
            aria-label="Retour au CRM"
          >
            <ChevronLeft className="h-[15px] w-[15px]" strokeWidth={1.8} />
          </Link>
          <Link href="/settings" className="text-[16px] font-semibold tracking-[-0.03em] text-[#2f3d37] dark:text-foreground">Paramètres</Link>
        </div>

        <div className="mb-4 border-t border-[#e5eae6] dark:border-border/80" />

        <nav className="flex gap-2 overflow-x-auto pb-2 lg:block lg:min-h-0 lg:flex-1 lg:space-y-5 lg:overflow-y-auto lg:pb-4 minari-scrollbar" aria-label="Navigation des paramètres">
          {groups.map(group => (
            <div key={group.label} className="min-w-[176px] lg:min-w-0">
              <div className="mb-1.5 px-2 text-[11px] font-medium text-[#68756f] dark:text-muted-foreground">{group.label}</div>
              <div className="space-y-[2px]">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const selected = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex h-[35px] items-center gap-2 rounded-[12px] px-2.5 text-[12px] font-medium tracking-[-0.008em] transition",
                        selected
                          ? "bg-[#e9eeea] text-[#34433c] dark:bg-muted dark:text-foreground"
                          : "text-[#68756f] hover:bg-[#eef2ef] hover:text-[#34433c] dark:text-muted-foreground dark:hover:bg-muted/70 dark:hover:text-foreground",
                      )}
                    >
                      <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={1.7} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
