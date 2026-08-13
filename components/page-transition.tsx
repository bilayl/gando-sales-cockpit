"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <section
      key={pathname}
      className="animate-fade-up min-w-0 flex-1 overflow-hidden rounded-[22px] border border-border bg-background shadow-glow-lg"
    >
      {children}
    </section>
  );
}
