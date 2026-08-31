import { redirect } from "next/navigation"
import { KpiClientShell } from "@/components/kpi-client-shell"
import { getCockpitAccess } from "@/lib/cockpit-access"

export const dynamic = "force-dynamic"

export default async function KpiPage() {
  const access = await getCockpitAccess()
  if (!access) redirect("/login")

  return <KpiClientShell email={access.email} role={access.role} />
}
