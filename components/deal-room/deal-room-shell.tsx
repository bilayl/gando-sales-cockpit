"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { GandoMark } from "@/components/gando-mark";
import { ThemeToggle } from "@/components/theme-toggle";

export function DealRoomShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 flex h-12 shrink-0 items-center justify-between border-b border-border/50 bg-background/90 px-3 backdrop-blur-xl sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/"
            className="inline-flex h-8 items-center gap-2 rounded-lg px-2 text-xs font-medium text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
            title="Retour au Cockpit"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <GandoMark className="h-5 w-5" />
            <span className="hidden sm:inline">Retour au Cockpit</span>
          </Link>
          <div className="h-4 w-px bg-border/70" />
          <span className="truncate text-[12px] font-medium text-muted-foreground">Deal Room</span>
        </div>

        <ThemeToggle />
      </header>

      <main className="min-h-0 min-w-0 flex-1">{children}</main>
    </div>
  );
}
