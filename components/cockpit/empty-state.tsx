import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid min-h-48 place-items-center rounded-xl border border-dashed border-border/70 px-6 py-10 text-center", className)}>
      <div className="max-w-sm">
        <div className="mx-auto grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">{icon || <Inbox className="size-4" />}</div>
        <div className="mt-3 text-sm font-medium">{title}</div>
        {description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}
