"use client";

import { useState } from "react";
import { CalendarCheck2, UsersRound } from "lucide-react";
import { MeetingsView } from "@/components/meetings-view";
import { SetterMeetingsPanel } from "@/components/setter-meetings-panel";
import { cn } from "@/lib/utils";

type MeetingsCategory = "setter" | "all";

export function MeetingsCategoryView() {
  const [category, setCategory] = useState<MeetingsCategory>("setter");

  return (
    <div className="min-h-screen">
      <div className="px-5 pt-5 lg:px-7 lg:pt-6">
        <div className="mx-auto max-w-[1500px]">
          <div className="inline-flex rounded-xl border border-border bg-card p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setCategory("setter")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
                category === "setter" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <UsersRound className="h-4 w-4" />
              Rendez-vous setter
            </button>
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
                category === "all" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <CalendarCheck2 className="h-4 w-4" />
              Tous les rendez-vous
            </button>
          </div>
        </div>
      </div>

      {category === "setter" ? (
        <SetterMeetingsPanel />
      ) : (
        <div className="meetings-without-gando-presentations">
          <MeetingsView />
          <style>{`
            .meetings-without-gando-presentations [role="tablist"][aria-label="Vues de rendez-vous"] > button:last-child {
              display: none !important;
            }
            .meetings-without-gando-presentations section[aria-label="Indicateurs rendez-vous"] > :last-child {
              display: none !important;
            }
            @media (min-width: 1280px) {
              .meetings-without-gando-presentations section[aria-label="Indicateurs rendez-vous"] {
                grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
