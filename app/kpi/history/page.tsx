import { redirect } from "next/navigation";
import { KpiMonthlyShadcn } from "@/components/kpi-monthly-shadcn";
import { KpiPageShell } from "@/components/kpi/kpi-page-shell";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function KpiHistoryPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (!access.canAccessKpi) redirect("/");

  return (
    <KpiPageShell
      role={access.role}
      title="Historique"
      description="Comparer les résultats réels et les projections mois par mois, avec accès au détail des activations et des principaux ratios."
    >
      <KpiMonthlyShadcn canEdit={access.role !== "commercial"} />
    </KpiPageShell>
  );
}
