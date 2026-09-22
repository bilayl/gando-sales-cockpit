import { redirect } from "next/navigation";
import { KpiCostControl } from "@/components/kpi-cost-control";
import { KpiPageShell } from "@/components/kpi/kpi-page-shell";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function KpiCashPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (!access.canAccessKpi) redirect("/");

  return (
    <KpiPageShell
      role={access.role}
      title="Cash & coûts"
      description="Suivre les dépenses, le budget, la trésorerie et les coûts unitaires avec une lecture claire et directement exploitable."
    >
      <KpiCostControl canEdit={access.role !== "commercial"} />
    </KpiPageShell>
  );
}
