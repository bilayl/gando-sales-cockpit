"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeEuro, BriefcaseBusiness, ChartSpline, UsersRound, WalletCards } from "lucide-react";

const items = [
  { href: "/finance/profitability", label: "Rentabilité", icon: BadgeEuro },
  { href: "/finance/treasury", label: "Trésorerie", icon: WalletCards },
  { href: "/finance/forecast", label: "Prévisionnel", icon: ChartSpline },
  { href: "/finance/deals", label: "Deals", icon: BriefcaseBusiness },
  { href: "/finance/team", label: "Équipe", icon: UsersRound },
] as const;

export function FinanceSectionNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex w-full gap-1 overflow-x-auto rounded-xl border border-border bg-muted/15 p-1">
      {items.map(item => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              "flex h-9 min-w-fit items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors " +
              (active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground")
            }
          >
            <Icon className="size-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
