import { Skeleton } from "@/components/ui/skeleton";

export function ProspectionPageSkeleton() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1440px] min-w-0 flex-col overflow-hidden px-3 py-5 sm:px-5 lg:px-7 lg:py-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-8 w-44" />
          <Skeleton className="mt-2 h-4 w-[min(520px,75vw)]" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      <div className="mt-6 min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-border/50 bg-background">
        <div className="border-b border-border/45 px-4 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-2 h-3 w-[min(560px,70vw)]" />
            </div>
            <Skeleton className="h-9 w-40" />
          </div>
        </div>

        <div className="grid grid-cols-2 border-b border-border/45 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 border-r border-border/40 px-4 py-3 last:border-r-0">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-1.5 h-3 w-24" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border/45 px-3 py-2.5 sm:px-4">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="ml-auto h-8 w-28" />
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="grid grid-cols-[90px_190px_minmax(180px,1fr)_120px_150px] gap-3 border-b border-border/45 px-4 py-3 text-xs text-muted-foreground">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-20" />
          </div>

          <div className="divide-y divide-border/35">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="grid grid-cols-[90px_190px_minmax(180px,1fr)_120px_150px] items-center gap-3 px-4 py-3">
                <Skeleton className="h-6 w-16 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-1.5 h-3 w-28" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-7 w-7 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-1 h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
