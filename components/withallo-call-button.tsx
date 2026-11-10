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
      onClick={() => {
        // Enrich the Allo caller record from the CRM without delaying the phone dialer.
        void fetch("/api/withallo/crm-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        }).catch(() => {});
        window.dispatchEvent(new CustomEvent("gando:open-dialer", { detail: { phone } }));
      }}
    >
      <PhoneCall size={14} /> {label}
    </button>
  );
}
