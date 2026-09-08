import { redirect } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { PageTransition } from "@/components/page-transition";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

const alloPalette = {
  "--background": "#ffffff",
  "--foreground": "#17231f",
  "--card": "#ffffff",
  "--card-foreground": "#17231f",
  "--popover": "#ffffff",
  "--popover-foreground": "#17231f",
  "--primary": "#1f3a31",
  "--primary-foreground": "#ffffff",
  "--secondary": "#edf2ef",
  "--secondary-foreground": "#253a31",
  "--muted": "#f3f6f4",
  "--muted-foreground": "#75817b",
  "--accent": "#edf2ef",
  "--accent-foreground": "#1f3a31",
  "--border": "#e3e8e5",
  "--input": "#dfe5e1",
  "--ring": "#547765",
  colorScheme: "light",
} as CSSProperties;

export default async function CockpitLayout({ children }: { children: ReactNode }) {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");

  const accountLabel = access.email || access.displayName || "Compte Gando";

  return (
    <main className="allo-shell min-h-screen bg-white pl-[68px] lg:pl-[232px]" style={alloPalette}>
      <div className="animate-fade-in fixed inset-y-0 left-0 z-20">
        <AppSidebar email={accountLabel} role={access.role} />
      </div>
      <PageTransition>{children}</PageTransition>
    </main>
  );
}
