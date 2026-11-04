"use client";
import { PhoneCall } from "lucide-react";
import { cn } from "@/lib/utils";

export function WithAlloCallButton({
  phone,
  label = "Appeler avec Allo",
  className,
}: {
  phone: string;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={!phone.trim()}
      className={cn("inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40", className)}
      onClick={() => window.dispatchEvent(new CustomEvent("gando:open-dialer", { detail: { phone } }))}
    >
      <PhoneCall size={14} /> {label}
    </button>
  );
}
