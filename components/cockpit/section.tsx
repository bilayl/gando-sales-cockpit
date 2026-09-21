import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
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
    <section className={cn("min-w-0", className)}>
      {title || description || action ? (
        <div className="mb-4 flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-semibold tracking-[-0.015em]">{title}</h2> : null}
            {description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
