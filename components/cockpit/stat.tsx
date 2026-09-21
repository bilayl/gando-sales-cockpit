import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  delta,
  helper,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: number | null;
  helper?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const positive = typeof delta === "number" && delta >= 0;

  return (
    <div className={cn("min-w-0 py-3", className)}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="text-[28px] font-semibold tracking-[-0.045em] tabular-nums text-foreground">{value}</div>
        {typeof delta === "number" ? (
          <span className={cn("mb-1 inline-flex items-center gap-0.5 text-xs font-medium", positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
            {positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(delta * 100).toFixed(1).replace(".", ",")}%
          </span>
        ) : null}
      </div>
      {helper ? <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{helper}</div> : null}
    </div>
  );
}
