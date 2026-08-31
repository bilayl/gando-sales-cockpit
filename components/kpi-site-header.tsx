import Link from "next/link"
import { ArrowLeft, BarChart3 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function KpiSiteHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-[var(--header-height,3rem)] items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur lg:rounded-t-2xl lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <BarChart3 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold tracking-tight">Business KPI</div>
          <div className="hidden text-[10px] font-semibold text-muted-foreground sm:block">Pilotage de la création de valeur Gando</div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Badge variant="outline" className="hidden sm:inline-flex">Données réelles + calculées</Badge>
        <Button asChild size="sm" variant="outline">
          <Link href="/"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Cockpit</Link>
        </Button>
      </div>
    </header>
  )
}
