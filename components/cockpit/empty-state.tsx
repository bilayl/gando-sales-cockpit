import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid min-h-52 place-items-center rounded-xl border border-dashed border-border/70 px-6 py-10 text-center", className)}>
      <div className="max-w-sm">
        {icon ? <div className="mx-auto mb-3 grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground">{icon}</div> : null}
        <div className="text-sm font-semibold">{title}</div>
        {description ? <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{description}</p> : null}
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
