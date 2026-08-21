"use client";

import { useState } from "react";
import { Eye, FileText, ListChecks, Palette } from "lucide-react";
import { SD02PlanBuilder } from "@/components/sd02-plan-builder";
import { SDRoomBrandingEditorV2 } from "@/components/sd-room-branding-editor-v2";
import { SDRoomEditor } from "@/components/sd-room-editor";
import { SDRoomPreview } from "@/components/sd-room-preview";
import { SDRoomStageEditorV2 } from "@/components/sd-room-stage-editor-v2";
import { cn } from "@/lib/utils";

type WorkspaceTab = "content" | "plan" | "closing" | "branding" | "preview";

export function SDRoomWorkspace({ dealId }: { dealId: string }) {
  const [tab, setTab] = useState<WorkspaceTab>("content");
  const tabs: Array<{ value: WorkspaceTab; label: string; icon: typeof FileText }> = [
    { value: "content", label: "SD01 · Synthèse", icon: FileText },
    { value: "plan", label: "SD02 · Plan d’action", icon: ListChecks },
    { value: "closing", label: "SD03 → SD05 · Closing", icon: ListChecks },
    { value: "branding", label: "Branding client", icon: Palette },
    { value: "preview", label: "Prévisualisation", icon: Eye },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-[60] border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center gap-2 overflow-x-auto px-5 py-2 lg:px-7">
          {tabs.map(item => {
            const Icon = item.icon;
            return <button key={item.value} type="button" onClick={() => setTab(item.value)} className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors", tab === item.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="h-3.5 w-3.5" /> {item.label}</button>;
          })}
          <span className="ml-auto hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:block">Room SD · Gando</span>
        </div>
      </div>
      {tab === "content" ? <SDRoomEditor dealId={dealId} /> : tab === "plan" ? <SD02PlanBuilder dealId={dealId} /> : tab === "closing" ? <SDRoomStageEditorV2 dealId={dealId} /> : tab === "branding" ? <SDRoomBrandingEditorV2 dealId={dealId} /> : <SDRoomPreview dealId={dealId} />}
    </div>
  );
}
