import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ChartContainer({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-border/55 bg-background p-4 sm:p-5", className)}>
      {title || description || actions ? (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title ? <div className="text-sm font-semibold">{title}</div> : null}
            {description ? <div className="mt-1 text-xs text-muted-foreground">{description}</div> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
