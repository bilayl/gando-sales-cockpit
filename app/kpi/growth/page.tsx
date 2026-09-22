import { redirect } from "next/navigation";
import { KpiActualTrends } from "@/components/kpi-actual-trends";
import { KpiGrowthUsage } from "@/components/kpi-growth-usage";
import { KpiPageShell } from "@/components/kpi/kpi-page-shell";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function KpiGrowthPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (!access.canAccessKpi) redirect("/");

  return (
    <KpiPageShell
      role={access.role}
      title="Croissance & usage"
      description="Activation, fréquence d’usage, volume et trajectoire réelle des loueurs, avec la même lecture légère que la vue d’ensemble."
    >
      <KpiGrowthUsage />
      <KpiActualTrends variant="growth" />
    </KpiPageShell>
  );
}
