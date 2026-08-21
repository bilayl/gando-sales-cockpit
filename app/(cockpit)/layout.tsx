import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { PageTransition } from "@/components/page-transition";
import { getCockpitSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CockpitLayout({ children }: { children: ReactNode }) {
  const session = await getCockpitSession();
  if (!session) redirect("/login");

  const accountLabel = session.email || session.displayName || (session.provider === "hubspot" ? "HubSpot connecté" : "Compte Gando");

  return (
    <main className="app-bg min-h-screen pl-[72px] lg:pl-[216px]">
      <div className="animate-fade-in fixed inset-y-0 left-0 z-20">
        <AppSidebar email={accountLabel} />
      </div>
      <PageTransition>{children}</PageTransition>
    </main>
  );
}
