import { redirect } from "next/navigation";
import { KpiAcquisitionControl } from "@/components/kpi-acquisition-control";
import { KpiAcquisitionExperiment } from "@/components/kpi-acquisition-experiment";
import { KpiPageShell } from "@/components/kpi/kpi-page-shell";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function KpiAcquisitionPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (!access.canAccessKpi) redirect("/");

  const canEdit = access.role !== "commercial";

  return (
    <KpiPageShell
      role={access.role}
      title="Acquisition"
      description="Suivre les investissements commerciaux et marketing, les expérimentations et leur efficacité jusqu’à l’activation."
    >
      <KpiAcquisitionExperiment canEdit={canEdit} />
      <KpiAcquisitionControl canEdit={canEdit} />
    </KpiPageShell>
  );
}
