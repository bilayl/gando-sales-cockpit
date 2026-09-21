import type { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <section className="min-w-0 flex-1 bg-background">
      {children}
    </section>
  );
}
