import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function CockpitLayout({ children }: { children: ReactNode }) {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");

  const accountLabel = access.email || access.displayName || "Compte Gando";

  return (
    <DashboardLayout
      email={accountLabel}
      role={access.role}
      canAccessKpi={access.canAccessKpi}
      canAccessDealRoom={access.canAccessDealRoom}
    >
      {children}
    </DashboardLayout>
  );
}
