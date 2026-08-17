"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <section
      key={pathname}
      className="animate-fade-in min-w-0 flex-1 bg-background"
    >
      {children}
    </section>
  );
}
