"use client";

import { useEffect, useState } from "react";
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

type Item = { id: string; label: string; icon: typeof Hash };
type Group = { label: string; items: Item[] };

const groups: Group[] = [
  { label: "Espace de travail", items: [
    { id: "numbers", label: "Numéros", icon: Hash },
    { id: "members", label: "Membres", icon: UsersRound },
    { id: "billing", label: "Facturation", icon: CreditCard },
    { id: "usage", label: "Utilisation", icon: PieChart },
  ] },
  { label: "Appel", items: [
    { id: "tags", label: "Tags", icon: Tags },
    { id: "models", label: "Modèles", icon: WandSparkles },
  ] },
  { label: "Personnel", items: [
    { id: "profile", label: "Profil", icon: UserRound },
    { id: "email-notifications", label: "Notifications par e-mail", icon: Mail },
  ] },
  { label: "Autres", items: [
    { id: "integrations", label: "Intégrations", icon: Plug },
    { id: "api-keys", label: "Clés API", icon: KeyRound },
    { id: "webhooks", label: "Webhooks", icon: Webhook },
    { id: "compliance", label: "Conformité", icon: ShieldCheck },
  ] },
];

export function SettingsSidebar() {
  const [active, setActive] = useState("integrations");

  useEffect(() => {
    const fromHash = window.location.hash.replace(/^#/, "");
    if (fromHash) setActive(fromHash);
    const onHashChange = () => setActive(window.location.hash.replace(/^#/, "") || "integrations");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <aside className="w-full shrink-0 border-b border-[#e7ece8] bg-[#f7f9f7] dark:border-border dark:bg-background lg:sticky lg:top-0 lg:h-screen lg:w-[212px] lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col px-3 py-4 lg:px-3.5 lg:py-4.5">
        <div className="mb-4 flex items-center gap-1 px-1">
          <a
            href="/today"
            className="grid h-7 w-7 place-items-center rounded-full text-[#607069] transition hover:bg-[#edf1ee] hover:text-[#34433c] dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground"
            aria-label="Retour au cockpit"
          >
            <ChevronLeft className="h-[15px] w-[15px]" strokeWidth={1.8} />
          </a>
          <div className="text-[16px] font-semibold tracking-[-0.03em] text-[#2f3d37] dark:text-foreground">Paramètres</div>
        </div>

        <div className="mb-4 border-t border-[#e5eae6] dark:border-border/80" />

        <nav className="flex gap-2 overflow-x-auto pb-2 lg:block lg:min-h-0 lg:flex-1 lg:space-y-5 lg:overflow-y-auto lg:pb-4 minari-scrollbar" aria-label="Navigation des paramètres">
          {groups.map(group => (
            <div key={group.label} className="min-w-[176px] lg:min-w-0">
              <div className="mb-1.5 px-2 text-[11px] font-medium text-[#68756f] dark:text-muted-foreground">{group.label}</div>
              <div className="space-y-[2px]">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const selected = active === item.id;
                  return (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={() => setActive(item.id)}
                      className={cn(
                        "flex h-[35px] items-center gap-2 rounded-[12px] px-2.5 text-[12px] font-medium tracking-[-0.008em] transition",
                        selected
                          ? "bg-[#e9eeea] text-[#34433c] dark:bg-muted dark:text-foreground"
                          : "text-[#68756f] hover:bg-[#eef2ef] hover:text-[#34433c] dark:text-muted-foreground dark:hover:bg-muted/70 dark:hover:text-foreground",
                      )}
                    >
                      <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={1.7} />
                      <span className="truncate">{item.label}</span>
                    </a>
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
