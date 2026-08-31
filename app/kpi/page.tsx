import { redirect } from "next/navigation"
import { KpiAppSidebar } from "@/components/kpi-app-sidebar"
import { KpiSiteHeader } from "@/components/kpi-site-header"
import { KpiWorkspace } from "@/components/kpi-workspace"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getCockpitAccess } from "@/lib/cockpit-access"

export const dynamic = "force-dynamic"

export default async function KpiPage() {
  const access = await getCockpitAccess()
  if (!access) redirect("/login")

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "18rem",
          "--header-height": "3.25rem",
        } as React.CSSProperties
      }
    >
      <KpiAppSidebar email={access.email} role={access.role} />
      <SidebarInset>
        <KpiSiteHeader />
        <div className="@container/main flex flex-1 flex-col">
          <KpiWorkspace canEdit={access.role !== "commercial"} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
