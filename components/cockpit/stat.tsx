import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  delta,
  hint,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: number | null;
  hint?: string;
  icon?: ReactNode;
  className?: string;
}) {
  const positive = typeof delta === "number" && delta >= 0;
  return (
    <div className={cn("min-w-0 py-4", className)}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon ? <span className="text-foreground/65">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="text-[30px] font-semibold leading-none tracking-[-0.045em] tabular-nums">{value}</div>
        {typeof delta === "number" ? (
          <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
          </span>
        ) : null}
      </div>
      {hint ? <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
