import Link from "next/link"
import { ArrowLeft, BarChart3 } from "lucide-react"
import { Badge } from "@/components/kpi-shadcn/ui/badge"
import { Button } from "@/components/kpi-shadcn/ui/button"
import { Separator } from "@/components/kpi-shadcn/ui/separator"
import { SidebarTrigger } from "@/components/kpi-shadcn/ui/sidebar"
import type { KpiView } from "@/lib/kpi-views"

const VIEW_LABEL: Record<KpiView, string> = {
  lifetime: "Depuis le début",
  overview: "Dernier mois",
  funnel: "Funnel & économie",
  history: "Mensuel & simulation",
}

export function KpiSiteHeader({ view }: { view: KpiView }) {
  return (
    <header className="sticky top-0 z-30 flex h-[var(--header-height,3.5rem)] shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:px-4 lg:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <div className="flex min-w-0 items-center gap-2">
        <BarChart3 className="size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">Business KPI</div>
          <div className="hidden truncate text-[10px] text-muted-foreground sm:block">{VIEW_LABEL[view]}</div>
        </div>
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-2">
        <Badge variant="outline" className="hidden font-normal lg:inline-flex">Données réelles + calculées</Badge>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href="/">
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Cockpit</span>
          </Link>
        </Button>
      </div>
    </header>
  )
}
