"use client";

import { useEffect, useState } from "react";
import {
  BellRing,
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
  {
    label: "Espace de travail",
    items: [
      { id: "numbers", label: "Numéros", icon: Hash },
      { id: "members", label: "Membres", icon: UsersRound },
      { id: "billing", label: "Facturation", icon: CreditCard },
      { id: "usage", label: "Utilisation", icon: PieChart },
    ],
  },
  {
    label: "Appel",
    items: [
      { id: "tags", label: "Tags", icon: Tags },
      { id: "models", label: "Modèles", icon: WandSparkles },
    ],
  },
  {
    label: "Personnel",
    items: [
      { id: "profile", label: "Profil", icon: UserRound },
      { id: "email-notifications", label: "Notifications par e-mail", icon: Mail },
    ],
  },
  {
    label: "Autres",
    items: [
      { id: "integrations", label: "Intégrations", icon: Plug },
      { id: "api-keys", label: "Clés API", icon: KeyRound },
      { id: "webhooks", label: "Webhooks", icon: Webhook },
      { id: "compliance", label: "Conformité", icon: ShieldCheck },
    ],
  },
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
    <aside className="w-full shrink-0 border-b border-border/80 bg-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] lg:sticky lg:top-0 lg:h-screen lg:w-[286px] lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col px-4 py-5 lg:px-5 lg:py-7">
        <div className="mb-5 flex items-center gap-2 px-1 lg:mb-7">
          <a href="/today" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Retour au cockpit">
            <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
          </a>
          <div className="text-[24px] font-semibold tracking-[-0.04em]">Paramètres</div>
        </div>

        <nav className="flex gap-2 overflow-x-auto pb-2 lg:block lg:min-h-0 lg:flex-1 lg:space-y-7 lg:overflow-y-auto lg:pb-6 minari-scrollbar" aria-label="Navigation des paramètres">
          {groups.map(group => (
            <div key={group.label} className="min-w-[210px] lg:min-w-0">
              <div className="mb-2 px-3 text-[13px] font-medium text-muted-foreground lg:text-[15px]">{group.label}</div>
              <div className="space-y-1">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const selected = active === item.id;
                  return (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={() => setActive(item.id)}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-[17px] px-3.5 py-2 text-[15px] font-medium tracking-[-0.018em] transition lg:text-[17px]",
                        selected
                          ? "bg-[color-mix(in_srgb,var(--muted)_78%,#dbe8e1_22%)] text-foreground"
                          : "text-muted-foreground hover:bg-muted/65 hover:text-foreground",
                      )}
                    >
                      <Icon className="h-[20px] w-[20px] shrink-0" strokeWidth={1.65} />
                      <span>{item.label}</span>
                      {item.id === "email-notifications" ? <BellRing className="ml-auto hidden h-3.5 w-3.5 opacity-50 xl:block" /> : null}
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
