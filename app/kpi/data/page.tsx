import { redirect } from "next/navigation";
import { KpiDataSourceHealth } from "@/components/kpi-data-source-health";
import { KpiHistoricalAverages } from "@/components/kpi-historical-averages";
import { KpiSystemDashboard } from "@/components/kpi-system-dashboard";
import { KpiInsurancePayable } from "@/components/kpi-insurance-payable";
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
      title="Données"
      description="Moyennes historiques depuis le lancement, détail mensuel de tous les KPI et contrôle de la qualité des sources."
    >
      <KpiHistoricalAverages />
      <KpiDataSourceHealth canEdit={access.role !== "commercial"} />
      <KpiInsurancePayable />
      <KpiSystemDashboard />
    </KpiPageShell>
  );
}
