import { redirect } from "next/navigation";
import { KpiActualTrends } from "@/components/kpi-actual-trends";
import { KpiEconomicsRisk } from "@/components/kpi-economics-risk";
import { KpiPageShell } from "@/components/kpi/kpi-page-shell";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function KpiEconomicsPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (!access.canAccessKpi) redirect("/");

  return (
    <KpiPageShell
      role={access.role}
      title="Économie & risque"
      description="Rentabilité par caution, marge contributive, exposition au risque et évolution réelle des principaux indicateurs."
    >
      <KpiEconomicsRisk />
      <KpiActualTrends variant="economics" />
    </KpiPageShell>
  );
}
