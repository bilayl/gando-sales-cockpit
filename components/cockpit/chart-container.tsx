import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ChartContainer({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-border/60 bg-card/50 p-4 sm:p-5", className)}>
      {title || description || action ? (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title ? <div className="text-sm font-medium">{title}</div> : null}
            {description ? <div className="mt-1 text-xs text-muted-foreground">{description}</div> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </div>
  );
}
