import { redirect } from "next/navigation";
import { KpiForecastScenarios } from "@/components/kpi-forecast-scenarios";
import { KpiPageShell } from "@/components/kpi/kpi-page-shell";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function KpiForecastPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (!access.canAccessKpi) redirect("/");

  return (
    <KpiPageShell
      role={access.role}
      title="Prévisions"
      description="Projeter les prochains mois, comparer les scénarios et mesurer l’impact des leviers sans mélanger réel et prévisionnel."
    >
      <KpiForecastScenarios />
    </KpiPageShell>
  );
}
