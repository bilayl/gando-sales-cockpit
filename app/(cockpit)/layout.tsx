import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { PageTransition } from "@/components/page-transition";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function CockpitLayout({ children }: { children: ReactNode }) {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");

  const accountLabel = access.email || access.displayName || "Compte Gando";

  return (
    <main className="app-bg min-h-screen pl-[72px] lg:pl-[216px]">
      <div className="animate-fade-in fixed inset-y-0 left-0 z-20">
        <AppSidebar email={accountLabel} role={access.role} />
      </div>
      <PageTransition>{children}</PageTransition>
    </main>
  );
}
