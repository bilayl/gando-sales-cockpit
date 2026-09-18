import { redirect } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { GlobalPhoneDialer } from "@/components/global-phone-dialer";
import { PageTransition } from "@/components/page-transition";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function CockpitLayout({ children }: { children: ReactNode }) {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");

  const accountLabel = access.email || access.displayName || "Compte Gando";

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "15rem",
          "--sidebar-width-icon": "3.5rem",
        } as CSSProperties
      }
    >
      <AppSidebar
        email={accountLabel}
        role={access.role}
        canAccessKpi={access.canAccessKpi}
      />
      <SidebarInset className="cockpit-shell min-h-svh bg-background text-foreground transition-colors">
        <PageTransition>{children}</PageTransition>
        <GlobalPhoneDialer />
      </SidebarInset>
    </SidebarProvider>
  );
}
