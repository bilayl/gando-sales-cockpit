import { redirect } from "next/navigation"
import { KpiAppSidebar } from "@/components/kpi-app-sidebar"
import { KpiSiteHeader } from "@/components/kpi-site-header"
import { KpiWorkspace } from "@/components/kpi-workspace"
import { SidebarInset, SidebarProvider } from "@/components/kpi-shadcn/ui/sidebar"
import { getCockpitAccess } from "@/lib/cockpit-access"

export const dynamic = "force-dynamic"

export default async function KpiPage() {
  const access = await getCockpitAccess()
  if (!access) redirect("/login")

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16rem",
          "--header-height": "3.5rem",
        } as React.CSSProperties
      }
    >
      <KpiAppSidebar email={access.email} role={access.role} />
      <SidebarInset className="min-w-0 overflow-hidden md:peer-data-[variant=inset]:border md:peer-data-[variant=inset]:border-border">
        <KpiSiteHeader />
        <div className="@container/main flex min-w-0 flex-1 flex-col">
          <KpiWorkspace canEdit={access.role !== "commercial"} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
