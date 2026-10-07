import { redirect } from "next/navigation";
import { TeamEfficiencyDashboard } from "@/components/team-efficiency-dashboard";
import { KpiPageShell } from "@/components/kpi/kpi-page-shell";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function KpiTeamPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (!access.canAccessKpi) redirect("/");

  return (
    <KpiPageShell
      role={access.role}
      title="Équipe & rendement"
      description="Savoir combien coûte chaque recrutement et quelle contribution commerciale il doit créer pour atteindre son multiple cible."
    >
      <TeamEfficiencyDashboard />
    </KpiPageShell>
  );
}
