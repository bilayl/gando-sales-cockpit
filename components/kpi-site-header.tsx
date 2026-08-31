import Link from "next/link"
import { ArrowLeft, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/kpi-shadcn/ui/button"
import { Separator } from "@/components/kpi-shadcn/ui/separator"
import { SidebarTrigger } from "@/components/kpi-shadcn/ui/sidebar"
import type { KpiView } from "@/lib/kpi-views"

const VIEW_LABEL: Record<KpiView, string> = {
  lifetime: "Vue d’ensemble",
  overview: "Dernier mois",
  funnel: "Funnel & économie",
  history: "Mensuel & projection",
}

export function KpiSiteHeader({ view }: { view: KpiView }) {
  return (
    <header className="sticky top-0 z-30 flex h-[var(--header-height,2.875rem)] shrink-0 items-center gap-2 border-b border-border bg-background px-2.5 sm:px-3">
      <SidebarTrigger className="-ml-0.5 size-7 rounded-md text-muted-foreground hover:bg-muted" />
      <Separator orientation="vertical" className="mx-0.5 h-4" />

      <div className="flex min-w-0 items-center gap-1.5 text-[12px]">
        <span className="text-muted-foreground">KPI</span>
        <span className="text-muted-foreground/45">/</span>
        <span className="truncate font-medium text-foreground">{VIEW_LABEL[view]}</span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button asChild size="sm" variant="ghost" className="h-7 gap-1.5 rounded-md px-2 text-[11px] text-muted-foreground">
          <Link href="/">
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Cockpit</span>
          </Link>
        </Button>
        <Button size="icon" variant="ghost" className="size-7 rounded-md text-muted-foreground" aria-label="Plus d’options">
          <MoreHorizontal className="size-4" />
        </Button>
      </div>
    </header>
  )
}
