import { redirect } from "next/navigation";
import { DealEconomicsDashboard } from "@/components/deal-economics-dashboard";
import { KpiPageShell } from "@/components/kpi/kpi-page-shell";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function KpiDealsPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (!access.canAccessKpi) redirect("/");

  return (
    <KpiPageShell
      role={access.role}
      title="Valeur des deals"
      description="Relier le volume commercial promis à la contribution économique attendue et à la valeur pondérée du pipeline."
    >
      <DealEconomicsDashboard />
    </KpiPageShell>
  );
}
