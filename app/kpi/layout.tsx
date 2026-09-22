import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { KpiLayoutShell } from "@/components/kpi/kpi-layout-shell";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function KpiLayout({ children }: { children: ReactNode }) {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (!access.canAccessKpi) redirect("/");

  return (
    <KpiLayoutShell
      email={access.displayName || access.email || "Compte Gando"}
      role={access.role}
    >
      {children}
    </KpiLayoutShell>
  );
}
