"use client";

import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import type { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.section
      key={pathname}
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14, ease: "easeOut" }}
      className="min-w-0 flex-1 bg-background"
    >
      {children}
    </motion.section>
  );
}
