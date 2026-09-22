import { redirect } from "next/navigation";
import { KpiCeoFocus } from "@/components/kpi-ceo-focus";
import { KpiCeoScorecard } from "@/components/kpi-ceo-scorecard";
import { KpiPageShell } from "@/components/kpi/kpi-page-shell";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function KpiOverviewPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (!access.canAccessKpi) redirect("/");

  return (
    <KpiPageShell
      role={access.role}
      title="Pilotage"
      description="Les indicateurs essentiels pour piloter Gando, suivre la dynamique du mois et identifier les décisions prioritaires."
    >
      <KpiCeoScorecard />
      <KpiCeoFocus />
    </KpiPageShell>
  );
}
