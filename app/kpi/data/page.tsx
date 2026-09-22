import { redirect } from "next/navigation";
import { KpiDataSourceHealth } from "@/components/kpi-data-source-health";
import { KpiSystemDashboard } from "@/components/kpi-system-dashboard";
import { KpiPageShell } from "@/components/kpi/kpi-page-shell";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function KpiDataPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (!access.canAccessKpi) redirect("/");

  return (
    <KpiPageShell
      role={access.role}
      title="Qualité des données"
      description="Contrôler les sources, la fraîcheur, les rapprochements et la définition officielle des métriques utilisées dans le pilotage."
    >
      <KpiDataSourceHealth canEdit={access.role !== "commercial"} />
      <KpiSystemDashboard />
    </KpiPageShell>
  );
}
