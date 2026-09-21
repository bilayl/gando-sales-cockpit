import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DataTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card/40", className)}>
      <div className="min-w-0 overflow-x-auto minari-scrollbar">{children}</div>
    </div>
  );
}
