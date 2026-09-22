import { redirect } from "next/navigation";
import { KpiPartnerRemuneration } from "@/components/kpi-partner-remuneration";
import { KpiPageShell } from "@/components/kpi/kpi-page-shell";
import { getCockpitAccess } from "@/lib/cockpit-access";

export const dynamic = "force-dynamic";

export default async function KpiRemunerationPage() {
  const access = await getCockpitAccess();
  if (!access) redirect("/login");
  if (!access.canAccessKpi) redirect("/");

  return (
    <KpiPageShell
      role={access.role}
      title="Redevances"
      description="Visualiser les montants dus aux partenaires et loueurs, leurs règles de calcul et le détail des volumes éligibles."
    >
      <KpiPartnerRemuneration />
    </KpiPageShell>
  );
}
