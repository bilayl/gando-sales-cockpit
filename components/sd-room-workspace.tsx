"use client";

import { useState } from "react";
import { FileText, Palette } from "lucide-react";
import { SDRoomBrandingEditor } from "@/components/sd-room-branding-editor";
import { SDRoomEditor } from "@/components/sd-room-editor";
import { cn } from "@/lib/utils";

export function SDRoomWorkspace({ dealId }: { dealId: string }) {
  const [tab, setTab] = useState<"content" | "branding">("content");

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-[60] border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center gap-2 px-5 py-2 lg:px-7">
          <button type="button" onClick={() => setTab("content")} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors", tab === "content" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><FileText className="h-3.5 w-3.5" /> Contenu SD</button>
          <button type="button" onClick={() => setTab("branding")} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors", tab === "branding" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Palette className="h-3.5 w-3.5" /> Branding client</button>
          <span className="ml-auto hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:block">Room SD · Gando</span>
        </div>
      </div>
      {tab === "content" ? <SDRoomEditor dealId={dealId} /> : <SDRoomBrandingEditor dealId={dealId} />}
    </div>
  );
}
